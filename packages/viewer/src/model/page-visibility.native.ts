/**
 * React Native's `model/page-visibility.ts`: there is no document. A backgrounded app gets no
 * animation frames, so a move already waits while it is away.
 */
export const pageHidden = (): boolean => false

export const watchPageVisibility =
  (_listener: () => void): (() => void) =>
  () => {}
