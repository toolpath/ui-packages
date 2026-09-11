import { PartReportFormatError } from './errors.js'
import type { FeatureTag, RegionIndex, TriangleRange } from './types.js'

/** The minimum a region must expose to be indexed. */
export interface IndexableRegion {
  readonly idx: number
  readonly triangles: TriangleRange
}

/** The minimum a feature must expose to be indexed. */
interface IndexableFeature {
  readonly tag: FeatureTag
  readonly regionIdxs: readonly number[]
}

export interface BuildRegionIndexInput {
  readonly regions: readonly IndexableRegion[]
  readonly features: readonly IndexableFeature[]
  readonly triangleCount: number
}

/**
 * Builds the `feature ↔ region ↔ triangle` index, validating the region table
 * on the way through.
 *
 * The index is three typed arrays plus two maps. Picking is a binary search
 * over region starts — no per-triangle lookup table, no material per feature,
 * and no allocation on the pointer-move path.
 *
 * Validation is deliberately strict and happens **once**, here. Regions are
 * guaranteed to tile `[0, triangleCount)` completely, so a gap, an overlap, or
 * a range past the end of the mesh means the report is broken or the report and
 * the mesh do not belong together. Failing at load turns that into one clear
 * error instead of a highlight landing on the wrong surface much later.
 *
 * Emission order is *not* validated — the regions are sorted defensively rather
 * than trusting the order they arrived in. What must hold is that the sorted
 * ranges tile the mesh.
 */
export function buildRegionIndex(input: BuildRegionIndexInput): RegionIndex {
  const { regions, features, triangleCount } = input
  const issues: string[] = []

  if (!Number.isInteger(triangleCount) || triangleCount < 0) {
    issues.push('meshTriangleCount must be a non-negative integer')
  }

  const byIdx = new Map<number, IndexableRegion>()
  for (const region of regions) {
    const { idx, triangles } = region
    if (!Number.isInteger(idx) || idx < 0) {
      issues.push(`region idx ${idx} is not a non-negative integer`)
      continue
    }
    if (byIdx.has(idx)) {
      issues.push(`region idx ${idx} appears more than once`)
      continue
    }
    if (
      !Number.isInteger(triangles.start) ||
      !Number.isInteger(triangles.end) ||
      triangles.start < 0 ||
      triangles.end < triangles.start
    ) {
      issues.push(
        `region ${idx} has an invalid triangle range [${triangles.start}, ${triangles.end})`,
      )
      continue
    }
    if (triangles.end > triangleCount) {
      issues.push(
        `region ${idx} ends at triangle ${triangles.end}, past meshTriangleCount ${triangleCount}`,
      )
      continue
    }
    byIdx.set(idx, region)
  }

  const sorted = [...byIdx.values()].sort((a, b) => a.triangles.start - b.triangles.start)

  // Regions tile the mesh completely: gapless from 0 to meshTriangleCount.
  let expected = 0
  for (const region of sorted) {
    if (region.triangles.start !== expected) {
      issues.push(
        region.triangles.start > expected
          ? `triangles [${expected}, ${region.triangles.start}) belong to no region`
          : `region ${region.idx} overlaps the region before it at triangle ${region.triangles.start}`,
      )
    }
    expected = Math.max(expected, region.triangles.end)
  }
  if (issues.length === 0 && expected !== triangleCount) {
    issues.push(`regions cover ${expected} triangles but the mesh has ${triangleCount}`)
  }

  const regionsByFeature = new Map<FeatureTag, readonly number[]>()
  const featuresByRegion = new Map<number, FeatureTag[]>()
  for (const feature of features) {
    if (regionsByFeature.has(feature.tag)) {
      issues.push(`featureTag ${feature.tag} appears more than once`)
      continue
    }
    for (const idx of feature.regionIdxs) {
      if (!byIdx.has(idx)) {
        issues.push(`feature ${feature.tag} references region ${idx}, which does not exist`)
        continue
      }
      // A region is routinely owned by several features; report order decides
      // the order of the owner list so repeated picks are deterministic.
      const owners = featuresByRegion.get(idx)
      if (owners) owners.push(feature.tag)
      else featuresByRegion.set(idx, [feature.tag])
    }
    regionsByFeature.set(feature.tag, [...feature.regionIdxs])
  }

  if (issues.length > 0) throw new PartReportFormatError(issues)

  const starts = new Int32Array(sorted.length)
  const ends = new Int32Array(sorted.length)
  const regionIds = new Int32Array(sorted.length)
  for (const [i, region] of sorted.entries()) {
    starts[i] = region.triangles.start
    ends[i] = region.triangles.end
    regionIds[i] = region.idx
  }

  const noFeatures: readonly FeatureTag[] = Object.freeze([])
  const noRegions: readonly number[] = Object.freeze([])

  return {
    regionCount: sorted.length,

    regionForTriangle(triangle) {
      if (!Number.isInteger(triangle) || triangle < 0) return null
      const i = upperBound(starts, triangle) - 1
      if (i < 0) return null
      // The guard costs one comparison and converts a corrupt-data case from
      // "highlights the wrong surface" into "highlights nothing". With a
      // validated table it is unreachable.
      return triangle < ends[i]! ? regionIds[i]! : null
    },

    featuresForRegion(region) {
      return featuresByRegion.get(region) ?? noFeatures
    },

    regionsForFeature(tag) {
      return regionsByFeature.get(tag) ?? noRegions
    },

    rangeForRegion(region) {
      const found = byIdx.get(region)
      return found ? found.triangles : null
    },
  }
}

/** Index of the first element strictly greater than `target`. */
function upperBound(values: Int32Array, target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >>> 1
    // `mid < high <= values.length`, so the read is always in range.
    if (values[mid]! <= target) low = mid + 1
    else high = mid
  }
  return low
}
