import type { Material, Object3D, Texture } from 'three'

/**
 * The GPU side of React Native's frame, without React or expo-gl: how a frame
 * reaches the screen, and how everything a canvas holds on the GPU is freed.
 * `viewer-frame.native.tsx` wires these to fiber and expo-gl.
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
 * that order; called again, it does nothing.
 */
export const createRelease = ({ gl, scene, destroy, stopPresenting }: Release): (() => void) => {
  let released = false
  return () => {
    if (released) return
    released = true
    stopPresenting()
    disposeTree(scene)
    gl.dispose()
    destroy()
  }
}

const isTexture = (value: unknown): value is Texture =>
  (value as Texture | null | undefined)?.isTexture === true

/** Disposes every geometry, material and texture under `root`, and any render target a material samples. */
export const disposeTree = (root: Object3D): void => {
  root.traverse((object) => {
    const { geometry, material } = object as Object3D & {
      geometry?: { dispose(): void }
      material?: Material | Material[]
    }
    geometry?.dispose()
    for (const each of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(each)) {
        if (isTexture(value)) value.dispose()
      }
      const uniforms = (each as Material & { uniforms?: Record<string, { value: unknown }> })
        .uniforms
      for (const uniform of Object.values(uniforms ?? {})) {
        if (isTexture(uniform.value)) uniform.value.dispose()
      }
      each.dispose()
    }
  })
}
