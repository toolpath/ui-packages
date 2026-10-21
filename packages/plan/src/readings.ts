import { isFallback, tagKey, type CoverageFeature } from './coverage'
import type { PlanDirection } from './engine-plan'
import { sameDirection } from './plan-draft'

/*
  Which features a click on the part means. One rule for every place that reads a face: the open
  folder (its direction alone), Ignore (the most specific feature, profiles last) and everywhere
  else (every direction, largest first). Each answers the features read and which is meant by
  default; the Feature section offers the rest.
*/

/** A region as the part's model has it: its index, and the CAD face it was split from. */
export type SplitRegion = { idx: number; splitOrigin: number }

/**
 * The regions of the CAD face a region was split from: those sharing its `splitOrigin`. A region
 * with none — unknown to the model — is a face of its own.
 */
export const faceRegions = (regions: ReadonlyArray<SplitRegion>, region: number): Array<number> => {
  const origin = regions.find((candidate) => candidate.idx === region)?.splitOrigin
  return origin === undefined
    ? [region]
    : regions.filter((candidate) => candidate.splitOrigin === origin).map(({ idx }) => idx)
}

/** Where a click is read from: an open folder's way, Ignore, or the whole part. */
export type ReadingScope =
  /** The folder's direction alone, largest first, the viewer's rank breaking ties. */
  | { kind: 'folder'; id: string; direction: PlanDirection }
  /** The most specific feature first; profiles offered but never the default. */
  | { kind: 'ignore' }
  /** Every direction, largest first, the viewer's rank breaking ties. */
  | { kind: 'all' }

/** What a click gives: the faces it is on, the viewer's ranking of their owners, and a feature meant. */
export interface ReadingAt {
  regions: ReadonlyArray<number>
  /** The viewer's ranking of the owners, best first — breaking ties in size. */
  ranked?: ReadonlyArray<string>
  /** A feature to take as the default where it is among the readings: a list row's own, say. */
  prefer?: string | null
}

/** What the readings need of the part and the plan. */
export interface ReadingContext {
  /** The part's features, in report order. */
  features: ReadonlyArray<CoverageFeature>
  /** A feature by tag in any case: the way it is cut. */
  featureOf: (tag: string) => { direction: PlanDirection } | null
  /** The folder a feature is pinned in, or null: a reading already pinned is the default. */
  pinnedIn?: (tag: string) => string | null
}

/** The features a click reads, in the scope's order, and the one it means by default. */
interface Readings {
  tags: Array<string>
  default: string | null
}

const regionsOf = (feature: CoverageFeature): ReadonlyArray<number> => feature.regionIdxs ?? []

/**
 * The features a click on `at.regions` reads in `scope`, and which it means by default: `prefer`
 * where it is among them, else one already pinned — in the folder for `folder`, anywhere for
 * `all` — else the first; for `ignore`, the first that is not a profile, else null.
 */
export const readingsFor = (
  at: ReadingAt,
  scope: ReadingScope,
  context: ReadingContext,
): Readings => {
  const wanted = new Set(at.regions)
  const owners = context.features.filter((feature) =>
    regionsOf(feature).some((region) => wanted.has(region)),
  )
  const read =
    scope.kind === 'ignore' ? ignoreOrder(owners) : sizeOrder(owners, scope, at.ranked, context)
  const tags = read.map((feature) => feature.tag)
  return { tags, default: defaultOf(read, at.prefer ?? null, scope, context) }
}

/** The viewer's rank of a tag: its place in `ranked`, or past the end for one not ranked. */
const rankOf = (ranked: ReadonlyArray<string> | undefined, tag: string): number => {
  const at = ranked?.indexOf(tag) ?? -1
  return at < 0 ? (ranked?.length ?? 0) : at
}

/**
 * Largest first, the viewer's best-ranked among equals: from the folder's direction alone, or from
 * every direction. Each tag once.
 */
const sizeOrder = (
  owners: ReadonlyArray<CoverageFeature>,
  scope: Extract<ReadingScope, { kind: 'folder' | 'all' }>,
  ranked: ReadingAt['ranked'],
  context: ReadingContext,
): Array<CoverageFeature> => {
  const seen = new Set<string>()
  return owners
    .filter((feature) => {
      const key = tagKey(feature.tag)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      if (scope.kind === 'all') {
        return true
      }
      const direction = context.featureOf(feature.tag)?.direction
      return direction !== undefined && sameDirection(direction, scope.direction)
    })
    .sort(
      (a, b) =>
        regionsOf(b).length - regionsOf(a).length || rankOf(ranked, a.tag) - rankOf(ranked, b.tag),
    )
}

/**
 * The most specific first — fewest regions, then by tag — and profiles (`isFallback`) last. From
 * every direction alike: the kernel reads a feature once per direction it is cut from, so owners
 * of exactly the same regions are one.
 */
const ignoreOrder = (owners: ReadonlyArray<CoverageFeature>): Array<CoverageFeature> => {
  const sorted = [...owners].sort(
    (a, b) =>
      Number(isFallback(a.featureType)) - Number(isFallback(b.featureType)) ||
      regionsOf(a).length - regionsOf(b).length ||
      a.tag.localeCompare(b.tag),
  )
  const seen = new Set<string>()
  return sorted.filter((feature) => {
    const key = [...new Set(regionsOf(feature))].sort((a, b) => a - b).join(',')
    return seen.has(key) ? false : (seen.add(key), true)
  })
}

const defaultOf = (
  read: ReadonlyArray<CoverageFeature>,
  prefer: string | null,
  scope: ReadingScope,
  context: ReadingContext,
): string | null => {
  const preferred = prefer ? read.find((feature) => tagKey(feature.tag) === tagKey(prefer)) : null
  if (preferred) {
    return preferred.tag
  }
  if (scope.kind === 'ignore') {
    return read.find((feature) => !isFallback(feature.featureType))?.tag ?? null
  }
  const pinned = read.find((feature) => {
    const home = context.pinnedIn?.(feature.tag) ?? null
    return scope.kind === 'folder' ? home === scope.id : home !== null
  })
  return pinned?.tag ?? read[0]?.tag ?? null
}
