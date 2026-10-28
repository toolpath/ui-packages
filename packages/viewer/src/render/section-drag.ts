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
 * Calls `onEnd` when `element` loses the capture of pointer `pointerId` or that
 * pointer is cancelled, and returns the function that stops listening.
 *
 * Only the dragging pointer counts: on touch every finger is captured to the
 * canvas, so a second finger or a resting palm lifting mid-drag must not end it.
 */
export function endOnRelease(element: Listening, pointerId: number, onEnd: () => void): () => void {
  const onRelease = (event: Event) => {
    if ((event as PointerEvent).pointerId === pointerId) onEnd()
  }
  element.addEventListener('lostpointercapture', onRelease)
  element.addEventListener('pointercancel', onRelease)
  return () => {
    element.removeEventListener('lostpointercapture', onRelease)
    element.removeEventListener('pointercancel', onRelease)
  }
}
