/**
 * The end of a section-handle drag the handle itself never hears about.
 *
 * A drag ends on its own `pointerup`, but the system can also take the pointer
 * away mid-drag — a notification shade, a gesture of its own — and then the
 * handle gets no `pointerup` at all. Without these the controls the drag
 * switched off would stay off.
 */
type Listening = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/**
 * Calls `onEnd` when `element` loses the pointer's capture or the pointer is
 * cancelled, and returns the function that stops listening.
 */
export function endOnRelease(element: Listening, onEnd: () => void): () => void {
  element.addEventListener('lostpointercapture', onEnd)
  element.addEventListener('pointercancel', onEnd)
  return () => {
    element.removeEventListener('lostpointercapture', onEnd)
    element.removeEventListener('pointercancel', onEnd)
  }
}
