import { tagKey, type Coverage, type Face } from '../faces/coverage'
import { featureTypeLabel, type WithTrimmedFeatures } from '../results/plan'
import {
  featureRow,
  trimmedByTag,
  unique,
  type FeatureBore,
  type PlanFeatureRow,
  type PlanOrientationView,
  type PlanPart,
  type PlanSetupView,
} from '../results/plan-view'
import {
  placedGroups,
  sameDirection,
  type Constraints,
  type PlacedGroup,
} from '../draft/constraints'

/*
  The plan as the Plan page lays it out: the person's constraints — the draft's groups, each the
  way the part is held or tilted, with the features assigned in it (`draftView`) — and how its
  groups, rows and faces read. Toolpath's plan in the kernel's own shape is `planView`
  (`results/plan-view`).
*/

/** A feature type as a group of them is headed: `blind_hole` → `Blind holes`, `boss` → `Bosses`. */
export const featureTypePlural = (type: string | undefined): string => {
  if (!type) {
    return 'Other'
  }
  const label = featureTypeLabel(type)
  return /(s|x|ch|sh)$/.test(label) ? `${label}es` : `${label}s`
}

/** Whether a feature type is a hole, whose rows are sectioned again by their bore. */
export const isHoleType = (type: string | undefined): boolean => type?.endsWith('_hole') ?? false

/**
 * A section of a group's rows under one header: the features of one type — and, inside a hole
 * type's, those of one bore. Only a way of listing them: each row is still assigned, taken out and
 * carried on its own, and nothing is dropped on a section.
 */
export interface FeatureSectionView {
  /** Unique within the group it lists: what its fold is remembered by. */
  key: string
  /** A type's section, or a bore's inside a hole type's. */
  level: 'type' | 'bore'
  type: string | undefined
  label: string
  /** The rows listed straight under it: a hole type's with no bore read yet, after its bores. */
  rows: Array<PlanFeatureRow>
  /** A hole type's bores, smallest first. */
  sections: Array<FeatureSectionView>
  /** Every tag in it, in the order listed: what taking the section out takes. */
  tags: Array<string>
}

/** A bore's section key: to four places, as two holes read alike (`identicalHoles`). */
const boreKey = (bore: FeatureBore): string => bore.diameter.toFixed(4)

/**
 * A group's rows as the tree lists them: a section per feature type, in the order its first row was
 * assigned, each row in its assigned order — and a hole type's rows sectioned again by bore,
 * smallest first, any with no bore read yet after them. A row of no type read yet is under Other.
 */
export const featureSections = (rows: ReadonlyArray<PlanFeatureRow>): Array<FeatureSectionView> =>
  [...rowsByType(rows)].map(([key, members]) => typeSection(key, members))

/**
 * Rows by their type (`''` for none read yet): each type in the order first met, its rows in
 * theirs.
 */
const rowsByType = (rows: ReadonlyArray<PlanFeatureRow>): Map<string, Array<PlanFeatureRow>> => {
  const byType = new Map<string, Array<PlanFeatureRow>>()
  for (const row of rows) {
    const key = row.type ?? ''
    byType.set(key, [...(byType.get(key) ?? []), row])
  }
  return byType
}

/** Every tag of these rows, in their order. */
const tagsOf = (rows: ReadonlyArray<PlanFeatureRow>): Array<string> => rows.map((r) => r.tag)

/**
 * One feature type's section, keyed by `key` (its type, or `''`): a hole type's sectioned again by
 * bore.
 */
const typeSection = (key: string, members: Array<PlanFeatureRow>): FeatureSectionView => {
  const type = key || undefined
  const label = featureTypePlural(type)
  if (!isHoleType(type)) {
    return {
      key: `t:${key}`,
      level: 'type',
      type,
      label,
      rows: members,
      sections: [],
      tags: tagsOf(members),
    }
  }
  const unread = members.filter((row) => !hasBore(row))
  // A hole type is never `''`: its key is its type.
  const sections = boreSections(key, members)
  return {
    key: `t:${key}`,
    level: 'type',
    type,
    label,
    rows: unread,
    sections,
    tags: [...sections.flatMap((section) => section.tags), ...tagsOf(unread)],
  }
}

/** A hole type's rows with a bore read, one section per bore, smallest first. */
const boreSections = (
  type: string,
  members: ReadonlyArray<PlanFeatureRow>,
): Array<FeatureSectionView> =>
  [...rowsByBore(members)]
    .sort(([, a], [, b]) => a.bore.diameter - b.bore.diameter)
    .map(([bore, at]): FeatureSectionView => ({
      key: `t:${type}:${bore}`,
      level: 'bore',
      type,
      label: at.bore.label,
      rows: at.rows,
      sections: [],
      tags: tagsOf(at.rows),
    }))

/** A row whose bore has been read. */
type BoredRow = PlanFeatureRow & { bore: FeatureBore }

/** Whether a row's bore has been read. */
const hasBore = (row: PlanFeatureRow): row is BoredRow => Boolean(row.bore)

/** One bore of a hole type, and its rows. */
interface BoreRows {
  bore: FeatureBore
  rows: Array<PlanFeatureRow>
}

/** The rows with a bore read, by `boreKey`: each bore as first met, its rows in their order. */
const rowsByBore = (rows: ReadonlyArray<PlanFeatureRow>): Map<string, BoreRows> => {
  const byBore = new Map<string, BoreRows>()
  for (const row of rows) {
    if (!hasBore(row)) {
      continue
    }
    const at = byBore.get(boreKey(row.bore))
    if (at) {
      at.rows.push(row)
    } else {
      byBore.set(boreKey(row.bore), { bore: row.bore, rows: [row] })
    }
  }
  return byBore
}

/** Every group of the tree, in tree order. */
export const allGroups = <T extends PlanSetupView>(views: ReadonlyArray<T>): Array<T> =>
  views.flatMap((view) => [view, ...allGroups(view.groups as Array<T>)])

/** A group's rows as the tree lists them. */
export const rowsOf = (group: PlanSetupView): Array<PlanFeatureRow> =>
  group.orientations.flatMap((orientation) => orientation.features)

/** Whether a group lists a feature among its rows, its tag spelled in any case. */
export const listsTag = (group: PlanSetupView, tag: string): boolean => {
  const key = tagKey(tag)
  return rowsOf(group).some((row) => tagKey(row.tag) === key)
}

/** A group's name with the groups it is in: `Group 1 › Side`. */
export const groupPath = (setups: ReadonlyArray<PlanSetupView>, groupId: string): string => {
  const groups = allGroups(setups)
  const names: Array<string> = []
  let at = groups.find((group) => group.id === groupId)
  while (at) {
    names.unshift(at.name)
    const parentId = at.parentId
    at = parentId ? groups.find((group) => group.id === parentId) : undefined
  }
  return names.join(' › ')
}

export { featureTypeLabel }

/**
 * A plan's count of holds and of the directions they are machined from (FLD60): a setup is one
 * hold — an indexed one however many tilts it turns to, a 3 axis one however its work is grouped —
 * and each direction a frame is cut from is one orientation.
 */
export const planCounts = (
  setups: ReadonlyArray<PlanSetupView>,
): { setups: number; orientations: number } => ({
  setups: setups.length,
  orientations: allGroups(setups)
    .filter((view) => view.isFrame)
    .reduce((sum, frame) => sum + frame.orientations.length, 0),
})

/**
 * A colour on one feature, and how strongly — the viewer's `FeatureHighlight` (the DFM view's
 * paint).
 */
export interface PlanHighlight {
  tag: string
  color: number
  weight: number
}

/**
 * A direction a face is shown in: the direction, and its place among the part's candidates. The app
 * gives each direction its colour.
 */
export type FaceDirection = Pick<PlanOrientationView, 'direction' | 'directionIndex'>

/**
 * How one face shows on the part, as a kind the app gives a colour and a strength:
 *
 * - `direction`: a group's direction machines it — assigned there, or Toolpath's setup — shown in
 *   that direction's colour.
 * - `otherDirection`: with a group open, only other directions take it.
 * - `done`: marked done, so left alone.
 * - `notMachined`: nothing machines it.
 *
 * An open face — left to Toolpath — is not listed: it shows bare.
 */
export type ShownFace =
  | ({ region: number; kind: 'direction' } & FaceDirection)
  | { region: number; kind: 'otherDirection' | 'done' | 'notMachined' }

/** Another direction that takes a face too: the app draws it across the face, in its colour. */
export type SharedFace = { region: number } & FaceDirection

/**
 * What the face kinds read of the plan: which group is open, and who lists each feature.
 */
interface ShownFacesInput {
  faces: Coverage['faces']
  setups: ReadonlyArray<PlanSetupView>
  /** The open group's id; null with no group open. */
  openId: string | null
  /** Direction colours on: every group shows. Off, only the open group and its insides. */
  everyGroup?: boolean
}

/** A group's direction listing a feature, and whether it is the open group's own. */
interface OwnerRow {
  direction: FaceDirection
  selected: boolean
}

/**
 * The rows of a face's owners — each the direction of a group listing it, and whether that is the
 * open group's own direction — and the group open.
 */
const groupRows = ({ setups, openId }: ShownFacesInput) => {
  const groups = allGroups(setups)
  const open = groups.find((group) => group.id === openId)
  const rows = ownerRowsByTag(groups, selectedIn(open))
  return {
    open,
    rowsOf: (face: Face) => face.owners.flatMap((tag) => rows.get(tagKey(tag)) ?? []),
  }
}

/**
 * Whether a group's direction is the one selected. An open group's direction is: what is in it, or
 * in the groups inside it, from that direction. A tilt inside it, or another way a 3+2 setup turns
 * to, is another direction — read as the other groups are. With no group open, none is.
 */
const selectedIn = (
  open: PlanSetupView | undefined,
): ((group: PlanSetupView, orientation: PlanOrientationView) => boolean) => {
  const inOpen = new Set(open ? allGroups([open]) : [])
  const way = open?.orientations[0]?.direction
  return (group, orientation) =>
    inOpen.has(group) && way !== undefined && sameDirection(orientation.direction, way)
}

/** Each feature's rows, by its tag's key: the group's direction listing it. */
const ownerRowsByTag = (
  groups: ReadonlyArray<PlanSetupView>,
  isSelected: (group: PlanSetupView, orientation: PlanOrientationView) => boolean,
): Map<string, Array<OwnerRow>> => {
  const rows = new Map<string, Array<OwnerRow>>()
  const orientations = groups.flatMap((group) =>
    group.orientations.map((orientation) => ({ group, orientation })),
  )
  for (const { group, orientation } of orientations) {
    const selected = isSelected(group, orientation)
    const direction = faceDirection(orientation)
    for (const feature of orientation.features) {
      const key = tagKey(feature.tag)
      rows.set(key, [...(rows.get(key) ?? []), { direction, selected }])
    }
  }
  return rows
}

/** An orientation's direction, as a face shows it: without its features. */
const faceDirection = ({ direction, directionIndex }: FaceDirection): FaceDirection => ({
  direction,
  directionIndex,
})

/**
 * How each face shows, as `classifyFaces` reads the plan — the one rule for what machines each
 * face, in either view. An assigned face shows in its group's direction, and so does a face
 * Toolpath machines, in its setup's; a done face is `done`; an open face — left to Toolpath — is
 * not listed; a Not machined face is `notMachined`. With no group open every group shows, the
 * other directions of a shared face in `sharedFaces`; with one open, only its own direction does —
 * it and the groups inside it facing the same way (FLD59). A face only other directions take,
 * inside it or not, is `otherDirection`; `sharedFaces` lists those directions. With direction colours off (MAP73),
 * only the open group's direction shows.
 */
export const shownFaces = ({
  uncovered = true,
  ...input
}: ShownFacesInput & {
  /** List what no group covers — Not machined. Off where the app shows something else there. */
  uncovered?: boolean
}): Array<ShownFace> => {
  const { faces, everyGroup = true } = input
  const { open, rowsOf } = groupRows(input)
  const showing = { groupOpen: open !== undefined, everyGroup }
  const fromGroup = (face: Face): Array<ShownFace> => groupFace(face, rowsOf(face), showing)
  return [
    ...faces.assigned.flatMap(fromGroup),
    ...faces.machined.flatMap(fromGroup),
    ...faces.done.map((face) => ({ region: face.region, kind: 'done' as const })),
    ...(uncovered
      ? faces.notMachined.map((face) => ({ region: face.region, kind: 'notMachined' as const }))
      : []),
  ]
}

/**
 * How a face shows from the rows of its owners (`own`): in the selected direction first; with no
 * group open, the first met; with one open, `otherDirection` where only other directions take it.
 */
const groupFace = (
  face: Face,
  own: ReadonlyArray<OwnerRow>,
  { groupOpen, everyGroup }: { groupOpen: boolean; everyGroup: boolean },
): Array<ShownFace> => {
  const row = own.find((each) => each.selected) ?? own[0]
  if (!row) {
    return []
  }
  const inDirection: ShownFace = { region: face.region, kind: 'direction', ...row.direction }
  if (!groupOpen) {
    return everyGroup ? [inDirection] : []
  }
  if (row.selected) {
    return [inDirection]
  }
  return everyGroup ? [{ region: face.region, kind: 'otherDirection' }] : []
}

/**
 * With a group open, the other directions that take a face: each face a feature of another
 * direction includes — another group's, or a tilt inside the open one — lists that direction, so
 * a face touched from more than one direction shows each. With no group open, the first owner's
 * direction shows the face (`shownFaces`), and the remaining directions are listed here. A
 * direction once per face. Nothing with direction colours off.
 */
export const sharedFaces = (input: ShownFacesInput): Array<SharedFace> => {
  const { faces, everyGroup = true } = input
  const { open, rowsOf } = groupRows(input)
  if (!everyGroup) {
    return []
  }
  const sharedOf = (face: Face): Array<SharedFace> => {
    const own = rowsOf(face)
    const first = own[0]?.direction
    const others = open
      ? own.filter((row) => !row.selected)
      : own.filter((row) => !first || !sameDirection(row.direction.direction, first.direction))
    return uniqueDirections(others.map((row) => row.direction)).map((direction) => ({
      region: face.region,
      ...direction,
    }))
  }
  return [...faces.assigned.flatMap(sharedOf), ...faces.machined.flatMap(sharedOf)]
}

/** Each direction once, in the order first met. */
const uniqueDirections = (directions: ReadonlyArray<FaceDirection>): Array<FaceDirection> =>
  directions.filter(
    (each, at) =>
      directions.findIndex((other) => sameDirection(other.direction, each.direction)) === at,
  )

/**
 * The draft as the page lays it out: its groups, in its order and with its names, each listing
 * what is assigned in it in the order it was assigned (MP-5). Nothing of Toolpath's: the
 * constraints, and only those. An assigned tag the latest plan (`plan`) trimmed reads as `planView`
 * reads it, `Pocket (trimmed)`; with no plan, as the part labels it.
 */
export const draftView = (
  draft: Pick<Constraints, 'setups'>,
  part: PlanPart,
  plan: WithTrimmedFeatures = null,
): Array<PlanSetupView> => {
  const trimmedFeatures = trimmedByTag(plan, part)
  const placed = placedGroups(draft.setups)
  const view = (here: PlacedGroup): PlanSetupView => ({
    id: here.group.id,
    name: here.group.name,
    process: here.depth === 0 ? (here.setup.process ?? '3axis') : '3axis',
    orientations: [
      {
        id: `${here.group.id}-0`,
        direction: here.direction,
        directionIndex: part.directionIndex(here.direction),
        features: unique(here.group.features).map((tag) => featureRow(part, trimmedFeatures, tag)),
      },
    ],
    depth: here.depth,
    setupId: here.setup.id,
    parentId: here.parent?.id ?? null,
    orientation: here.orientation,
    isFrame: here.frameId === here.group.id,
    groups: placed.filter((child) => child.parent?.id === here.group.id).map(view),
  })
  return placed.filter((each) => each.depth === 0).map(view)
}

/**
 * One statement Toolpath refused of a stated plan, as a kind for the app to word:
 *
 * - `staleRegions`: faces marked done on an analysis by another kernel, whose numbering is not
 *   this one's.
 * - `unknownRegions`: faces marked done that the part's analysis does not have, marked on an
 *   older analysis.
 * - `clause`: one of the clauses Toolpath lists, as it wrote it (`describeClause` names its setup
 *   and features).
 */
export type RefusalClause =
  | { kind: 'staleRegions' }
  | { kind: 'unknownRegions' }
  | { kind: 'clause'; text: string }

/**
 * The statements Toolpath refused of a stated plan, one per clause, from the error its job failed
 * with — or null when the job failed for some other reason. Toolpath lists the first few and says
 * how many more; that tail is kept as a clause of its own.
 */
export const refusalClauses = (error: string | null): Array<RefusalClause> | null => {
  if (error?.startsWith('stale_regions:')) {
    return [{ kind: 'staleRegions' }]
  }
  if (error?.startsWith('unknown_regions:')) {
    return [{ kind: 'unknownRegions' }]
  }
  if (!error?.startsWith('refused_user_plan:')) {
    return null
  }
  const listed = error.slice(error.indexOf('refused:') + 'refused:'.length)
  return listed
    .split(';')
    .map((clause) => clause.trim())
    .filter(Boolean)
    .map((text) => ({ kind: 'clause', text }))
}
