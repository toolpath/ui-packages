import type { FeatureSheets } from './feature-sheet.js'
import type { DfmFeature } from './geometry.js'

/*
 * Holes that are the same hole, as the quoting app groups them (quoting-ui
 * `src/plan/hole-groups.ts`, after the tool catalog's rule): the same way up,
 * the same bore to a thousandth, and the same depth to within a twentieth —
 * depth is measured to where the hole meets the surface, so the same drill
 * through a slanted face reads a little different every time.
 *
 * A part carries dozens of identical holes, and the Engine reports each one
 * separately. To a shop they are one thing, so a list shows them as one row.
 */

/** A hole's bore and depth, mm. Null for a feature that is not a hole, or one the Engine did not measure. */
export const holeSize = (
  sheets: FeatureSheets,
  tag: string,
): { diameter: number; depth: number } | null => {
  const sheet = sheets[tag.toLowerCase()]
  if (
    sheet?.kind !== 'Hole' ||
    sheet.diameter === undefined ||
    sheet.zMin === undefined ||
    sheet.zMax === undefined
  ) {
    return null
  }
  return { diameter: sheet.diameter, depth: sheet.zMax - sheet.zMin }
}

const SAME_DEPTH = 0.05
const DEPTH_FLOOR = 0.01
const TOLERANCE = 1e-6

/** Whether two depths are one depth, as the quoting app counts them: within a twentieth, or a hundredth of a mm. */
export const sameDepth = (a: number, b: number): boolean =>
  Math.abs(a - b) <= Math.max(DEPTH_FLOOR, Math.max(Math.abs(a), Math.abs(b)) * SAME_DEPTH)

const sameDirection = (
  a: DfmFeature['machiningDirection'],
  b: DfmFeature['machiningDirection'],
): boolean =>
  Math.abs(a.x - b.x) < TOLERANCE &&
  Math.abs(a.y - b.y) < TOLERANCE &&
  Math.abs(a.z - b.z) < TOLERANCE

/**
 * Holes sorted into sets of the same hole, each set every hole linked to
 * another in it however long the chain, so depths that creep a twentieth at
 * a time are one set, whatever order the holes are listed in. Each set in
 * list order, the sets in the order their first holes come.
 */
const sameHoleSets = (features: readonly DfmFeature[], sheets: FeatureSheets): DfmFeature[][] => {
  const sizes = features.map((feature) => holeSize(sheets, feature.tag))
  const root = features.map((_, at) => at)
  const find = (at: number): number => {
    let top = at
    while (root[top] !== top) top = root[top] ?? top
    root[at] = top
    return top
  }
  for (let a = 0; a < features.length; a += 1) {
    for (let b = a + 1; b < features.length; b += 1) {
      const [first, second] = [sizes[a], sizes[b]]
      const [one, other] = [features[a], features[b]]
      if (
        first &&
        second &&
        one &&
        other &&
        sameDirection(one.machiningDirection, other.machiningDirection) &&
        first.diameter.toFixed(3) === second.diameter.toFixed(3) &&
        sameDepth(first.depth, second.depth)
      ) {
        const [low, high] = [find(a), find(b)].sort((x, y) => x - y)
        if (high !== undefined && low !== undefined) root[high] = low
      }
    }
  }
  const sets = new Map<number, DfmFeature[]>()
  features.forEach((feature, at) => {
    const top = find(at)
    sets.set(top, [...(sets.get(top) ?? []), feature])
  })
  return [...sets.values()]
}

/** A row in a list of features: one feature, or a group of the same hole. */
export type FeatureRow =
  | { kind: 'feature'; tag: string }
  | {
      kind: 'holes'
      /** Stable: the first hole's tag. */
      key: string
      /** In list order, the first standing for them all. */
      tags: [string, ...string[]]
      diameter: number
    }

/**
 * These features as a list's rows, identical holes gathered into one where
 * the first of them was. Holes the Engine did not measure, and anything not
 * a hole, stay a row each.
 */
export const featureRows = (
  tags: readonly string[],
  features: readonly DfmFeature[],
  sheets: FeatureSheets,
): FeatureRow[] => {
  const byTag = new Map(features.map((feature) => [feature.tag, feature]))
  const listed = tags.flatMap((tag) => byTag.get(tag) ?? [])
  const holes = listed.filter((feature) => holeSize(sheets, feature.tag))
  const setOf = new Map<string, DfmFeature[]>()
  for (const set of sameHoleSets(holes, sheets)) {
    if (set.length > 1) for (const feature of set) setOf.set(feature.tag, set)
  }
  const placed = new Set<string>()
  return tags.flatMap((tag): FeatureRow[] => {
    const set = setOf.get(tag)
    if (!set) return [{ kind: 'feature', tag }]
    const [first, ...rest] = set
    if (!first || placed.has(first.tag)) return []
    placed.add(first.tag)
    return [
      {
        kind: 'holes',
        key: first.tag,
        tags: [first.tag, ...rest.map((feature) => feature.tag)],
        diameter: holeSize(sheets, first.tag)?.diameter ?? 0,
      },
    ]
  })
}
