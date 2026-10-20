/**
 * Whether this browser will hand out a WebGL2 context — what three's renderer
 * needs. With hardware acceleration off or the GPU blocklisted, Chrome refuses
 * one and `new WebGLRenderer()` throws inside the canvas, where nothing can
 * catch it; probing first lets the viewer say so instead of going blank.
 *
 * The probe's context is released straight away: browsers cap live contexts,
 * and this one would otherwise count against the viewer's own.
 */
export const isWebGLAvailable = (): boolean => {
  if (typeof document === 'undefined') {
    return false
  }
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return context !== null
  } catch {
    return false
  }
}

let probed: boolean | undefined

/**
 * {@link isWebGLAvailable}, probed at most once per page: a browser does not
 * grow WebGL support while it is open, and a `useSyncExternalStore` snapshot
 * has to return the same value every time it is asked.
 */
export const webGLAvailableSnapshot = (): boolean => (probed ??= isWebGLAvailable())
