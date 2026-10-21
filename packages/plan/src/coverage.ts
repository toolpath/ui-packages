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
  const owners = new Map<number, Array<string>>()
  for (const feature of features) {
    for (const region of feature.regionIdxs ?? []) {
      owners.set(region, [...(owners.get(region) ?? []), feature.tag])
    }
  }
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
    const any = (tags: ReadonlySet<string>) =>
      face.owners.some((tag) => tags.has(tag.toLowerCase()))
    const kind: CoverageKind = ignoredSet.has(face.region)
      ? 'ignored'
      : input.pinned !== undefined
        ? any(input.pinned)
          ? 'pinned'
          : 'open'
        : any(input.machined)
          ? 'machined'
          : 'notMachined'
    faces[kind].push(face)
  }
  for (const kind of COVERAGE_KINDS) {
    faces[kind].sort((a, b) => b.area - a.area)
  }
  return { total: areaOf(regions), faces }
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
  // Each known feature's faces, and how many of them are still ungathered.
  const includes = new Map<string, Array<Face>>()
  for (const face of faces) {
    for (const tag of new Set(face.owners)) {
      if (byTag.has(tag.toLowerCase())) {
        includes.set(tag, [...(includes.get(tag) ?? []), face])
      }
    }
  }
  const left = new Map([...includes].map(([tag, all]) => [tag, all.length]))
  const taken = new Set<number>()
  /** Whether `a` gathers before `b`: not a profile, more faces, more specific, smaller, by tag. */
  const before = (a: string, b: string): boolean => {
    const [fa, fb] = [byTag.get(a.toLowerCase())!, byTag.get(b.toLowerCase())!]
    return (
      (Number(isFallback(fa.featureType)) - Number(isFallback(fb.featureType)) ||
        left.get(b)! - left.get(a)! ||
        rankOf(fa.featureType) - rankOf(fb.featureType) ||
        (fa.regionIdxs?.length ?? 0) - (fb.regionIdxs?.length ?? 0) ||
        a.localeCompare(b)) < 0
    )
  }
  const groups: Array<FaceGroup> = []
  for (;;) {
    let best: string | null = null
    for (const [tag, count] of left) {
      if (count > 0 && (best === null || before(tag, best))) {
        best = tag
      }
    }
    if (best === null) {
      break
    }
    const gathered = includes.get(best)!.filter((face) => !taken.has(face.region))
    for (const face of gathered) {
      taken.add(face.region)
      for (const tag of new Set(face.owners)) {
        if (left.has(tag)) {
          left.set(tag, left.get(tag)! - 1)
        }
      }
    }
    groups.push({ tag: best, faces: gathered, area: areaOf(gathered) })
  }
  for (const face of faces) {
    if (!taken.has(face.region)) {
      groups.push({ tag: null, faces: [face], area: face.area })
    }
  }
  return groups.sort((a, b) => Number(a.tag === null) - Number(b.tag === null) || b.area - a.area)
}
