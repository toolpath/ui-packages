import { sameDirection } from '../model/directions.js'
import type { FeatureTag, FeatureType, PartModel, PartModelFeature, Vec3 } from '../model/types.js'

/**
 * Feature types from most specific to least, for resolving a viewport click.
 *
 * Nothing geometric can separate a region's owners — two `wall` features on the
 * same physical face from different directions reference an *identical* region
 * set, so they have identical area by construction. Specificity is the only
 * ordering left, and it is a judgement about intent: a hole is what someone
 * means when they click a hole's wall.
 *
 * `profile` ranks last, alone. It is a boundary contour rather than a machined
 * surface, so it should never win a click against the surface it traces — and
 * because every direction's profile overlaps most of that direction's regions,
 * this one rule resolves every in-direction collision on the cube.
 */
export const FEATURE_TYPE_RANKS: readonly (readonly FeatureType[])[] = [
  ['blind_hole', 'through_hole', 'filleted_blind_hole'],
  [
    'pocket',
    'open_pocket',
    'boss',
    'filleted_boss',
    'circular_wall',
    'undercut_tslot',
    'undercut_dovetail',
    'sink',
  ],
  ['chamfer', 'inner_fillet', 'outer_fillet', 'contour_surface', 'slanted_face'],
  // Unrecognized types sit here, ahead of the bulk surfaces: `featureType` is
  // an open set, and a type a future kernel adds is far likelier to be a
  // specific machined feature than a new kind of wall.
  [],
  ['wall', 'face'],
  ['profile'],
]

const RANK_BY_TYPE = new Map<FeatureType, number>(
  FEATURE_TYPE_RANKS.flatMap((types, rank) => types.map((type) => [type, rank] as const)),
)

/** The rank of an unrecognized `featureType` — the deliberately empty tier. */
const UNKNOWN_RANK = FEATURE_TYPE_RANKS.findIndex((types) => types.length === 0)

export function featureTypeRank(type: FeatureType): number {
  return RANK_BY_TYPE.get(type) ?? UNKNOWN_RANK
}

export interface RankingContext {
  /**
   * The active machining direction. Narrows a region's owners to two, one, or
   * **none** — the empty case is real, and is reported as "nothing here in this
   * direction" rather than as a pick that missed.
   */
  readonly activeDirection?: Vec3 | null
  /**
   * A unit vector from the part toward the camera. The owner whose machining
   * direction most nearly faces the viewer wins: looking down at the cube,
   * `(0,0,1)` resolves to `+Z:face` rather than to a `±Y:wall` reading.
   */
  readonly viewDirection?: Vec3 | null
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/**
 * Orders a region's owning features for the single-selection case.
 *
 * A *default*, never a claim of correctness — which is why it must never be the
 * only way to reach a feature. Every hover and pick carries the full owner set
 * alongside the ranked one, the panel can be scoped to the candidates, and
 * repeated clicks cycle (see {@link cycleOwner}).
 *
 * With an active direction the result is **filtered**, not merely reordered: a
 * region the direction cannot reach yields an empty list.
 */
export function rankOwners(
  model: PartModel,
  owners: readonly FeatureTag[],
  context: RankingContext = {},
): readonly FeatureTag[] {
  const byTag = new Map(model.features.map((feature) => [feature.tag, feature] as const))

  const features: PartModelFeature[] = []
  for (const tag of owners) {
    const feature = byTag.get(tag)
    if (!feature) continue
    if (
      context.activeDirection &&
      !sameDirection(feature.machiningDirection, context.activeDirection)
    ) {
      continue
    }
    features.push(feature)
  }

  const view = context.viewDirection

  return features
    .map((feature) => ({
      tag: feature.tag,
      rank: featureTypeRank(feature.featureType),
      alignment: view ? dot(feature.machiningDirection, view) : 0,
    }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.alignment !== b.alignment) return b.alignment - a.alignment
      // Stable, so repeated picks on the same region are deterministic rather
      // than dependent on report order or sort implementation.
      if (a.tag < b.tag) return -1
      if (a.tag > b.tag) return 1
      return 0
    })
    .map((entry) => entry.tag)
}

/** The ranked pick, or `null` when the scope holds no owner at all. */
export function bestOwner(
  model: PartModel,
  owners: readonly FeatureTag[],
  context: RankingContext = {},
): FeatureTag | null {
  return rankOwners(model, owners, context)[0] ?? null
}

/**
 * The next owner after `current`, wrapping — the standard CAD escape hatch for
 * an ambiguous click. `null` cycles in from the start; an owner that is not in
 * the list restarts rather than dead-ends.
 */
export function cycleOwner(
  owners: readonly FeatureTag[],
  current: FeatureTag | null,
): FeatureTag | null {
  if (owners.length === 0) return null
  const index = current === null ? -1 : owners.indexOf(current)
  return owners[(index + 1) % owners.length] ?? null
}
