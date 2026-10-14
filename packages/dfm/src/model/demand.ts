import type { FeatureDemand } from '@toolpath/tool-support'

import type { FeatureSheets } from './feature-sheet.js'
import { partTop, type DfmFeature } from './geometry.js'
import type { ReachCurve } from './reach.js'

/** Only a figure above zero is a limit: a zero or a missing one states nothing. */
const positive = (value: number | undefined): number | undefined =>
  value !== undefined && value > 0 ? value : undefined

/**
 * What a feature asks of a tool, in millimetres: the half of tool fitting
 * `@toolpath/tool-support` leaves to whoever holds the report. Hand it to
 * `fitTools` / `fitAgainst` to filter a tool library to the selected feature.
 *
 * Read off the feature's sheet (`featureSheet`) in the Engine's own
 * terms, so every exclusion can be checked against the datasheet the feature
 * panel shows:
 *
 * - `maxToolDiameter` — the widest cutter that reaches every point (the cutter
 *   band's `ignore.min`; a chamfer's under its three-axis reading).
 * - `sharpCorners`, with `maxToolSomewhere` — where the sheet reads its inside
 *   corners as sharp (`FeatureSheet.sharpCorners`: walls, and a corner
 *   clearance that runs back to no radius once the Engine's tolerance is taken
 *   out). `maxToolDiameter` is then only the tolerance's reading of a corner
 *   with no room in it — 0.012 mm in a 40 mm pocket — so the fit says each
 *   end mill misses the *corners*, by its own radius, and the band's
 *   `ignore.max` still bounds how wide a tool gets in at all.
 * - `maxDrillDiameter`, `maxEndmillDiameter`, `holeDiameter` — a hole's.
 * - `depth` — `zMax − zMin`.
 * - `reachBelowTop` — the part's top along the machining direction (see
 *   `partTop`) less `zMin`.
 * - `floorRadius` — the floor fillet.
 * - `reachCurve` — the curve given, in the tool package's terms.
 *
 * **A field the sheet does not state is left out, never sent as zero**: a zero
 * limit would rule out every tool, and a missing one is simply not checked.
 * A zero or negative reading is left out the same way.
 *
 * Kept in line with the catalog's `demandOf` (toolpath-template
 * `packages/catalog-data/src/fit.ts`), so a tool list filtered here and one
 * filtered there agree. That is why a contour surface's `toolFit`, which has
 * no cutter band, states no limit: `demandOf` does not read it either.
 *
 * Takes the whole part, as `featureMeasurements` does, because the reach
 * is measured from the part's top, which only the other features say. An
 * options object rather than positional arguments, so `features.map(…)` cannot
 * hand it an index. The reach curve is passed in already read
 * (`readReachCurve(datasheet)`) because a sheet does not carry it.
 */
export const featureDemand = ({
  features,
  feature,
  sheets,
  reachCurve,
}: {
  features: readonly DfmFeature[]
  feature: DfmFeature
  sheets: FeatureSheets
  /** The feature's reach curve, from `readReachCurve`; without it, no collision is checked. */
  reachCurve?: ReachCurve | null
}): FeatureDemand => {
  const sheet = sheets[feature.tag.toLowerCase()]
  const demand: { -readonly [K in keyof FeatureDemand]: FeatureDemand[K] } = {
    featureTag: feature.tag,
  }
  if (reachCurve)
    demand.reachCurve = { horizontalOffset: reachCurve.offsets, verticalOffset: reachCurve.heights }
  if (!sheet) return demand

  const maxTool = positive(sheet.maxTool)
  if (maxTool !== undefined) demand.maxToolDiameter = maxTool

  // The catalog's `hasSharpCorner` asks the same of the Engine (a zero
  // `terminalCornerRadius` and a zero `cd.ignore.min`), but reads the band as
  // sent, so a corner the tolerance widens to 0.012 mm escapes it. The sheet's
  // reading takes the tolerance out, and is the one the DFM rules flag.
  if (sheet.sharpCorners) {
    demand.sharpCorners = true
    const room = positive(sheet.maxToolSomewhere)
    if (room !== undefined) demand.maxToolSomewhere = room
  }

  if (sheet.kind === 'Hole') {
    const drill = positive(sheet.maxDrill)
    const endmill = positive(sheet.maxEndmill)
    const bore = positive(sheet.diameter)
    if (drill !== undefined) demand.maxDrillDiameter = drill
    if (endmill !== undefined) demand.maxEndmillDiameter = endmill
    if (bore !== undefined) demand.holeDiameter = bore
  }

  const { zMin, zMax } = sheet
  if (zMin !== undefined && zMax !== undefined && zMax > zMin) demand.depth = zMax - zMin

  const top = partTop(features, sheets, feature.machiningDirection)
  if (top !== null && zMin !== undefined && top > zMin) demand.reachBelowTop = top - zMin

  const floorRadius = positive(sheet.filletRadius)
  if (floorRadius !== undefined) demand.floorRadius = floorRadius

  return demand
}
