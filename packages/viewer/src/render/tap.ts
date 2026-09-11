/**
 * Telling a click apart from the end of a drag.
 *
 * The browser calls both a click: press, move, release over the same element
 * fires `click` however far the pointer travelled in between. In a viewport
 * that is the difference between "select this face" and "I have finished
 * orbiting" — and the part is one mesh, so releasing over a different face is
 * still the same element and still a click.
 *
 * Left unguarded, every orbit that happens to end over the part selects
 * whatever it ended on, throwing away the selection the orbit was made to look
 * at.
 */

/** How far a pointer may travel and still be a click, in CSS pixels. */
export const TAP_SLOP = 4

export interface TapPoint {
  readonly clientX: number
  readonly clientY: number
}

/** Whether the pointer travelled far enough for this to be a drag. */
export function movedFar(from: TapPoint, to: TapPoint, slop: number = TAP_SLOP): boolean {
  return Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY) > slop
}

export interface TapTracker {
  /** Whether the gesture ending at this event was a click rather than a drag. */
  isTap(event: TapPoint): boolean
  dispose(): void
}

/**
 * Watches an element for the start of every gesture, so its end can be judged.
 *
 * Listens in the capture phase: whatever else handles the press — the camera
 * controls, a drag handle — the start of the gesture still has to be recorded,
 * and a listener that runs after `stopPropagation` runs never.
 */
export function trackTaps(element: HTMLElement): TapTracker {
  let start: TapPoint | null = null

  const down = (event: PointerEvent) => {
    start = { clientX: event.clientX, clientY: event.clientY }
  }

  element.addEventListener('pointerdown', down, { capture: true })

  return {
    // No recorded press means the gesture began somewhere else — over a panel,
    // or before this element existed. Not a click on this element.
    isTap: (event: TapPoint) => start !== null && !movedFar(start, event),
    dispose: () => element.removeEventListener('pointerdown', down, { capture: true }),
  }
}

/**
 * How long between two presses still reads as one gesture, in milliseconds.
 *
 * The browser's own `dblclick` threshold is a platform setting and is not
 * readable from script, so a hand-paired gesture has to pick a number. 400ms is
 * inside every default and outside a deliberate pair of separate clicks.
 */
export const DOUBLE_TAP_MS = 400

export interface DoubleTapPoint extends TapPoint {
  readonly timeStamp: number
}

export interface DoubleTapTracker {
  /** Whether this press completes a double tap begun by the last one. */
  isDouble(event: DoubleTapPoint): boolean
  /**
   * Forgets the press being waited on, so the next one starts a fresh pair.
   *
   * For the caller that knows the gesture was interrupted by something this
   * has no way to see — the pointer leaving the thing being clicked, most of
   * all. Two presses either side of a trip to a panel are two clicks that
   * happen to be quick, however close together the clock puts them.
   */
  reset(): void
}

/**
 * Pairing presses into a double tap by hand.
 *
 * Needed because `dblclick` fires for the **primary button only** — there is no
 * such event for the middle button, however many times it is pressed. So a
 * middle-button gesture has to be assembled from single presses.
 *
 * Position matters as well as time: two presses at opposite corners inside the
 * window are two clicks that happened to be quick, not one gesture, and
 * treating them as a double would re-frame the view out from under somebody
 * who was doing something else. The same {@link TAP_SLOP} the click guard uses.
 *
 * A completed double clears the state rather than leaving it, so three presses
 * are one double and one single rather than two overlapping doubles.
 *
 * Time and position are all this can judge on, which is not enough on its own:
 * clicking a face, pressing something in a panel and clicking the same face
 * again is three gestures the clock cannot tell from two, and it is quick
 * enough to land inside the window. {@link DoubleTapTracker.reset} is how the
 * caller says the pair was broken by something it could see and this could not.
 */
export function trackDoubleTaps(
  within: number = DOUBLE_TAP_MS,
  slop: number = TAP_SLOP,
): DoubleTapTracker {
  let last: DoubleTapPoint | null = null

  return {
    isDouble: (event: DoubleTapPoint) => {
      const paired =
        last !== null && event.timeStamp - last.timeStamp <= within && !movedFar(last, event, slop)

      last = paired ? null : event
      return paired
    },
    reset: () => {
      last = null
    },
  }
}
