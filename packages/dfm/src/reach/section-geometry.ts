import {
  peakHeight,
  runStart,
  trimmedCurve,
  type FeatureProfile,
  type ReachCurve,
} from '../model/reach.js'
import {
  FEATURE_SHARE,
  FEATURE_SHARE_MAX,
  FEATURE_SHARE_MIN,
  FLOOR_STRIP,
  HEADING_CHAR_PX,
  LABEL_GAP_X,
  LABEL_GAP_Y,
  SECTION_MAX_H,
  SECTION_MIN_H,
  SECTION_PAD,
  risersOf,
  spaced,
  wallBreak,
  WALL_LABEL_GAP_X,
  type Riser,
} from './section-layout.js'

/**
 * Where everything in the section goes, worked out once from the curve, the
 * feature and the width: the scale, the datums, the material's outline and
 * the dimensions that fit. No React; the drawing only reads it.
 */
export interface SectionGeometry {
  /** The curve as drawn, and whether it was cut off past full height. */
  curve: ReachCurve
  cut: boolean
  /** The last offset drawn, mm. */
  last: number
  width: number
  height: number
  /** CSS pixels per millimetre. */
  scale: number
  /** The offset, mm, at the drawing's left edge: negative, inside the feature. */
  x0: number
  /** An offset from the wall, mm, as a position across the drawing. */
  x: (mm: number) => number
  /** A height above the floor, mm, as a position down the drawing. */
  y: (mm: number) => number
  /** The floor's datum, along the bottom of the plot. */
  floorY: number
  /** Where the walls end on the right. */
  right: number
  /** The material, out to the right edge; a broken edge where the curve was cut. */
  materialPath: string
  /** The steps out from the wall that have room for a label beneath, clear of the wall's own 0. */
  across: Riser[]
  /** The walls' heights that have room for a label on the right. */
  up: number[]
  feature: FeatureProfile
  /** Wider than the drawing gives it: broken off at the left. */
  featureCut: boolean
  /** The feature's heading, and where its middle sits: over the feature, held inside the drawing. */
  featureHeading: string
  featureHeadingX: number
  /** The feature's top, where its depth is known; else the top of the drawing. */
  featureTopY: number
  /** A through feature runs on down through the floor strip, with no floor of its own. */
  featureBottomY: number
  /** The wall of the cut: the feature's edge, from its floor up to the first material. */
  wallTop: number
  /** Where the heights' labels start, right of the walls. */
  datumX: number
  /** Where the offsets' labels sit, under the floor. */
  ordinateY: number
}

const materialPath = (
  curve: ReachCurve,
  cut: boolean,
  x: (mm: number) => number,
  y: (mm: number) => number,
  floorY: number,
  right: number,
): string => {
  let path = `M ${x(0)} ${floorY}`
  let level = 0
  curve.offsets.forEach((offset, index) => {
    level = curve.heights[index] ?? 0
    path += ` L ${x(runStart(curve, index))} ${y(level)} L ${Math.min(x(offset), right)} ${y(level)}`
  })
  path += ` L ${right} ${y(level)}`
  if (cut) path += wallBreak(right, y(level), floorY)
  return `${path} L ${right} ${floorY} Z`
}

/**
 * The feature to scale where its width is known: its share of the drawing is
 * its width over its width and the walls'. Too wide, it is broken off.
 */
const featureShare = (feature: FeatureProfile, x1: number): { share: number; cut: boolean } => {
  const trueShare = feature.across
    ? feature.across.width / (feature.across.width + x1)
    : FEATURE_SHARE
  return {
    share: Math.min(Math.max(trueShare, FEATURE_SHARE_MIN), FEATURE_SHARE_MAX),
    cut: feature.across !== null && trueShare > FEATURE_SHARE_MAX,
  }
}

/**
 * The scale, CSS pixels per mm, that fits the plot's span across the width;
 * smaller where the plot would stand taller than its most, and the plot's
 * height, held to its least.
 */
const plotScale = (width: number, spanMm: number, topMm: number) => {
  const fitted = (width - SECTION_PAD.left - SECTION_PAD.right) / spanMm
  if (topMm * fitted > SECTION_MAX_H) return { scale: SECTION_MAX_H / topMm, plotH: SECTION_MAX_H }
  return { scale: fitted, plotH: Math.max(topMm * fitted, SECTION_MIN_H) }
}

/** The walls' heights that have room for a label, less any the feature's depth would land on: its label wins the spot. */
const heightLabels = (
  risers: readonly Riser[],
  depth: number | null,
  y: (mm: number) => number,
): number[] =>
  spaced(
    [...new Set(risers.map((riser) => riser.to))].sort((a, b) => a - b),
    (h) => -y(h),
    LABEL_GAP_Y,
  ).filter((h) => depth === null || Math.abs(y(h) - y(depth)) >= LABEL_GAP_Y)

/**
 * The steps out from the wall that have room for a label beneath: clear of
 * one another, and of the wall's own 0, which is always written.
 */
const offsetLabels = (risers: readonly Riser[], x: (mm: number) => number): Riser[] =>
  spaced(
    risers.filter((riser) => x(riser.at) - x(0) >= WALL_LABEL_GAP_X),
    (riser) => x(riser.at),
    LABEL_GAP_X,
  )

const headingFor = (feature: FeatureProfile): string =>
  feature.through ? 'THROUGH FEATURE' : 'FEATURE'

/**
 * The middle of the feature's heading: over the feature, unless the feature
 * is too narrow to hold it; then moved right, so it starts where the feature
 * does and is not cut off at the drawing's left edge.
 */
const headingMiddle = (heading: string, wallX: number): number =>
  Math.max(
    (SECTION_PAD.left + wallX) / 2,
    SECTION_PAD.left + (heading.length * HEADING_CHAR_PX) / 2,
  )

export const sectionGeometry = (
  whole: ReachCurve,
  feature: FeatureProfile,
  width: number,
): SectionGeometry => {
  const { curve, cut } = trimmedCurve(whole)
  const last = curve.offsets[curve.offsets.length - 1] ?? 0
  const peak = peakHeight(curve)
  const span = last > 0 ? last : Math.max(peak, 1)
  const x1 = span * 1.08
  const { share, cut: featureCut } = featureShare(feature, x1)
  const x0 = (-x1 * share) / (1 - share)
  // Tall enough for the feature's own top as well as the walls'.
  const top = Math.max(peak * 1.06, (feature.depth ?? 0) * 1.06, span * 0.08)
  const { scale, plotH } = plotScale(width, x1 - x0, top)
  const floorY = SECTION_PAD.top + plotH
  const x = (mm: number): number => SECTION_PAD.left + (mm - x0) * scale
  const y = (mm: number): number => floorY - mm * scale
  const right = Math.min(x(x1), width - SECTION_PAD.right)
  const risers = risersOf(curve)
  const { depth } = feature
  const heading = headingFor(feature)

  return {
    curve,
    cut,
    last,
    width,
    height: plotH + SECTION_PAD.top + SECTION_PAD.bottom,
    scale,
    x0,
    x,
    y,
    floorY,
    right,
    materialPath: materialPath(curve, cut, x, y, floorY, right),
    across: offsetLabels(risers, x),
    up: heightLabels(risers, depth, y),
    feature,
    featureCut,
    featureHeading: heading,
    featureHeadingX: headingMiddle(heading, x(0)),
    featureTopY: depth === null ? SECTION_PAD.top : y(depth),
    featureBottomY: feature.through ? floorY + FLOOR_STRIP : floorY,
    wallTop: y(curve.heights[0] ?? 0),
    datumX: right + 8,
    ordinateY: floorY + 22,
  }
}
