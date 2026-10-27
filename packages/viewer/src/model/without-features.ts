import { buildRegionIndex } from './region-index.js'
import type { FeatureTag, PartModel } from './types.js'

/** A tag as a list compares it: hex in any case is one tag. */
const tagKey = (tag: string): string => tag.toLowerCase()

/**
 * The model with these features left out, as if the report had never listed them: gone from
 * `features` and from the region index, so no pick resolves to them, no direction wash paints
 * by them, and every face they shared goes to its other owners. A face only they held keeps its
 * triangles and is owned by nothing. Tags compare in any case; one the model does not hold is
 * passed over.
 *
 * For the features whose geometry the Engine says is invalid, which nothing machines:
 * `@toolpath/dfm`'s `invalidFeatureTags`. The model itself comes back when nothing is left out;
 * otherwise a new one, which `PartMesh` rebuilds its paint for, so a caller holds on to it rather
 * than calling this on every render.
 */
export function withoutFeatures(model: PartModel, tags: Iterable<FeatureTag>): PartModel {
  const left = new Set([...tags].map(tagKey))
  if (left.size === 0) return model
  const features = model.features.filter((feature) => !left.has(tagKey(feature.tag)))
  if (features.length === model.features.length) return model
  return {
    ...model,
    features,
    regionIndex: buildRegionIndex({
      regions: model.regions,
      features,
      triangleCount: model.mesh.triangleCount,
    }),
  }
}
