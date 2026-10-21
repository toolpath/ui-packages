import { tagKey, type Coverage, type Face } from './coverage'
import { featureTypeLabel, notMachinedOf, type EnginePlan, type PlanDirection } from './engine-plan'
import { notFinishedIn } from './not-machined'
import { placedFolders, sameDirection, type Constraints, type PlacedFolder } from './plan-draft'

/*
  The plan as the Plan page lays it out: the person's constraints — the draft's folders, each the
  way the part is held or tilted, with the features pinned in it (`draftView`) — and Toolpath's
  plan in the kernel's own shape — setups in machining order, each machined from one direction or,
  for a 3+2 setup, several, each direction taking its features (`planView`).
*/

/**
 * The tree's part row: its key, its drop target's id, and as the page's open id the part active, its
 * summary shown. No folder has it as an id.
 */
export const PART_ROW = 'part'

/**
 * What the page's `openId` holds while Ignore is open: not a folder, but held for its Save as one
 * is, and left the same way. No folder has it as an id.
 */
export const IGNORE = 'ignore'

/** One feature a direction takes: its tag, and its type and label from the part's analysis. */
export interface PlanFeatureRow {
  tag: string
  label: string
  /** The Engine's feature type (`blind_hole`, `open_pocket`), which its icon is drawn from. */
  type?: string
  /** A hole's bore, once its sheet is in: what holes of a type are grouped by. */
  bore?: FeatureBore
}

/** A hole's bore: its diameter in millimetres, and as the page says it (`⌀6.35 mm`). */
export interface FeatureBore {
  diameter: number
  label: string
}

/** A feature type as a group of them is headed: `blind_hole` → `Blind holes`, `boss` → `Bosses`. */
export const featureTypePlural = (type: string | undefined): string => {
  if (!type) {
    return 'Other'
  }
  const label = featureTypeLabel(type)
  return /(s|x|ch|sh)$/.test(label) ? `${label}es` : `${label}s`
}

/** Whether a feature type is a hole, whose rows are grouped again by their bore. */
export const isHoleType = (type: string | undefined): boolean => type?.endsWith('_hole') ?? false

/**
 * A group of a folder's rows under one header: the features of one type — and, inside a hole
 * type's, those of one bore. Only a way of listing them: each row is still pinned, taken out and
 * carried on its own, and nothing is dropped on a group.
 */
export interface FeatureGroupView {
  /** Unique within the folder: what its fold is remembered by. */
  key: string
  /** A type's group, or a bore's inside a hole type's. */
  level: 'type' | 'bore'
  type: string | undefined
  label: string
  /** The rows listed straight under it: a hole type's with no bore read yet, after its bores. */
  rows: Array<PlanFeatureRow>
  /** A hole type's bores, smallest first. */
  groups: Array<FeatureGroupView>
  /** Every tag in it, in the order listed: what taking the group out takes. */
  tags: Array<string>
}

/** A bore's group key: to four places, as two holes read alike (`identicalHoles`). */
const boreKey = (bore: FeatureBore): string => bore.diameter.toFixed(4)

/**
 * A folder's rows as the tree lists them: a group per feature type, in the order its first row was
 * pinned, each row in its pinned order — and a hole type's rows grouped again by bore, smallest
 * first, any with no bore read yet after them. A row of no type read yet is under Other.
 */
export const featureGroups = (rows: ReadonlyArray<PlanFeatureRow>): Array<FeatureGroupView> => {
  const byType = new Map<string, Array<PlanFeatureRow>>()
  for (const row of rows) {
    const key = row.type ?? ''
    byType.set(key, [...(byType.get(key) ?? []), row])
  }
  return [...byType].map(([key, members]) => {
    const type = key || undefined
    const label = featureTypePlural(type)
    if (!isHoleType(type)) {
      return {
        key: `t:${key}`,
        level: 'type',
        type,
        label,
        rows: members,
        groups: [],
        tags: members.map((r) => r.tag),
      }
    }
    const byBore = new Map<string, { bore: FeatureBore; rows: Array<PlanFeatureRow> }>()
    const unread: Array<PlanFeatureRow> = []
    for (const row of members) {
      if (!row.bore) {
        unread.push(row)
        continue
      }
      const at = byBore.get(boreKey(row.bore))
      if (at) {
        at.rows.push(row)
      } else {
        byBore.set(boreKey(row.bore), { bore: row.bore, rows: [row] })
      }
    }
    const groups = [...byBore]
      .sort(([, a], [, b]) => a.bore.diameter - b.bore.diameter)
      .map(
        ([bore, at]): FeatureGroupView => ({
          key: `t:${key}:${bore}`,
          level: 'bore',
          type,
          label: at.bore.label,
          rows: at.rows,
          groups: [],
          tags: at.rows.map((r) => r.tag),
        }),
      )
    return {
      key: `t:${key}`,
      level: 'type',
      type,
      label,
      rows: unread,
      groups,
      tags: [...groups.flatMap((group) => group.tags), ...unread.map((r) => r.tag)],
    }
  })
}

/** One direction of a setup — the way the tool points — with the features cut from it. */
export interface PlanOrientationView {
  id: string
  direction: PlanDirection
  /** Its place among the part's candidate directions, which is its colour; -1 when not one. */
  directionIndex: number
  features: Array<PlanFeatureRow>
}

/**
 * A folder as the tree shows it — a setup at the top, the folders inside it below. Its one
 * orientation is the direction it is cut from and the rows in it.
 */
export interface PlanSetupView {
  id: string
  name: string
  /** A setup's hold: `3 axis` from one direction, `3+1` / `3+2` turning the part to tilts. */
  process: '3axis' | '3+1' | '3+2'
  orientations: Array<PlanOrientationView>
  /** 0 for a setup. */
  depth: number
  /** The setup it is in (itself for a setup), and the folder it is in, if any. */
  setupId: string
  parentId: string | null
  /** A tilt of its own inside an indexed setup. */
  toolOrientation: boolean
  /** Whether it faces its own direction — a setup or tool orientation — rather than following. */
  isFrame: boolean
  folders: Array<PlanSetupView>
}

/** A setup of Toolpath's plan, as `planView` lays it out: its rows, and what it left uncut. */
export interface PlannedSetupView extends PlanSetupView {
  /** Features the setup was meant to machine that no pass in it does. */
  notMachined: Array<PlanFeatureRow>
  /**
   * Of those, the ones a pass in it does cut, but short: roughed, and owed a finish no pass gives
   * (`notFinishedIn`). The rest are not machined at all.
   */
  notFinished: Array<string>
  operations: number
}

/** Every folder of the tree, in tree order. */
export const allFolders = <T extends PlanSetupView>(views: ReadonlyArray<T>): Array<T> =>
  views.flatMap((view) => [view, ...allFolders(view.folders as Array<T>)])

/** A folder's rows as the tree lists them. */
export const rowsOf = (folder: PlanSetupView): Array<PlanFeatureRow> =>
  folder.orientations.flatMap((orientation) => orientation.features)

/** Whether a folder lists a feature among its rows, its tag spelled in any case. */
export const listsTag = (folder: PlanSetupView, tag: string): boolean => {
  const key = tagKey(tag)
  return rowsOf(folder).some((row) => tagKey(row.tag) === key)
}

/** A folder's name with the folders it is in: `Folder 1 › Side`. */
export const folderPath = (setups: ReadonlyArray<PlanSetupView>, folderId: string): string => {
  const folders = allFolders(setups)
  const names: Array<string> = []
  let at = folders.find((folder) => folder.id === folderId)
  while (at) {
    names.unshift(at.name)
    const parentId = at.parentId
    at = parentId ? folders.find((folder) => folder.id === parentId) : undefined
  }
  return names.join(' › ')
}

/** What a flat plan's setup is given of a folder view's place: at the top, with no folders inside. */
type Placement = Pick<
  PlanSetupView,
  'depth' | 'setupId' | 'parentId' | 'toolOrientation' | 'isFrame' | 'folders'
>

/** A folder view with the shape a flat plan's setup has: no folders inside, at the top. */
const flatView = <T extends Omit<PlanSetupView, keyof Placement>>(view: T): T & Placement => ({
  ...view,
  depth: 0,
  setupId: view.id,
  parentId: null,
  toolOrientation: false,
  isFrame: true,
  folders: [],
})

/** What the view needs to know about the part: which candidate a direction is, and what a tag is. */
export interface PlanPart {
  directionIndex: (direction: PlanDirection) => number
  featureLabel: (tag: string) => string
  /** The Engine's type for a tag, when the part's analysis has read it. */
  featureType?: (tag: string) => string | undefined
  /** A hole's bore, once its sheet is in. */
  featureBore?: (tag: string) => FeatureBore | undefined
}

export { featureTypeLabel }

/** A tag's row, as the part reads it. */
const featureRow = (part: PlanPart, tag: string): PlanFeatureRow => {
  const bore = part.featureBore?.(tag)
  return {
    tag,
    label: part.featureLabel(tag),
    type: part.featureType?.(tag),
    ...(bore ? { bore } : {}),
  }
}

/** Each tag once, in the order first met. */
const unique = (tags: Iterable<string>): Array<string> => [...new Set(tags)]

/**
 * The plan's setups, each with every direction it is machined from.
 *
 * The plan's own statement (`setupPlan`) says both, and is what a plan is edited from. An Engine
 * that does not serve one (before API 1.19) gives each setup only its first direction, so the
 * features are read off its passes instead: every tag an action cuts, in machining order.
 */
export const planView = (
  plan: Pick<EnginePlan, 'setups' | 'setupPlan'>,
  part: PlanPart,
): Array<PlannedSetupView> => {
  const row = (tag: string): PlanFeatureRow => featureRow(part, tag)
  return plan.setups.map((setup, index) => {
    const stated = plan.setupPlan?.setups[index]?.orientations
    const orientations = stated
      ? stated.map((orientation) => ({
          direction: orientation.direction,
          tags: unique(orientation.features),
        }))
      : setup.direction
        ? [
            {
              direction: setup.direction,
              tags: unique(setup.actions.flatMap((action) => action.featureTags)),
            },
          ]
        : []
    return flatView({
      id: `setup-${setup.idx}`,
      name: `Setup ${index + 1}`,
      process: orientations.length > 1 ? '3+2' : '3axis',
      orientations: orientations.map(({ direction, tags }, at) => ({
        id: `setup-${setup.idx}-${at}`,
        direction,
        directionIndex: part.directionIndex(direction),
        features: tags.map(row),
      })),
      notMachined: unique(notMachinedOf(setup)).map(row),
      notFinished: notFinishedIn(setup),
      operations: setup.actions.length,
    })
  })
}

/**
 * A plan's count of holds and of the directions they are machined from (FLD60): a setup is one
 * hold — an indexed one however many tilts it turns to, a 3 axis one however its work is grouped —
 * and each direction a frame is cut from is one orientation.
 */
export const planCounts = (
  setups: ReadonlyArray<PlanSetupView>,
): { setups: number; orientations: number } => ({
  setups: setups.length,
  orientations: allFolders(setups)
    .filter((view) => view.isFrame)
    .reduce((sum, frame) => sum + frame.orientations.length, 0),
})

/** A colour on one feature, and how strongly — the viewer's `FeatureHighlight` (the DFM view's paint). */
export interface PlanHighlight {
  tag: string
  color: number
  weight: number
}

/** A colour on one face, and how strongly it covers the surface — the viewer's `RegionHighlight`. */
export interface FacePaint {
  region: number
  color: number
  weight: number
}

/** The colour ignored faces are painted, and Ignore's mark: slate — finished, so left alone. */
export const DONE_COLOR = 0x64748b
/** The red the faces nothing machines are painted, on every part viewer. */
export const UNMACHINED_FACE_COLOR = 0xdc2626
const IGNORED_WEIGHT = 0.6
/** Not machined, in `UNMACHINED_FACE_COLOR`: as strong as ignored, a state rather than a folder. */
const NOT_MACHINED_WEIGHT = 0.6
/** Every folder painted at the part level; with one open, it and its insides, the others hatched. */
const PART_WEIGHT = 0.85
const OPEN_WEIGHT = 0.8
/**
 * With a folder open, what only the others take: a dark neutral gray under their hatching (Tailwind
 * neutral-600), darker than ignored faces' slate, which is lighter and blue.
 */
export const OTHER_FOLDER_COLOR = 0x525252
const OTHER_FOLDER_WEIGHT = 0.75

/** What the paint and the hatches read of the plan: which folder is open, and who lists each feature. */
interface PlanPaintInput {
  faces: Coverage['faces']
  setups: ReadonlyArray<PlanSetupView>
  /** A folder's id; `PART_ROW` or `IGNORE`, no folder open. */
  openId: string
  colorOf: (orientation: PlanOrientationView) => number
  /** Direction colours on: every folder paints. Off, only the open folder and its insides. */
  everyFolder?: boolean
}

/** The folder rows of a face's owners, each in its folder's colour, and whether the folder is open. */
const folderRows = ({ setups, openId, colorOf }: PlanPaintInput) => {
  const folders = allFolders(setups)
  /*
    An open folder's direction is the one selected: what is in it, or in the folders inside it, from
    that direction. A tilt inside it, or another way a 3+2 setup turns to, is another direction —
    read as the other folders are.
  */
  const open = folders.find((folder) => folder.id === openId)
  const inOpen = new Set(open ? allFolders([open]) : [])
  const way = open?.orientations[0]?.direction
  // Each feature's rows: the folder and direction listing it, in its colour.
  const rows = new Map<string, Array<{ color: number; selected: boolean }>>()
  for (const folder of folders) {
    for (const orientation of folder.orientations) {
      const selected =
        inOpen.has(folder) && way !== undefined && sameDirection(orientation.direction, way)
      for (const feature of orientation.features) {
        const key = tagKey(feature.tag)
        rows.set(key, [...(rows.get(key) ?? []), { color: colorOf(orientation), selected }])
      }
    }
  }
  return {
    open,
    rowsOf: (face: Face) => face.owners.flatMap((tag) => rows.get(tagKey(tag)) ?? []),
  }
}

/**
 * The model's colouring, face by face, as `classifyFaces` reads the plan — the one rule for what
 * machines each face, in either view. A pinned face takes its folder's colour in full, and so does
 * a face Toolpath machines, its setup's; an ignored face is slate (`DONE_COLOR`); an open face —
 * left to Toolpath — is left bare; a Not machined face red (`UNMACHINED_FACE_COLOR`). With no folder
 * open every folder paints, with secondary colours hatched on shared faces; with one open, only
 * its own direction does — it and the folders inside it facing the same way (FLD59). Every other
 * direction, inside it or not, is a dark gray
 * (`OTHER_FOLDER_COLOR`) with no tint of its own, hatched in its colour over the part
 * (`planHatch`). With direction colours off (MAP73), only the open folder's direction paints.
 */
export const planPaint = ({
  uncovered = true,
  ...input
}: PlanPaintInput & {
  /** Paint what no folder covers — Not machined red. Off where the DFM flags paint. */
  uncovered?: boolean
}): Array<FacePaint> => {
  const { faces, everyFolder = true } = input
  const { open, rowsOf } = folderRows(input)
  /**
   * A face's paint from the rows of its owners: the selected direction's first, in its colour; with
   * no folder open, the first met; with one open, gray where only other directions take it.
   */
  const fromFolder = (face: Face): Array<FacePaint> => {
    const own = rowsOf(face)
    const row = own.find((each) => each.selected) ?? own[0]
    if (!row) {
      return []
    }
    if (!open) {
      return everyFolder ? [{ region: face.region, color: row.color, weight: PART_WEIGHT }] : []
    }
    if (row.selected) {
      return [{ region: face.region, color: row.color, weight: OPEN_WEIGHT }]
    }
    return everyFolder
      ? [{ region: face.region, color: OTHER_FOLDER_COLOR, weight: OTHER_FOLDER_WEIGHT }]
      : []
  }
  return [
    ...faces.pinned.flatMap(fromFolder),
    ...faces.machined.flatMap(fromFolder),
    ...faces.ignored.map((face) => ({
      region: face.region,
      color: DONE_COLOR,
      weight: IGNORED_WEIGHT,
    })),
    ...(uncovered
      ? faces.notMachined.map((face) => ({
          region: face.region,
          color: UNMACHINED_FACE_COLOR,
          weight: NOT_MACHINED_WEIGHT,
        }))
      : []),
  ]
}

/** Diagonal lines across one face, in one colour: the viewer canvas's `RegionHatch`. */
export interface FaceHatch {
  region: number
  color: number
}

/**
 * With a folder open, what the other directions take, as lines across the part rather than paint:
 * each face a feature of another direction includes — another folder's, or a tilt inside the open
 * one — is hatched in that direction's colour, over the gray, or over the open folder's own colour
 * where it takes the face too, so a face touched from more than one direction shows each. With no
 * folder open, the first owner's colour paints the face (`planPaint`), and the remaining colours
 * are hatched over it. A colour once per face. Nothing with direction colours off.
 */
export const planHatch = (input: PlanPaintInput): Array<FaceHatch> => {
  const { faces, everyFolder = true } = input
  const { open, rowsOf } = folderRows(input)
  if (!everyFolder) {
    return []
  }
  const hatchOf = (face: Face): Array<FaceHatch> => {
    const own = rowsOf(face)
    const secondary = open
      ? own.filter((row) => !row.selected)
      : own.filter((row) => row.color !== own[0]?.color)
    const colors = new Set(secondary.map((row) => row.color))
    return [...colors].map((color) => ({ region: face.region, color }))
  }
  return [...faces.pinned.flatMap(hatchOf), ...faces.machined.flatMap(hatchOf)]
}

/**
 * The draft as the page lays it out: its folders, in its order and with its names, each listing
 * what is pinned in it in the order it was pinned (MP-5). Nothing of Toolpath's: the constraints,
 * and only those.
 */
export const draftView = (
  draft: Pick<Constraints, 'setups'>,
  part: PlanPart,
): Array<PlanSetupView> => {
  const placed = placedFolders(draft.setups)
  const view = (here: PlacedFolder): PlanSetupView => ({
    id: here.folder.id,
    name: here.folder.name,
    process: here.depth === 0 ? (here.setup.process ?? '3axis') : '3axis',
    orientations: [
      {
        id: `${here.folder.id}-0`,
        direction: here.direction,
        directionIndex: part.directionIndex(here.direction),
        features: unique(here.folder.features).map((tag) => featureRow(part, tag)),
      },
    ],
    depth: here.depth,
    setupId: here.setup.id,
    parentId: here.parent?.id ?? null,
    toolOrientation: here.toolOrientation,
    isFrame: here.frameId === here.folder.id,
    folders: placed.filter((child) => child.parent?.id === here.folder.id).map(view),
  })
  return placed.filter((each) => each.depth === 0).map(view)
}

/**
 * The statements Toolpath refused of a stated plan, one per clause, from the error its job failed
 * with — or null when the job failed for some other reason. Toolpath lists the first few and says
 * how many more; that tail is kept as a clause of its own.
 */
export const refusalClauses = (error: string | null): Array<string> | null => {
  // Faces marked done on an analysis by another kernel, whose numbering is not this one's.
  if (error?.startsWith('stale_regions:')) {
    return [
      'Ignored faces are from an older analysis of this part. Clear them, then ignore them again.',
    ]
  }
  // Faces marked done that the part's analysis does not have: marked on an older analysis.
  if (error?.startsWith('unknown_regions:')) {
    return [
      'Some ignored faces are not on this part’s current analysis. Clear them, then ignore them again.',
    ]
  }
  if (!error?.startsWith('refused_user_plan:')) {
    return null
  }
  const listed = error.slice(error.indexOf('refused:') + 'refused:'.length)
  return listed
    .split(';')
    .map((clause) => clause.trim())
    .filter(Boolean)
}
