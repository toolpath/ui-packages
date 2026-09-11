/**
 * The optional clearance overlay: the material around a feature, drawn beside
 * the tool, with the gaps that decide whether the assembly clears it.
 *
 * A subpath of its own so a consumer that never draws a feature never pays for
 * it, and so the overlay could be added without the verdict moving: the
 * clearance *decision* is a tool-selection concern with many non-drawing
 * callers, and it stays with them. This package takes that verdict as data and
 * owns only the lines drawn from it.
 */

export type { Margins, ReachCurve } from './model/curve.js'
export { NO_MARGINS, heightAt, wallFaceAt } from './model/curve.js'
export type { AxialGap, Gap, Gaps } from './model/gaps.js'
export { tightestGaps } from './model/gaps.js'
export { clipped, lastRise, wallCorners, wallPath, zigzag } from './model/wall.js'
export type { ClearanceOverlayProps } from './render/overlay.js'
export { ClearanceOverlay } from './render/overlay.js'
export { describeGaps } from './model/describe.js'
