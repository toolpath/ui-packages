/**
 * A feature's reach curve (the datasheet's `reachCurve`, API 1.12.1): how
 * high the material around a feature stands, by how far out from it.
 *
 * As the API defines it: material within `horizontalOffset[i]` of the
 * feature rises to `verticalOffset[i]` above it. Both lists ascend, the
 * curve is a step that never falls, and past its last knot it holds. So the
 * rise comes at the *start* of each run, not at its knot: between two knots
 * the material could stand anywhere out to the next one, and the next one's
 * height is the bound — as the tool catalog's sweep reads it
 * (`@toolpath/tool-support` `heightAt`), so a stack clears here where it
 * clears there. Offsets
 * are measured from the feature — zero is the wall of the cut — so material
 * at offset `d` meets a tool at radius `d` plus the cutter's radius. Each
 * reading is the worst case over the whole feature, with no direction to it.
 *
 * Millimetres throughout.
 */

import type { FeatureSheet } from './feature-sheet.js'

export interface ReachCurve {
  /** Outward from the feature's wall, ascending. */
  offsets: readonly number[]
  /** How high the material within each offset rises above the feature, ascending. */
  heights: readonly number[]
}

const numbers = (value: unknown): number[] | null =>
  Array.isArray(value) && value.every((each) => typeof each === 'number' && Number.isFinite(each))
    ? (value as number[])
    : null

/** A datasheet's reach curve, or null where it has none worth drawing. */
export const readReachCurve = (datasheet: unknown): ReachCurve | null => {
  const curve = (datasheet as { reachCurve?: unknown } | null)?.reachCurve as
    | { horizontalOffset?: unknown; verticalOffset?: unknown }
    | undefined
  const offsets = numbers(curve?.horizontalOffset)
  const heights = numbers(curve?.verticalOffset)
  if (!offsets || !heights || offsets.length === 0 || offsets.length !== heights.length) return null
  return { offsets, heights }
}

/** Where a knot's run starts, and so the nearest its material may stand: just past the knot before. */
export const runStart = ({ offsets }: ReachCurve, index: number): number =>
  index === 0 ? 0 : (offsets[index - 1] ?? 0)

/** The tallest the material stands anywhere the curve reaches. */
export const peakHeight = ({ heights }: ReachCurve): number => Math.max(0, ...heights)

/**
 * How far past the material's full height the drawings follow the curve, mm:
 * half an inch. The Engine reads the curve a long way out (four inches,
 * say), and once the material is at its full height there is nothing more
 * to see.
 */
export const TAIL_MM = 12.7

/**
 * Nearer the peak than this, a reading is at full height: a share of the
 * peak, and never under a twentieth of a millimetre. The Engine's readings
 * far out can creep up by a hair, and a hair is no rise to draw out to.
 */
const peakSlack = (peak: number): number => Math.max(0.05, peak * 0.01)

/**
 * Where the material first reaches its full height: the start of the first
 * run as tall as the peak, give or take {@link peakSlack}.
 */
export const peakStart = (curve: ReachCurve): number => {
  const peak = peakHeight(curve)
  const slack = peakSlack(peak)
  const index = curve.heights.findIndex((height) => height >= peak - slack)
  return runStart(curve, index === -1 ? 0 : index)
}

/**
 * The curve as the drawings show it: whole, where it keeps rising nearly to
 * its end, and otherwise cut off {@link TAIL_MM} past where it reaches its
 * full height, the height there held to the cut. `cut` says which, so the
 * drawing can mark the break.
 */
export const trimmedCurve = (curve: ReachCurve): { curve: ReachCurve; cut: boolean } => {
  const last = curve.offsets[curve.offsets.length - 1] ?? 0
  const extent = peakStart(curve) + TAIL_MM
  if (extent >= last) return { curve, cut: false }
  // The first knot at or past the cut: its run is the one the cut falls in, so its height holds there.
  const keep = curve.offsets.findIndex((offset) => offset >= extent)
  return {
    curve: {
      offsets: [...curve.offsets.slice(0, keep), extent],
      heights: curve.heights.slice(0, keep + 1),
    },
    cut: true,
  }
}

/** How wide the feature itself is, across the tool, and what that width is. */
export interface FeatureAcross {
  width: number
  /** A hole's bore, or a milled feature's tightest clearance (its smallest pinch disc). */
  kind: 'diameter' | 'clearance'
}

/**
 * The feature's own width, to draw it to scale beside its walls: a hole's
 * diameter, else the tightest clearance the tool has between its walls. Null
 * where the sheet has neither, as for a contour surface or a sharp corner.
 */
export const featureAcross = (sheet: FeatureSheet | undefined): FeatureAcross | null => {
  if (sheet?.diameter !== undefined && sheet.diameter > 0)
    return { width: sheet.diameter, kind: 'diameter' }
  if (sheet?.pinchDiameter !== undefined && sheet.pinchDiameter > 0)
    return { width: sheet.pinchDiameter, kind: 'clearance' }
  return null
}

/** The feature as the reach section draws it, left of its wall. */
export interface FeatureProfile {
  /** Its width, to draw it to scale; null draws it at a set share. */
  across: FeatureAcross | null
  /** Its own depth, top to bottom (`zMax − zMin`), over the same floor the curve stands on. */
  depth: number | null
  /** It runs out through the part, so there is no floor under it. */
  through: boolean
}

/** `through_hole`, `threaded_through_hole`, `through_pocket` and the like: the Engine says so in the type. */
export const isThroughType = (featureType: string): boolean =>
  /(^|_)through(_|$)/.test(featureType.toLowerCase())

export const featureProfile = (
  sheet: FeatureSheet | undefined,
  featureType: string,
): FeatureProfile => {
  const depth =
    sheet?.zMax !== undefined && sheet.zMin !== undefined ? sheet.zMax - sheet.zMin : null
  return {
    across: featureAcross(sheet),
    depth: depth !== null && depth > 0 ? depth : null,
    through: isThroughType(featureType),
  }
}
