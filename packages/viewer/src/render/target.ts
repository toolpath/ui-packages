/**
 * The orbit target made briefly visible.
 *
 * The pivot is the one thing the viewport moves about and never shows. It is
 * also the one thing that moves without being dragged: zooming to the cursor
 * walks it, a double click re-aims it, Fit puts it back. So "why did the part
 * swing that way" has an answer the screen has never given.
 *
 * It is an aid rather than furniture, which is why it is measured in time as
 * well as in pixels — up while a gesture is running, a flash when the pivot
 * moves on its own, and gone otherwise. A marker that stayed would be a dot in
 * the middle of every screenshot.
 */

/** Radius of the solid centre dot, in CSS pixels. */
export const ORBIT_TARGET_PIXELS = 3

/** Outer radius of the ring around it, in CSS pixels. */
export const ORBIT_TARGET_RING_PIXELS = 14

/** The ring's thickness, as a fraction of its outer radius. */
export const ORBIT_TARGET_RING_WIDTH = 0.16

/**
 * A dot inside a ring, rather than the legacy viewer's two nested spheres.
 *
 * Legacy paired a depth-tested outer ball with a dot drawn over everything, so
 * the part burying the ball said the pivot was inside the material
 * (`use-target.ts:10-25`). Rendered against a real part that reads as a fault
 * rather than as a signal: a pivot sitting *on* a surface — which is exactly
 * what a double-click re-target produces, and the commonest case there is —
 * cuts the sphere in half, leaving a lens-shaped smudge with the dot off to one
 * side of it. The depth it was reporting is a question almost nobody asks; that
 * it looked broken is something everybody would see.
 *
 * A billboarded ring is the same marker with the ambiguity taken out. It is the
 * same shape at every pose, over any surface, and it is what a viewport
 * reticle looks like everywhere else.
 */
export const ORBIT_TARGET_COLOR = 0x3c4051
export const ORBIT_TARGET_RING_COLOR = 0x6bb0b3

/** A ring is a hint about where, not a second dot. */
export const ORBIT_TARGET_RING_OPACITY = 0.9

/**
 * Both colours are the package's own rather than {@link ViewerTheme} roles.
 *
 * Adding a required field to that interface is a breaking type change for
 * anybody who builds a whole theme by hand, which is a steep price for an aid
 * that is off by default and on screen for about a second at a time. They are
 * palette colours already in use — the slate the cube labels and the section
 * handle outline take, and the teal that outlines a section cut — so the marker
 * reads as part of the control family rather than as something imported. If a
 * consumer asks to re-colour it, the roles go in at the next major and nothing
 * about this module's shape changes.
 */

/**
 * How long the marker stays at full strength after the pivot moves on its own,
 * in milliseconds. Legacy's (`use-target.ts:96`).
 */
export const ORBIT_TARGET_FLASH_MS = 100

/**
 * How long it takes to fade once nothing is holding it up, in milliseconds.
 *
 * Legacy faded in twenty steps of 0.05 on a 50 ms timer, which is this number
 * arrived at the long way round (`use-target.ts:79-87`). Long enough that
 * letting go of an orbit does not make the marker vanish before the eye finds
 * it, short enough that it is gone before anybody wonders what it is.
 */
export const ORBIT_TARGET_FADE_MS = 1000

/**
 * How visible the marker is, `sinceHold` milliseconds after the last thing
 * holding it up let go.
 *
 * Linear, and negative input means something still is — a drag in progress, or
 * a flash inside its window — so the caller can pass one number rather than
 * branching on which of the two it is.
 *
 * Pure because the fade has to be driven from a frame rather than a timer:
 * this viewer renders on demand, so a `setInterval` writing an opacity would
 * change the material and never repaint it. The curve therefore has to be
 * something a frame can ask for the value of, at whatever moment it runs.
 */
export function orbitTargetOpacity(sinceHold: number, fade: number = ORBIT_TARGET_FADE_MS): number {
  if (sinceHold <= 0) return 1
  if (fade <= 0 || sinceHold >= fade) return 0

  return 1 - sinceHold / fade
}
