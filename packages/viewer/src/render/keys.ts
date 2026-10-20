/**
 * Keyboard listening on the window, behind one seam.
 *
 * A browser has a window to listen on. React Native has neither the window nor
 * keyboard events of this kind, and its build swaps in `keys.native.ts`, which
 * listens to nothing; the components ask for keys through this one function
 * rather than reaching for `window` themselves.
 */

/** Adds a `keydown` listener to the window, and returns the function that removes it. */
export function onWindowKeydown(handler: (event: KeyboardEvent) => void): () => void {
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
