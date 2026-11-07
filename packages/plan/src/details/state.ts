import { groupRef, type GroupRef } from '../draft/refusals'
import {
  COVERAGE_KINDS,
  coversAll,
  facesByRegion,
  type Coverage,
  type CoverageKind,
} from '../faces/coverage'
import type { PlanFeatureRow, PlanSetupView } from '../results/plan-view'
import { listsTag, rowsOf } from './view'

/*
  Where a feature is in a plan (`stateOf`), read off the plan's groups and who machines each face:
  for the app to word, as it words every kind.
*/

/** A plan as a reading of a feature reads it: every group of the tree, and who machines each face. */
export interface PlanReading {
  groups: ReadonlyArray<PlanSetupView>
  kindOf: (region: number) => CoverageKind
}

/** A plan as `stateOf` reads it, from its groups and who machines each face (`classifyFaces`). */
export const readingOf = (
  groups: ReadonlyArray<PlanSetupView>,
  coverage: Coverage | null,
): PlanReading => {
  const faces = facesByRegion(coverage)
  return { groups, kindOf: (region) => faces.get(region)?.kind ?? 'open' }
}

/**
 * Where a feature is in a plan, for the app to word: a kind its faces have, or `partOf` a larger
 * feature assigned (`whole`), with the groups that hold it, in tree order.
 */
export type FeatureState =
  | { kind: CoverageKind; groups: Array<GroupRef> }
  | { kind: 'partOf'; whole: { tag: string; label: string }; groups: Array<GroupRef> }

/**
 * Where a feature is in a plan: assigned (in a group, or part of a larger feature assigned there),
 * done, or the kind its faces have. Read off its faces, so a feature inside another reads as that
 * one's, and the same faces read another way read as assigned where those are.
 */
export const stateOf = (
  tag: string,
  plan: PlanReading,
  regionsOf: (tag: string) => ReadonlyArray<number>,
): FeatureState => {
  const faces = regionsOf(tag)
  const kind = kindAmong(faces.map(plan.kindOf))
  if (kind === 'done') {
    return { kind, groups: [] }
  }
  const own = plan.groups.filter((group) => listsTag(group, tag))
  if (own.length > 0) {
    return { kind: 'assigned', groups: own.map(groupRef) }
  }
  const around = assignmentCovering(plan.groups, faces, regionsOf)
  if (around) {
    const groups = around.groups.map(groupRef)
    // Another way's reading of the same faces is where they were; a larger feature, what they were part of.
    return regionsOf(around.row.tag).length === faces.length
      ? { kind: 'assigned', groups }
      : { kind: 'partOf', whole: { tag: around.row.tag, label: around.row.label }, groups }
  }
  const shared = groupsSharing(plan.groups, faces, regionsOf)
  return { kind, groups: kind === 'assigned' ? shared.map(groupRef) : [] }
}

/** What a feature's faces say it is: the first kind of `COVERAGE_KINDS` among theirs, else open. */
const kindAmong = (kinds: ReadonlyArray<CoverageKind>): CoverageKind =>
  COVERAGE_KINDS.find((each) => kinds.includes(each)) ?? 'open'

/**
 * The first assigned row whose faces include all of `faces` — the same faces read another way, or a
 * larger feature — and every group listing such a row, in tree order; none where no row does.
 */
const assignmentCovering = (
  groups: ReadonlyArray<PlanSetupView>,
  faces: ReadonlyArray<number>,
  regionsOf: (tag: string) => ReadonlyArray<number>,
): { row: PlanFeatureRow; groups: Array<PlanSetupView> } | undefined => {
  const around = groups.flatMap((group) =>
    rowsOf(group)
      .filter((row) => coversAll(regionsOf(row.tag), faces))
      .map((row) => ({ group, row })),
  )
  const first = around[0]
  if (!first) {
    return undefined
  }
  return { row: first.row, groups: [...new Set(around.map((each) => each.group))] }
}

/** The groups listing a row that shares any of `faces`. */
const groupsSharing = (
  groups: ReadonlyArray<PlanSetupView>,
  faces: ReadonlyArray<number>,
  regionsOf: (tag: string) => ReadonlyArray<number>,
): Array<PlanSetupView> =>
  groups.filter((group) =>
    rowsOf(group).some((row) => regionsOf(row.tag).some((region) => faces.includes(region))),
  )
