import {
  findPlaced,
  ignoredAsSaved,
  pinsWhere,
  unpinFeature,
  withIgnored,
  withoutIgnored,
  type DraftSetup,
  type Constraints,
  type PinnedFeature,
  type PlanRules,
} from './plan-draft'
import { isFallback, type CoverageFeature } from './coverage'
import { faceRegions, type SplitRegion } from './readings'

/*
  What ignoring does to the plan, apart from the page that wires it. An ignored region needs no
  machining — it is at its final surface already — which is a fact about the part's geometry, from
  no direction and of no feature. The region — the kernel's, what `doneRegions` carries — is the
  unit: a click ignores the region clicked, or in Feature mode a feature's regions, and the regions
  are what is kept (`done`) and sent to Toolpath. Features never name what is ignored: a status
  note and a tray row are region ids. The ignore wins over a pin, one way: a pin whose every region
  is ignored is unpinned — plainly, nothing kept out — while a pin with a region left stays,
  Toolpath machining it whole and keeping its ignored regions out of its issues (Engine API 1.19).
  The other way, pinning wins: a feature pinned has its regions un-ignored with it (`withPin` in
  `pin.ts`). Un-ignoring never re-pins.
*/

/**
 * Ignore faces. A pin — in any folder — whose every face is ignored with them is unpinned: the
 * ignore wins. A plain unpin: the feature is open, its faces ignored.
 */
export const ignoreEdit = (
  plan: Constraints,
  regions: ReadonlyArray<number>,
  context: Pick<PlanRules, 'kernel' | 'regionsOf'>,
): { intent: Constraints; unpinned: Array<PinnedFeature> } => {
  const ignored = withIgnored(plan, regions, context.kernel)
  const done = new Set(ignored.done)
  const these = new Set(regions)
  // Pins with a face among those ignored now, and none left: covered by this ignoring.
  const unpinned = pinsWhere(plan.setups, (tag) => {
    const faces = context.regionsOf(tag)
    return faces.some((face) => these.has(face)) && faces.every((face) => done.has(face))
  })
  return {
    intent: {
      setups: unpinned.reduce(
        (all, pin) => unpinFeature(all, pin.setupId, pin.tag),
        [...plan.setups],
      ),
      ...ignored,
    },
    unpinned,
  }
}

/** What a status note adds of the pins ignoring took out, by folder: nothing, or " Unpinned from …". */
export const unpinnedNote = (
  unpinned: ReadonlyArray<PinnedFeature>,
  setups: ReadonlyArray<DraftSetup>,
): string => {
  const folders = [
    ...new Set(unpinned.map((pin) => findPlaced(setups, pin.setupId)?.folder.name ?? 'its folder')),
  ]
  return folders.length > 0 ? ` Unpinned from ${folders.join(', ')}.` : ''
}

/** What a status note says of regions no longer ignored: nothing, or " Region 4 no longer ignored.". */
export const unignoredNote = (regions: ReadonlyArray<number>): string =>
  regions.length > 0 ? ` ${regionLabel(regions)} no longer ignored.` : ''

/** Stop ignoring faces. */
export const unignoreEdit = (
  plan: Constraints,
  regions: ReadonlyArray<number>,
  context: Pick<PlanRules, 'kernel'>,
): Constraints => ({ setups: [...plan.setups], ...withoutIgnored(plan, regions, context.kernel) })

/**
 * What a click on the part takes while ignoring: the region clicked, every region of the CAD face
 * it was split from, or a feature's regions.
 */
export type IgnoreMode = 'region' | 'face' | 'feature'

/**
 * Which feature a click on `region` means, in Feature mode: the most specific feature owning it —
 * the owner with the fewest regions, a tie going to the first by tag. From every direction alike:
 * the kernel reads a feature once per direction it is cut from, so owners of exactly the same
 * regions are one. A profile (`isFallback`) includes most of a direction's faces and never speaks
 * for one. Null where no such feature owns the region.
 */
const featureAt = (
  region: number,
  features: ReadonlyArray<CoverageFeature>,
): CoverageFeature | null =>
  featuresAt(region, features).find((feature) => !isFallback(feature.featureType)) ?? null

/**
 * Every feature a click on `region` reads, in Feature mode, as a choice offers them: the most
 * specific first — fewest regions, then by tag — and profiles (`isFallback`) last, offered but never
 * the default. Owners of exactly the same regions are one.
 */
export const featuresAt = (
  region: number,
  features: ReadonlyArray<CoverageFeature>,
): Array<CoverageFeature> => {
  const owners = features
    .filter((feature) => (feature.regionIdxs ?? []).includes(region))
    .sort(
      (a, b) =>
        Number(isFallback(a.featureType)) - Number(isFallback(b.featureType)) ||
        (a.regionIdxs?.length ?? 0) - (b.regionIdxs?.length ?? 0) ||
        a.tag.localeCompare(b.tag),
    )
  const seen = new Set<string>()
  return owners.filter((feature) => {
    const key = [...new Set(feature.regionIdxs ?? [])].sort((a, b) => a - b).join(',')
    return seen.has(key) ? false : (seen.add(key), true)
  })
}

/** What a click took: the feature it means, in Feature mode, and the regions. */
export interface IgnoredAs {
  tag: string | null
  regions: ReadonlyArray<number>
}

/**
 * What a click on `region` takes, by mode: the region clicked; in Face mode every region of the CAD
 * face it was split from (`faceRegions`, the kernel's `splitOrigin` lineage); in Feature mode the
 * regions of the feature the click means (`featureAt`), the region alone where no feature does.
 * What a click acts on and what the pointer lights, alike.
 */
export const ignoreSelection = ({
  region,
  mode,
  features,
  regions,
}: {
  region: number
  mode: IgnoreMode
  features: ReadonlyArray<CoverageFeature>
  /** The part's regions, with the CAD face each was split from. */
  regions: ReadonlyArray<SplitRegion>
}): IgnoredAs => {
  if (mode === 'face') {
    return { tag: null, regions: faceRegions(regions, region) }
  }
  if (mode === 'region') {
    return { tag: null, regions: [region] }
  }
  const feature = featureAt(region, features)
  return {
    tag: feature?.tag ?? null,
    regions: feature ? [...new Set(feature.regionIdxs ?? [])] : [region],
  }
}

/**
 * What a group of regions is called — a tray row, a status note: its region ids, ascending.
 * "Region 4", or "Regions 4, 6" for a feature's regions. Never a feature's name.
 */
export const regionLabel = (regions: ReadonlyArray<number>): string => {
  const ids = [...regions].sort((a, b) => a - b)
  return `${ids.length === 1 ? 'Region' : 'Regions'} ${ids.join(', ')}`
}

/** The plan with a click's regions ignored as `saved` had them, and nothing else changed. */
export const takeBackIgnore = (
  plan: Constraints,
  saved: Constraints,
  regions: ReadonlyArray<number>,
  context: Pick<PlanRules, 'kernel'>,
): Constraints => ({
  setups: [...plan.setups],
  ...ignoredAsSaved(plan, saved, regions, context.kernel),
})

/** What a click on the part does while ignoring (`ignoreClick`). */
type IgnoreClick =
  /** The region was ignored: the ignored regions among those taken are let go. */
  | { kind: 'unignore'; regions: Array<number> }
  /** What the click takes is ignored. */
  | { kind: 'ignore'; regions: Array<number> }

/**
 * What a click on region `region`, taking `regions` (`ignoreSelection`), does while ignoring:
 * ignored, the ignored regions among those taken are let go; otherwise they are ignored.
 */
export const ignoreClick = ({
  region,
  ignored,
  regions,
}: {
  region: number
  /** The regions ignored now. */
  ignored: ReadonlySet<number>
  /** The regions the click takes: the CAD face clicked, or a feature's faces. */
  regions: ReadonlyArray<number>
}): IgnoreClick => {
  if (ignored.has(region)) {
    return { kind: 'unignore', regions: regions.filter((each) => ignored.has(each)) }
  }
  return { kind: 'ignore', regions: [...regions] }
}
