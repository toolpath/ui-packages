import type { Material, Object3D, Texture } from 'three'

/**
 * The GPU side of React Native's frame, without React or expo-gl: how a frame
 * reaches the screen, and how what a scene holds on the GPU is freed.
 * `viewer-frame.native.tsx` wires these to fiber in effects.
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
 * after-effect presents it, once, at the end of the frame.
 *
 * Returns its remover, which gives the context back the `endFrameEXP` it had,
 * its own or its prototype's, so installing it again presents as the first
 * install did.
 */
export const createPresenter = (
  context: PresentingContext,
  addAfterEffect: (callback: (timestamp: number) => void) => () => void,
): (() => void) => {
  const own = Object.getOwnPropertyDescriptor(context, 'endFrameEXP')
  const present = context.endFrameEXP.bind(context)
  let dirty = false
  context.endFrameEXP = () => {
    dirty = true
  }
  const removeAfterEffect = addAfterEffect(() => {
    if (!dirty) return
    dirty = false
    present()
  })
  return () => {
    removeAfterEffect()
    if (own) {
      Object.defineProperty(context, 'endFrameEXP', own)
    } else {
      delete (context as Partial<PresentingContext>).endFrameEXP
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

/**
 * When a canvas that has gone frees its scene: on the next task.
 *
 * React's StrictMode, which fiber carries into the canvas, runs every effect's
 * cleanup and then its setup again on a canvas that stays. Freed in the
 * cleanup itself, the live scene's geometry and materials would all upload
 * again; `mounted` cancels what `unmounted` set off.
 */
export const createUnmountRelease = (release: { gone(): void }) => {
  let pending: ReturnType<typeof setTimeout> | undefined
  return {
    mounted: (): void => {
      clearTimeout(pending)
      pending = undefined
    },
    unmounted: (): void => {
      pending = setTimeout(() => release.gone(), 0)
    },
  }
}
