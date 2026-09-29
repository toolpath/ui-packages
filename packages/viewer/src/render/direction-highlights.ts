import { directionIndexOf } from '../model/directions.js'
import type { PartModel } from '../model/types.js'
import type { RegionHighlight } from './paint.js'
import { featureTypeRank } from './selection.js'
import { directionColor } from './theme.js'

/**
 * A stable direction wash, optionally scoped to one candidate direction.
 * Shared faces take the most specific owner, then candidate order and tag.
 * Unknown directions remain unpainted; no invented machining direction.
 */
export function directionHighlights(
  model: PartModel,
  activeDirection: number | null = null,
): readonly RegionHighlight[] {
  const features = model.features
    .map((feature) => ({ feature, index: directionIndexOf(model, feature.machiningDirection) }))
    .filter(({ index }) => index >= 0 && (activeDirection === null || index === activeDirection))
    .sort(
      (a, b) =>
        featureTypeRank(a.feature.featureType) - featureTypeRank(b.feature.featureType) ||
        a.index - b.index ||
        (a.feature.tag < b.feature.tag ? -1 : a.feature.tag > b.feature.tag ? 1 : 0),
    )
  const colors = new Map<number, RegionHighlight>()
  for (const { feature, index } of features) {
    for (const region of model.regionIndex.regionsForFeature(feature.tag)) {
      if (!colors.has(region)) colors.set(region, { region, color: directionColor(index) })
    }
  }
  return [...colors.values()].sort((a, b) => a.region - b.region)
}
