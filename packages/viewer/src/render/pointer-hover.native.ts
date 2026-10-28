/**
 * React Native's `render/pointer-hover.ts`. A finger doesn't hover: it moves
 * only while it is down, orbiting or pinching, when no face should light up.
 * A hover listener would still cost a raycast on every touch move, which is
 * work per touch event that Hermes can't afford (see `render/part-picking.native.ts`).
 * So the part has none here.
 */
export const POINTER_HOVER = false
