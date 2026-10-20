/**
 * Keyboard listeners on the window, behind one seam.
 *
 * A browser has a window to listen on. React Native has neither the window nor
 * keyboard events of this kind, so the components ask for keys through this
 * one function rather than reaching for `window` themselves.
 */
interface WindowKeyHandlers {
  keydown?: (event: KeyboardEvent) => void
  keyup?: (event: KeyboardEvent) => void
  blur?: () => void
}

/** Adds the handlers to the window, and returns the function that removes them. */
export function onWindowKeys(handlers: WindowKeyHandlers): () => void {
  const { keydown, keyup, blur } = handlers
  if (keydown) window.addEventListener('keydown', keydown)
  if (keyup) window.addEventListener('keyup', keyup)
  if (blur) window.addEventListener('blur', blur)

  return () => {
    if (keydown) window.removeEventListener('keydown', keydown)
    if (keyup) window.removeEventListener('keyup', keyup)
    if (blur) window.removeEventListener('blur', blur)
  }
}
