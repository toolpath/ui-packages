import type { Material, Object3D, Texture } from 'three'

/**
 * The GPU side of React Native's frame, without React or expo-gl: how a frame
 * reaches the screen, and how everything a canvas holds on the GPU is freed.
 * `native/viewer-frame.tsx` wires these to fiber and expo-gl.
 */

/** expo-gl's context: `endFrameEXP` shows what has been drawn. */
interface PresentingContext {
  endFrameEXP(): void
}

/**
 * The frame reaches the screen once, when it is finished.
 *
 * Fiber native presents after every `gl.render`, and the view cube's HUD is a
 * second render each frame — so every other present showed the scene without
 * the cube, and it flickered. `endFrameEXP` here only marks the frame; an
 * after-effect presents it, once, at the end of the frame. Returns the
 * after-effect's remover.
 */
export const createPresenter = (
  context: PresentingContext,
  addAfterEffect: (callback: (timestamp: number) => void) => () => void,
): (() => void) => {
  const present = context.endFrameEXP.bind(context)
  let dirty = false
  context.endFrameEXP = () => {
    dirty = true
  }
  return addAfterEffect(() => {
    if (!dirty) return
    dirty = false
    present()
  })
}

interface Release {
  gl: { dispose(): void }
  scene: Object3D
  /** Destroys the GL context itself. */
  destroy: () => void
  /** Removes the presenter's after-effect. */
  stopPresenting: () => void
}

/**
 * Frees what the canvas holds on the GPU, once.
 *
 * expo-gl has no `WEBGL_lose_context`, so the context loss fiber asks for when
 * a canvas unmounts does nothing, and expo-gl's view does not destroy its
 * context on unmount either: every canvas a screen mounted kept its buffers.
 * The frame makes this the renderer's `forceContextLoss`, the last thing fiber
 * calls when it tears a root down. It stops presenting, disposes anything
 * still under the scene, disposes the renderer, and destroys the context, in
 * that order; called again, it does nothing. The context goes even if a
 * dispose throws: fiber swallows the error, and nothing would free it after.
 */
export const createRelease = ({ gl, scene, destroy, stopPresenting }: Release): (() => void) => {
  let released = false
  return () => {
    if (released) return
    released = true
    try {
      stopPresenting()
      disposeTree(scene)
      gl.dispose()
    } finally {
      destroy()
    }
  }
}

const isTexture = (value: unknown): value is Texture =>
  (value as Texture | null | undefined)?.isTexture === true

interface Disposable {
  dispose(): void
}

/** Every geometry, material and texture under `root`, and any render target a material samples. */
const disposablesUnder = (root: Object3D): Set<Disposable> => {
  const found = new Set<Disposable>()
  root.traverse((object) => {
    const { geometry, material } = object as Object3D & {
      geometry?: Disposable
      material?: Material | Material[]
    }
    if (geometry) found.add(geometry)
    for (const each of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(each)) {
        if (isTexture(value)) found.add(value)
      }
      const uniforms = (each as Material & { uniforms?: Record<string, { value: unknown }> })
        .uniforms
      for (const uniform of Object.values(uniforms ?? {})) {
        if (isTexture(uniform.value)) found.add(uniform.value)
      }
      found.add(each)
    }
  })
  return found
}

/** Disposes every geometry, material and texture under `root`, and any render target a material samples. */
export const disposeTree = (root: Object3D): void => {
  for (const each of disposablesUnder(root)) each.dispose()
}

/**
 * Frees what a scene holds when its canvas goes, and not when it is only
 * hidden.
 *
 * What the scene holds has to be read while it still holds it, in a layout
 * effect's cleanup on the canvas's first child: by the passive cleanups the
 * rest of the tree has left the scene. But React also runs layout cleanups when
 * a `<Suspense>` above suspends again and hides what it had shown, and that
 * scene is still live. So the layout cleanup only reads (`hidden`), showing it
 * again forgets what was read (`shown`), and the passive cleanup, which a hide
 * never runs, disposes it (`gone`).
 */
export const createSceneRelease = (scene: Object3D) => {
  let held: Set<Disposable> | null = null
  return {
    shown: (): void => {
      held = null
    },
    hidden: (): void => {
      held = disposablesUnder(scene)
    },
    gone: (): void => {
      for (const each of held ?? []) each.dispose()
      held = null
    },
  }
}

/** Fiber's root teardown is done well within this, and calls `forceContextLoss` itself when it is. */
export const RELEASE_FALLBACK_MS = 2000

/**
 * When a canvas that has gone frees its scene and its context: the scene on
 * the next task, and the context after {@link RELEASE_FALLBACK_MS} if fiber
 * has not freed it by then.
 *
 * React's StrictMode, which fiber carries into the canvas, runs every effect's
 * cleanup and then its setup again on a canvas that stays. Freed in the
 * cleanup itself, the live scene's geometry and materials would all upload
 * again; `mounted` cancels what `unmounted` set off. A real unmount frees the
 * scene well before fiber's own teardown, which waits 500 ms, so the context
 * is still there.
 */
export const createUnmountRelease = (release: { gone(): void }, forceContextLoss: () => void) => {
  let pending: Array<ReturnType<typeof setTimeout>> = []
  return {
    mounted: (): void => {
      for (const timer of pending) clearTimeout(timer)
      pending = []
    },
    unmounted: (): void => {
      pending = [
        setTimeout(() => release.gone(), 0),
        setTimeout(forceContextLoss, RELEASE_FALLBACK_MS),
      ]
    },
  }
}
