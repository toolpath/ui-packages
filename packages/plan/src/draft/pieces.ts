import { placedGroups, type DraftSetup, type PlanRules } from './constraints'

/*
  What's left of a feature that loses some of its regions, cut into features Toolpath can read.

  Stated as one list of regions with no type, the rest is read as one feature, and the plan is
  refused where it reads as none ("reads as no feature"): a profile's walls without the rest of its
  outline, or regions that don't touch, which never read as one. Toolpath cuts a feature it trims
  itself the same way: a profile is read as its walls, which the analysis lists as features of their
  own, and a rest that reads as nothing whole is read run by run.
*/

/** What's left of a feature in a group, cut into the regions of each feature it becomes. */
export type Cut = (groupId: string, regions: ReadonlyArray<number>) => Array<Array<number>>

const ascending = (regions: Iterable<number>): Array<number> =>
  [...new Set(regions)].sort((a, b) => a - b)

/**
 * `regions` cut into features Toolpath can read, each ascending, in order of their first region:
 * as they are where they are exactly one of `readings`; else first each reading that lies wholly in
 * them, largest first (ties to the lower first region), none sharing a region; then each run of the
 * rest whose regions touch (`touching`), or the rest as one where `touching` is left out.
 */
export const piecesOf = (
  regions: ReadonlyArray<number>,
  readings: ReadonlyArray<ReadonlyArray<number>>,
  touching?: (region: number) => Iterable<number>,
): Array<Array<number>> => {
  const left = new Set(regions)
  const whole = (reading: ReadonlyArray<number>) =>
    reading.length > 0 && reading.every((region) => left.has(region))
  // Largest first, so a reading that is all of them is taken whole.
  const pieces: Array<Array<number>> = []
  const inside = readings
    .filter(whole)
    .map(ascending)
    .sort((a, b) => b.length - a.length || a[0]! - b[0]!)
  for (const reading of inside) {
    if (whole(reading)) {
      pieces.push(reading)
      reading.forEach((region) => left.delete(region))
    }
  }
  if (!touching) {
    if (left.size > 0) {
      pieces.push(ascending(left))
    }
  } else {
    for (const start of ascending(left)) {
      if (!left.has(start)) {
        continue
      }
      const run = [start]
      left.delete(start)
      for (let at = 0; at < run.length; at += 1) {
        for (const next of touching(run[at]!)) {
          if (left.has(next)) {
            left.delete(next)
            run.push(next)
          }
        }
      }
      pieces.push(ascending(run))
    }
  }
  return pieces.sort((a, b) => a[0]! - b[0]!)
}

/**
 * How what's left of a feature is cut in `setups` (`piecesOf`), by the readings from its group's
 * direction and the regions that touch, as `rules` give them; undefined where they give neither,
 * and what's left stays one feature.
 */
export const leftoverCut = (
  setups: ReadonlyArray<DraftSetup>,
  rules: Pick<PlanRules, 'readingsFrom' | 'touching'>,
): Cut | undefined => {
  const { readingsFrom, touching } = rules
  if (!readingsFrom && !touching) {
    return undefined
  }
  const directions = new Map(placedGroups(setups).map((each) => [each.group.id, each.direction]))
  return (groupId, regions) => {
    const direction = directions.get(groupId)
    return piecesOf(regions, direction && readingsFrom ? readingsFrom(direction) : [], touching)
  }
}
