/** Whether the page is hidden, when a hidden tab should neither draw nor count towards a move. */
export const pageHidden = (): boolean => globalThis.document?.hidden ?? false

/** Calls `listener` as the page is hidden or shown again; returns what stops it. */
export const watchPageVisibility = (listener: () => void): (() => void) => {
  globalThis.document?.addEventListener('visibilitychange', listener)
  return () => globalThis.document?.removeEventListener('visibilitychange', listener)
}
