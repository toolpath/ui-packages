import { MM_PER_INCH } from '@toolpath/tool-support'

import type { FeatureSheet, FeatureSheets } from './feature-sheet.js'
import { featureTypeLabel, type DfmFeature } from './geometry.js'
import { LENGTH_PLACES, unitLabel, type Units } from './units.js'

/*
 * A feature list, one row per set of faces.
 *
 * The Engine reports one set of faces once per reading — the floor of a pocket
 * is a `face` and part of the `pocket` — so a list of features as reported
 * shows the same faces several times. Within one machining direction, the
 * readings of the same faces make one row here, shown as the most specific of
 * them. A `profile` is the boundary traced around the part, not a surface
 * anyone machines, and is left out.
 *
 * Which direction a feature is in, and how specific a type is, are the
 * viewer's to say (`directionIndexOf` and `featureTypeRank` in
 * `@toolpath/viewer`), so they are inputs: this package does not depend on the
 * viewer, and a second copy of either table would drift from the first.
 */

type Direction = DfmFeature['machiningDirection']

/** A feature's size: across the tool, largest first, and along it. Millimetres. */
export interface FeatureExtent {
  readonly across: readonly [number, number]
  readonly along: number
}

export interface FeatureRowsOptions {
  /**
   * The index of a machining direction among the part's candidates, or `-1`
   * off them all — `(d) => directionIndexOf(model, d)` with the viewer.
   */
  readonly directionOf: (direction: Direction) => number
  /**
   * How specific a feature type is, lower first — the viewer's
   * `featureTypeRank`. The row shows its lowest-ranked reading, and rows sort
   * by it.
   */
  readonly typeRank: (featureType: string) => number
  /** List one direction's rows only. `null` or left out lists every direction. */
  readonly direction?: number | null
  /** A region's area in mm², for ordering rows of one rank. Left out, every area is 0. */
  readonly areaOf?: (regionIdx: number) => number
  /** Datasheets by lower-cased tag, for each row's bore and depth. */
  readonly sheets?: FeatureSheets
  /**
   * A feature's plan size, which no datasheet states — `featureExtent` in
   * `@toolpath/viewer` measures it from the mesh. Left out, a row's
   * measurement uses the datasheet only.
   */
  readonly extentOf?: (feature: DfmFeature) => FeatureExtent | null
  /** The unit `measure` is written in. Millimetres by default. */
  readonly units?: Units
}

/** One set of faces in one direction, under its most specific reading. */
export interface FeatureRow {
  /** The reading shown, and what choosing the row selects. */
  readonly tag: string
  /** Every reading of these faces in this direction, the shown one first. */
  readonly tags: readonly string[]
  readonly feature: DfmFeature
  /** `directionOf` the feature's machining direction: `-1` off the candidates. */
  readonly direction: number
  /** `Blind hole`. */
  readonly label: string
  /** `⌀10 mm × 15 deep`, `40 × 40 mm, 15 deep`, or `null` when nothing was measured. */
  readonly measure: string | null
  /** The area of its faces, by `areaOf`. */
  readonly area: number
}

const facesKey = (regionIdxs: readonly number[]): string =>
  [...regionIdxs].sort((a, b) => a - b).join(',')

const byTag = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The rows, sorted: listing every direction, a direction at a time in
 * candidate order with any off the candidates last; within one, by type rank,
 * then area, largest first, then tag.
 */
export const featureRows = (
  features: readonly DfmFeature[],
  options: FeatureRowsOptions,
): FeatureRow[] => {
  const { directionOf, typeRank, direction = null, areaOf, sheets, extentOf } = options
  const units = options.units ?? 'mm'

  const groups = new Map<string, { index: number; readings: DfmFeature[] }>()
  for (const feature of features) {
    if (feature.featureType === 'profile') continue
    const index = directionOf(feature.machiningDirection)
    if (direction !== null && index !== direction) continue
    const key = `${index}|${facesKey(feature.regionIdxs)}`
    const group = groups.get(key)
    if (group) group.readings.push(feature)
    else groups.set(key, { index, readings: [feature] })
  }

  const rows: FeatureRow[] = []
  for (const { index, readings } of groups.values()) {
    const sorted = [...readings].sort(
      (a, b) => typeRank(a.featureType) - typeRank(b.featureType) || byTag(a.tag, b.tag),
    )
    const shown = sorted[0]
    if (!shown) continue
    rows.push({
      tag: shown.tag,
      tags: sorted.map((feature) => feature.tag),
      feature: shown,
      direction: index,
      label: featureTypeLabel(shown.featureType),
      measure: featureMeasure(
        shown.featureType,
        sheets?.[shown.tag.toLowerCase()],
        extentOf?.(shown) ?? null,
        units,
      ),
      area: areaOf ? shown.regionIdxs.reduce((sum, idx) => sum + areaOf(idx), 0) : 0,
    })
  }

  const directionOrder = (d: number) => (d < 0 ? Number.MAX_SAFE_INTEGER : d)
  return rows.sort(
    (a, b) =>
      directionOrder(a.direction) - directionOrder(b.direction) ||
      typeRank(a.feature.featureType) - typeRank(b.feature.featureType) ||
      b.area - a.area ||
      byTag(a.tag, b.tag),
  )
}

/** Below this a length is not a size: a flat face has no depth. Millimetres. */
const EPS_MM = 0.01

/**
 * One short measurement. A hole: bore and depth. Anything with a depth and a
 * plan size: `a × b mm, d deep`. A face: its plan size. A wall: length and
 * height.
 */
const featureMeasure = (
  featureType: string,
  sheet: FeatureSheet | undefined,
  extent: FeatureExtent | null,
  units: Units,
): string | null => {
  const n = (mm: number): string =>
    String(Number((units === 'inch' ? mm / MM_PER_INCH : mm).toFixed(LENGTH_PLACES[units])))
  const unit = unitLabel(units)

  const fromSheet =
    sheet?.zMax !== undefined && sheet.zMin !== undefined ? sheet.zMax - sheet.zMin : null
  const depth = fromSheet ?? extent?.along ?? null
  const deep = depth !== null && depth > EPS_MM ? depth : null
  const through = featureType.includes('through')
  const depthWord = through ? 'through' : 'deep'

  if (sheet?.diameter !== undefined && sheet.diameter > 0) {
    const bore = `⌀${n(sheet.diameter)} ${unit}`
    if (deep === null) return through ? `${bore} through` : bore
    return `${bore} × ${n(deep)} ${depthWord}`
  }

  const plan = (extent?.across ?? []).filter((v) => v > EPS_MM)
  if (featureType === 'wall') {
    const [length] = plan
    if (deep === null) return null
    return length === undefined
      ? `${n(deep)} ${unit} high`
      : `${n(length)} ${unit} × ${n(deep)} high`
  }
  const size = plan.length > 0 ? `${plan.map(n).join(' × ')} ${unit}` : null
  if (deep === null) return size
  return size ? `${size}, ${n(deep)} ${depthWord}` : `${n(deep)} ${unit} ${depthWord}`
}
