/**
 * React Native's `render/pointer-hover.ts`. A finger doesn't hover: it moves
 * only while it is down, orbiting or pinching, when no face should light up.
 * A hover listener would still cost a raycast through the whole part on every
 * touch move, and Hermes, which has no JIT, took long enough over the sample
 * part's 54,000 triangles to leave the camera trailing the fingers. So the part
 * has none here.
 */
export const POINTER_HOVER = false
