import type { VectorLike } from '../types.js'
import { type DoubleTapPoint, type TapPoint, trackDoubleTaps } from './tap.js'

/** What the gesture rules read of a pointer event on a pickable object. */
export interface PickGestureEvent {
  readonly nativeEvent: DoubleTapPoint & {
    readonly button: number
    preventDefault: () => void
  }
  /** The ray's hit, where a double click re-aims the orbit. */
  readonly point: VectorLike
  stopPropagation: () => void
}

/** What a pickable object says about itself, read at each event. */
export interface PickGestureRules<E extends PickGestureEvent, P> {
  /** False: no hover and no pick, and the browser keeps its own menu. */
  readonly visible: boolean
  /** A tool holds the pointer, such as a `<SectionTool>`: no hover and no pick. */
  readonly engaged: boolean
  /** Whether moving across the object hovers it. Picks still work without. */
  readonly hover: boolean
  /**
   * Whether a pick claims its event: what is behind hears nothing, and a press that picks
   * nothing passes through untouched, with no orbit re-aimed. Without, every press over the
   * object is its own and still reaches what is behind.
   */
  readonly claim: boolean
  /** The pick under the event, or `null`. `doubled` says the click completed a double click. */
  readonly pick: (event: E, doubled: boolean) => P | null
  readonly onPick: (pick: P) => void
  /** The pointer moved over the object while hover is live. */
  readonly onMove: (event: E) => void
  /** The pointer left the object. */
  readonly onLeave: () => void
  /** Whether the gesture ending at this event was a click rather than a drag. */
  readonly isTap: (event: TapPoint) => boolean
  /** Re-aims the orbit, or `null` when the viewer has the gesture turned off. */
  readonly retarget: ((point: VectorLike) => void) | null
}

/**
 * The pointer rules a pickable object follows, as `<PartMesh>` and `<ExplodedPart>` share
 * them: a tool's press is not a pick, the end of an orbit is not a click, a double click is
 * reported and re-aims the orbit, and the right button is judged on release. `rules` is read
 * at each event, so the handlers keep one identity.
 */
export const createPickGestures = <E extends PickGestureEvent, P>(
  rules: () => PickGestureRules<E, P>,
) => {
  /*
   * A click is judged by what was true when the press began, not when the
   * click arrives. A tool that lets go on `pointerup` has already let go by
   * the time the browser's `click` comes — so the press that ended it reached
   * `onClick` with nothing engaged and selected the face under it.
   */
  let pressedWhileEngaged = false
  // One tracker for the life of the object: pairing is a property of the
  // pointer, not of any render.
  const doubles = trackDoubleTaps()
  const clickable = ({ visible, engaged }: PickGestureRules<E, P>): boolean =>
    visible && !engaged && !pressedWhileEngaged
  return {
    onPointerDown: () => {
      pressedWhileEngaged = rules().engaged
    },
    onPointerMove: (event: E) => {
      const now = rules()
      if (now.visible && !now.engaged && now.hover) {
        now.onMove(event)
      }
    },
    onPointerOut: () => {
      rules().onLeave()
      /*
       * The pointer leaving the object breaks the double-click pair.
       *
       * Time and distance cannot tell "clicked this face twice" from
       * "clicked it, pressed something in a panel, clicked it again" — the
       * second is three gestures and lands well inside the window, and it
       * is an ordinary way to work: read a face, act on it, read it again.
       * Without this that second click was swallowed and the view re-aimed
       * instead, which is the wrong answer twice over.
       */
      doubles.reset()
    },
    onClick: (event: E) => {
      const now = rules()
      if (!clickable(now)) {
        return
      }
      /*
       * The end of an orbit is not a request to select whatever it ended
       * over — and it usually ends over the part, since that is what was
       * being orbited.
       *
       * It breaks the double-click pair as well as being swallowed. The
       * `onPointerOut` reset cannot cover this: an orbit over a part that
       * fills the viewport never leaves the mesh, so a click, an orbit
       * released over the part, and a third click inside the double-tap
       * window of the *first* one paired those two and re-aimed the view —
       * with a whole drag in between.
       */
      if (!now.isTap(event.nativeEvent)) {
        doubles.reset()
        return
      }
      /*
       * A double click re-aims the orbit at what was clicked — and the
       * click is still a click.
       *
       * Withholding the second pick was tried and is wrong. It stops a
       * double click walking a face's readings, which is worth something,
       * but it also silently takes the gesture away from an app that had
       * given it a meaning: an editor where clicking a face puts it in and
       * clicking it again takes it out is an ordinary thing to build, and
       * this is not the layer that can tell the two apart. `doubled` on the
       * pick reports the fact and leaves the decision where the knowledge
       * is — the same bargain `modifiers` makes.
       *
       * Paired by hand rather than read off `dblclick`, which fires for the
       * primary button only after both clicks and would arrive too late to
       * mark the second one. `event.point` is this raycast's own hit, so
       * the pivot lands exactly where the pick did.
       */
      const doubled = doubles.isDouble(event.nativeEvent)
      /*
       * The pick is built **before** the re-target, and the order is load
       * bearing.
       *
       * `retarget` calls `setLookAt`, which writes the controls' *end*
       * target — and `readTarget` reads that same end value back. Re-aiming
       * first therefore handed the pick a target that was already the point
       * just clicked, so its view direction came out as
       * `camera.position - hitPoint` rather than `camera.position -
       * orbitTarget`. On a face near the edge of a framed part that is
       * degrees away from the direction the eye is actually looking along,
       * and the ranking it feeds can name a different owner than a single
       * click on the very same face.
       */
      const pick = now.pick(event, doubled)
      if (now.claim) {
        if (pick === null) {
          return
        }
        event.stopPropagation()
      }
      if (doubled && now.retarget) {
        now.retarget(event.point)
      }
      if (pick !== null) {
        now.onPick(pick)
      }
    },
    /*
     * The right button is judged on **release**, not on `contextmenu`.
     *
     * `contextmenu` fires on right *mouse-down*, so the tap guard sees a
     * gesture that has not moved yet and lets every one of them through —
     * and right-drag is how the camera pans. Every pan therefore emitted a
     * pick at the point it started from, which reads as the part answering
     * a question nobody asked.
     *
     * `pointerup` is where the gesture has actually finished and the guard
     * can do its job. `contextmenu` is left with the one thing it is still
     * needed for: suppressing the browser's own menu over geometry.
     */
    onPointerUp: (event: E) => {
      const now = rules()
      if (!clickable(now) || event.nativeEvent.button !== 2 || !now.isTap(event.nativeEvent)) {
        return
      }
      const pick = now.pick(event, false)
      if (pick === null) {
        return
      }
      if (now.claim) {
        event.stopPropagation()
      }
      now.onPick(pick)
    },
    onContextMenu: (event: E) => {
      const now = rules()
      // Only over geometry, so a right click that hits nothing still gets
      // the browser's own menu.
      if (now.visible && now.pick(event, false) !== null) {
        event.nativeEvent.preventDefault()
      }
    },
  }
}
