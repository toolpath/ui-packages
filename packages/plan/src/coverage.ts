/*
  Who machines each face of a part, read the one way the server and every page read it. Two views,
  one rule: the constraints view reads the person's pins — a face is ignored, pinned, or open (left
  to Toolpath); the results view reads Toolpath's plan — a face is ignored, machined, or not
  machined. Ignored outranks the rest: an ignored face is ignored whoever pins a feature over it,
  and a pin ignored whole is unpinned (`ignoreEdit`).
*/

export type CoverageKind = 'pinned' | 'ignored' | 'open' | 'machined' | 'notMachined'

/**
 * In the order the coverage bar draws them, and a feature is said to be where its faces differ
 * (`stateOf`). A face itself is weighed by `classifyFaces`, ignored first.
 */
export const COVERAGE_KINDS: ReadonlyArray<CoverageKind> = [
  'pinned',
  'ignored',
  'open',
  'machined',
  'notMachined',
]

/** Each kind in the glossary's words: what the bar, the lists and the Pin features notes say. */
export const COVERAGE_LABELS: Record<CoverageKind, string> = {
  pinned: 'Pinned',
  ignored: 'Ignored',
  open: 'Open',
  machined: 'Machined',
  notMachined: 'Not machined',
}

/** A face: its region, its area (mm²), and the features that include it. */
export interface Face {
  region: number
  area: number
  owners: Array<string>
}

/** A part's faces by kind, each largest first, and its whole surface (mm²). */
export interface Coverage {
  total: number
  faces: Record<CoverageKind, Array<Face>>
}

/** Each face of a coverage by region, and who machines it. */
export const facesByRegion = (
  coverage: Coverage | null,
): Map<number, { face: Face; kind: CoverageKind }> =>
  new Map(
    COVERAGE_KINDS.flatMap((kind) =>
      (coverage?.faces[kind] ?? []).map((face) => [face.region, { face, kind }] as const),
    ),
  )

/** A feature as the part's analysis reads it. */
export interface CoverageFeature {
  tag: string
  featureType: string
  regionIdxs?: ReadonlyArray<number> | null
}

/** A tag as compared: Toolpath and the analysis spell a tag differently, so in lower case. */
export const tagKey = (tag: string): string => tag.toLowerCase()

/** Tags in lower case: Toolpath and the analysis spell a tag differently. */
export const tagSet = (tags: Iterable<string>): Set<string> => new Set([...tags].map(tagKey))

/** What every action of a plan cuts, by tag (lower case). */
export const planTags = (
  setups: ReadonlyArray<{ actions: ReadonlyArray<{ featureTags?: ReadonlyArray<string> | null }> }>,
): Set<string> =>
  tagSet(setups.flatMap((setup) => setup.actions.flatMap((action) => action.featureTags ?? [])))

export const areaOf = (faces: ReadonlyArray<Pick<Face, 'area'>>): number =>
  faces.reduce((sum, face) => sum + face.area, 0)

/** What `classifyFaces` reads of the part: its faces, its features, and the faces ignored. */
interface ClassifiedPart {
  regions: ReadonlyArray<{ idx: number; area: number }>
  features: ReadonlyArray<CoverageFeature>
  ignored?: ReadonlyArray<number>
}

/** The constraints view: the person's pins, by tag (lower case). The rest is open. */
export interface ConstraintsCoverage extends ClassifiedPart {
  pinned: ReadonlySet<string>
  /** One view at a time: never Toolpath's plan beside the pins. */
  machined?: never
}

/** The results view: what Toolpath's plan cuts, by tag (lower case). The rest is not machined. */
export interface ResultsCoverage extends ClassifiedPart {
  machined: ReadonlySet<string>
  /** One view at a time: never the pins beside Toolpath's plan. */
  pinned?: never
}

/**
 * Each face in exactly one kind: ignored first, then — constraints — pinned or open, or — results —
 * machined or not machined. Every tag set is lower case. The other view's kinds are empty.
 */
export const classifyFaces = (input: ConstraintsCoverage | ResultsCoverage): Coverage => {
  const { regions, features, ignored = [] } = input
  const owners = ownersByRegion(features)
  const ignoredSet = new Set(ignored)
  const faces: Coverage['faces'] = {
    pinned: [],
    ignored: [],
    open: [],
    machined: [],
    notMachined: [],
  }
  for (const region of regions) {
    const face = { region: region.idx, area: region.area, owners: owners.get(region.idx) ?? [] }
    faces[kindOf(face, ignoredSet, input)].push(face)
  }
  for (const kind of COVERAGE_KINDS) {
    faces[kind].sort((a, b) => b.area - a.area)
  }
  return { total: areaOf(regions), faces }
}

/** The tags of the features that include each region, in feature order. */
const ownersByRegion = (features: ReadonlyArray<CoverageFeature>): Map<number, Array<string>> => {
  const owners = new Map<number, Array<string>>()
  for (const feature of features) {
    for (const region of feature.regionIdxs ?? []) {
      owners.set(region, [...(owners.get(region) ?? []), feature.tag])
    }
  }
  return owners
}

/** Who machines one face: ignored first, then by the view's pins or Toolpath's plan. */
const kindOf = (
  face: Face,
  ignored: ReadonlySet<number>,
  input: ConstraintsCoverage | ResultsCoverage,
): CoverageKind => {
  if (ignored.has(face.region)) {
    return 'ignored'
  }
  const ownedBy = (tags: ReadonlySet<string>) =>
    face.owners.some((tag) => tags.has(tag.toLowerCase()))
  if (input.pinned !== undefined) {
    return ownedBy(input.pinned) ? 'pinned' : 'open'
  }
  return ownedBy(input.machined) ? 'machined' : 'notMachined'
}

/** Faces gathered under the one feature that would machine them all: a row of a Not machined list. */
export interface FaceGroup {
  /** The feature, or null for a face no feature includes: listed alone. */
  tag: string | null
  /** Its faces, largest first. */
  faces: Array<Face>
  area: number
}

/** Feature types by rank, most specific first, as the viewer ranks them. */
const RANKS: ReadonlyArray<ReadonlyArray<string>> = [
  ['blind_hole', 'through_hole', 'filleted_blind_hole'],
  ['pocket', 'open_pocket', 'boss', 'filleted_boss', 'undercut_tslot', 'undercut_dovetail', 'sink'],
  ['chamfer', 'inner_fillet', 'outer_fillet', 'contour_surface', 'slanted_face'],
  ['wall', 'face'],
  ['profile'],
]
const RANK_OF = new Map(RANKS.flatMap((types, rank) => types.map((type) => [type, rank])))
/** An unknown type ranks after the shapes and before walls and faces. */
const rankOf = (type: string): number => RANK_OF.get(type) ?? 2.5
/** A type that includes most of a direction's faces by its nature, so it never speaks for one. */
export const isFallback = (type: string): boolean => type === 'profile'

/**
 * Gather faces under features, so one choice settles several. Greedy: the feature including the
 * most faces still ungathered goes first (the more specific, then the smaller, among equals) until
 * every face is under one. A profile includes most of its direction's faces, so it is taken only for
 * a face nothing else includes. A face no feature includes is a group of its own. Features come
 * first, largest first, then the faces no feature includes.
 */
export const groupFaces = (
  faces: ReadonlyArray<Face>,
  features: ReadonlyArray<CoverageFeature>,
): Array<FaceGroup> => {
  const byTag = new Map(features.map((feature) => [feature.tag.toLowerCase(), feature]))
  const { groups, taken } = gatherUnderFeatures(facesOfFeatures(faces, byTag), byTag)
  const alone = faces
    .filter((face) => !taken.has(face.region))
    .map((face): FaceGroup => ({ tag: null, faces: [face], area: face.area }))
  return [...groups, ...alone].sort(
    (a, b) => Number(a.tag === null) - Number(b.tag === null) || b.area - a.area,
  )
}

/** Features by tag in lower case. */
type FeaturesByTag = ReadonlyMap<string, CoverageFeature>

/** Each known feature's faces, by its tag as the faces spell it. */
const facesOfFeatures = (
  faces: ReadonlyArray<Face>,
  byTag: FeaturesByTag,
): Map<string, Array<Face>> => {
  const includes = new Map<string, Array<Face>>()
  for (const face of faces) {
    const known = [...new Set(face.owners)].filter((tag) => byTag.has(tag.toLowerCase()))
    for (const tag of known) {
      includes.set(tag, [...(includes.get(tag) ?? []), face])
    }
  }
  return includes
}

/** The greedy gathering: a group per feature taken, in the order taken, and the faces it took. */
const gatherUnderFeatures = (
  includes: ReadonlyMap<string, ReadonlyArray<Face>>,
  byTag: FeaturesByTag,
): { groups: Array<FaceGroup>; taken: Set<number> } => {
  // How many of each feature's faces are still ungathered.
  const left = new Map([...includes].map(([tag, all]) => [tag, all.length]))
  const before = gathersBefore(byTag, left)
  const taken = new Set<number>()
  const groups: Array<FaceGroup> = []
  let best = nextToGather(left, before)
  while (best !== null) {
    const gathered = includes.get(best)!.filter((face) => !taken.has(face.region))
    markGathered(gathered, taken, left)
    groups.push({ tag: best, faces: gathered, area: areaOf(gathered) })
    best = nextToGather(left, before)
  }
  return { groups, taken }
}

/**
 * Whether `a` gathers before `b`: not a profile, more faces, more specific, smaller, by tag. Reads
 * `left` as it stands when asked.
 */
const gathersBefore =
  (byTag: FeaturesByTag, left: ReadonlyMap<string, number>) =>
  (a: string, b: string): boolean => {
    const [fa, fb] = [byTag.get(a.toLowerCase())!, byTag.get(b.toLowerCase())!]
    return (
      (Number(isFallback(fa.featureType)) - Number(isFallback(fb.featureType)) ||
        left.get(b)! - left.get(a)! ||
        rankOf(fa.featureType) - rankOf(fb.featureType) ||
        (fa.regionIdxs?.length ?? 0) - (fb.regionIdxs?.length ?? 0) ||
        a.localeCompare(b)) < 0
    )
  }

/** The feature with faces left that gathers before every other, or null with none left. */
const nextToGather = (
  left: ReadonlyMap<string, number>,
  before: (a: string, b: string) => boolean,
): string | null => {
  let best: string | null = null
  for (const [tag, count] of left) {
    if (count > 0 && (best === null || before(tag, best))) {
      best = tag
    }
  }
  return best
}

/** Faces taken: each one's region marked, and one fewer left for every feature including it. */
const markGathered = (
  gathered: ReadonlyArray<Face>,
  taken: Set<number>,
  left: Map<string, number>,
): void => {
  for (const face of gathered) {
    taken.add(face.region)
    for (const tag of new Set(face.owners)) {
      countDown(left, tag)
    }
  }
}

/** One fewer left for `tag`, where it is counted. */
const countDown = (left: Map<string, number>, tag: string): void => {
  const count = left.get(tag)
  if (count !== undefined) {
    left.set(tag, count - 1)
  }
}
