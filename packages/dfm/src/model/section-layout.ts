import { runStart, type ReachCurve } from './reach.js'

/*
 * The section drawing's measurements are drawing pixels: CSS pixels on the
 * web, points on React Native.
 */

/**
 * The drawing's type sizes. The layout's width guesses — `READ_CHAR_PX`,
 * `HEADING_CHAR_PX`, `AXIS_LABEL_HALF_PX` — are made at these sizes, so a
 * view that draws the section sets its text at them.
 */
export const SECTION_TYPE = { heading: 9, label: 10, reading: 11 } as const

/**
 * Where the drawing's labels sit against what they label. "Above" and "below"
 * are up and down the drawing from the line or edge named.
 */
export const SECTION_LABEL = {
  /** The headings' baseline, above the drawing's top. */
  headingAbove: 8,
  /** `depth`, in from the drawing's left and above the feature's top. */
  depthInset: 4,
  depthAbove: 4,
  /** A height's label, right of the datum; its baseline below its line, to centre a label on it. */
  heightInset: 4,
  heightBaseline: 3.5,
  /** The read run's dimension line, the end of its extension line, and its text, above the ordinates. */
  runAbove: 8,
  runEndAbove: 4,
  runTextAbove: 11,
  /** An offset's tick runs below the ordinate line, its label below that, then the axis heading. */
  tickBelow: 4,
  offsetBelow: 15,
  axisBelow: 32,
  /** The reading's baseline, below the drawing's top. */
  readingBelow: 14,
  /** The heights' datum line, right of the walls. */
  datumRight: 8,
  /** The offsets' ordinate line, below the floor. */
  ordinatesBelow: 22,
  /** An offset's extension line starts this far below the step it measures. */
  extensionGap: 2,
  /** A height's extension line starts this far inside the wall it measures. */
  leaderOverlap: 2,
} as const

/** Room around the section for its dimensions. */
export const SECTION_PAD = { left: 12, right: 64, top: 24, bottom: 62 } as const
export const SECTION_MAX_H = 380
export const SECTION_MIN_H = 120
/**
 * How much of the drawing's width the feature takes, left of the wall, when
 * its width is not known: near half, so the wall sits about in the middle.
 */
export const FEATURE_SHARE = 0.4
/**
 * Bounds on that share when the feature is drawn to its own width. Narrower
 * than the least it would be a line; wider than the most it would crowd out
 * the walls, so it is broken off at the left instead, as the walls are at the
 * right.
 */
export const FEATURE_SHARE_MIN = 0.06
export const FEATURE_SHARE_MAX = 0.6
/** The least room between two dimension labels on one line. */
export const LABEL_GAP_X = 40
export const LABEL_GAP_Y = 14
/**
 * The least room between the wall's 0 and an offset's label beside it: half
 * a label and the 0, which is one character, with a little air.
 */
export const WALL_LABEL_GAP_X = 30
/*
 * The three widths below are estimates for a sans-serif face at the
 * `SECTION_TYPE` sizes, not measurements: they keep text inside the drawing
 * without measuring it, on the web and on React Native alike.
 */
/** A rough width per character of the 11 px reading, to keep it inside the drawing. */
export const READ_CHAR_PX = 6.4
/** A rough width per character of the 9 px bold headings, to keep them inside the drawing. */
export const HEADING_CHAR_PX = 6.5
/** How far the reading sits from the pointer's line, and from the drawing's edges. */
export const READ_INSET = 8
/** Half the width of the offsets' axis label at 9 px, to hold it inside the drawing. */
export const AXIS_LABEL_HALF_PX = 84
/** How thick the floor strip under the drawing is. */
export const FLOOR_STRIP = 6
/** The least width of the feature for "depth" to be written over its top. */
export const DEPTH_WORD_PX = 34
/** How far apart the teeth of a break are, and how far each sways. */
const BREAK_STEP = 8
const BREAK_SWAY = 3

/** Each place the material steps up: where, from what height, to what. */
export interface Riser {
  at: number
  from: number
  to: number
}

export const risersOf = (curve: ReachCurve): Riser[] => {
  const risers: Riser[] = []
  let level = 0
  curve.heights.forEach((height, index) => {
    if (height > level) risers.push({ at: runStart(curve, index), from: level, to: height })
    level = Math.max(level, height)
  })
  return risers
}

/**
 * Of labels along one line, those that fit: in order, each kept clear of the
 * one before by `gap`, and the last always kept, in place of the one before
 * it if they crowd.
 */
export const spaced = <T>(items: readonly T[], position: (item: T) => number, gap: number): T[] => {
  const kept: T[] = []
  items.forEach((item, index) => {
    const last = kept[kept.length - 1]
    const clear = last === undefined || Math.abs(position(item) - position(last)) >= gap
    if (clear) kept.push(item)
    else if (index === items.length - 1) kept[kept.length - 1] = item
  })
  return kept
}

/** How many teeth a break between `top` and `bottom` has: one each {@link BREAK_STEP}, at least two. */
const breakSteps = (top: number, bottom: number): number =>
  Math.max(2, Math.round((bottom - top) / BREAK_STEP))

/** A zigzag down the left edge, from `top` to `bottom`: the feature broken off where the drawing ends. */
export const featureBreak = (left: number, top: number, bottom: number): string => {
  const steps = breakSteps(top, bottom)
  let path = `M ${left} ${top}`
  for (let step = 1; step <= steps; step += 1) {
    const sway = step === steps ? 0 : step % 2 === 1 ? BREAK_SWAY : -BREAK_SWAY
    path += ` L ${left + sway} ${top + ((bottom - top) * step) / steps}`
  }
  return path
}

/** The teeth of a break down the right edge, from `top` to `bottom`, as path segments: the walls cut off. */
export const wallBreak = (right: number, top: number, bottom: number): string => {
  const steps = breakSteps(top, bottom)
  let path = ''
  for (let step = 1; step < steps; step += 1) {
    const sway = step % 2 === 1 ? -BREAK_SWAY : BREAK_SWAY
    path += ` L ${right + sway} ${top + ((bottom - top) * step) / steps}`
  }
  return path
}
