import { tagKey } from '../faces/coverage'
import type { PlanDirection, TrimmedFeature } from '../results/plan'
import {
  additionalDirectionsSent,
  currentFor,
  findPlaced,
  framesOf,
  MAX_SPEC_REGIONS,
  placedGroups,
  sameDirection,
  type Constraints,
  type CustomFeature,
  type DraftGroup,
  type DraftSetup,
} from './constraints'
import type { Cut } from './pieces'
import { GONE, type Refused } from './refusals'

/*
  Region plans: a group's own features, each a list of the part's regions, beside the feature tags
  it assigns. A person makes one by assigning regions rather than a feature Toolpath
  read, or by editing an assigned feature's regions. They go to Toolpath only in a plan spec, which
  states a plan region by region.

  A region is in at most one feature of a frame. Taking regions out of an assigned feature leaves
  what's left of it as features of the group's own; taking them out of one of the group's own
  features shrinks it, and one with no regions left goes. What's left is cut into the features
  Toolpath can read it as, where the edit is given the way to (`Cut`, see `pieces.ts`). A feature
  a person makes of regions is kept as made, until another edit takes some of its regions: then
  what's left of it is cut like any other's.
*/

/** Where a feature is found: assigned by its tag, or one of the group's own by its place. */
export type FeatureRef = { tag: string } | { custom: number }

/** A part's features, as far as a region plan reads them: from the part report. */
export interface SpecFeature {
  featureTag: string
  regionIdxs: ReadonlyArray<number>
  featureType: string
  machiningDirection: PlanDirection
}

const ascending = (regions: Iterable<number>): Array<number> =>
  [...new Set(regions)].sort((a, b) => a - b)

const customOf = (group: DraftGroup): Array<CustomFeature> => group.custom ?? []

/** A feature of a group's own on these regions, stamped with the analysis numbering them (D-44). */
const ownFeature = (regions: Iterable<number>, preparationId: string): CustomFeature => ({
  regions: ascending(regions),
  preparationId,
})

const NOT_AN_ACTION: Refused = { refused: { kind: 'notAnAction' } }
const OTHER_WAY: Refused = { refused: { kind: 'otherWay' } }
/** A part whose analysis numbers no regions (no `preparationId`) states no feature by them (D-39). */
const NOT_BY_REGION: Refused = { refused: { kind: 'notByRegion' } }

/** A group with these features of its own: none is no field, as a stored group with none has. */
const withCustom = (group: DraftGroup, custom: Array<CustomFeature>): DraftGroup => {
  const { custom: _was, ...rest } = group
  return custom.length > 0 ? { ...rest, custom } : rest
}

/** The draft with every group, at any depth, changed. */
const everyGroup = (
  setups: ReadonlyArray<DraftSetup>,
  change: (group: DraftGroup) => DraftGroup,
): Array<DraftSetup> => {
  const visit = (group: DraftGroup): DraftGroup => {
    const next = change(group)
    return { ...next, groups: next.groups.map(visit) }
  }
  return setups.map((setup) => visit(setup) as DraftSetup)
}

/** What's left of a feature in a group, cut by `cut`, or kept as one where there's none. */
const piecesLeft = (
  cut: Cut | undefined,
  groupId: string,
  regions: Array<number>,
): Array<Array<number>> => (cut ? cut(groupId, regions) : [regions])

/**
 * A group with these regions taken out of its features. An assigned feature they touch goes, and
 * what's left of it stays as the group's own, numbered by `preparationId`, cut by `cut`; its own
 * features shrink (`shrunk`), and empty ones go. With no `preparationId` nothing can be stated by
 * region, so an assigned feature is never trimmed: it goes only where every region of it is taken.
 */
const withoutRegions = (
  group: DraftGroup,
  regions: ReadonlySet<number>,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  preparationId: string | null,
  cut: Cut | undefined,
): DraftGroup => {
  const kept: Array<string> = []
  const left: Array<CustomFeature> = []
  for (const tag of group.features) {
    const own = regionsOf(tag)
    const rest = own.filter((region) => !regions.has(region))
    if (rest.length === own.length) {
      kept.push(tag)
      continue
    }
    if (rest.length === 0) {
      continue
    }
    if (preparationId === null) {
      kept.push(tag)
      continue
    }
    left.push(...piecesLeft(cut, group.id, rest).map((piece) => ownFeature(piece, preparationId)))
  }
  return withCustom({ ...group, features: kept }, [
    ...shrunk(customOf(group), regions, cut, group.id),
    ...left,
  ])
}

/**
 * A group's own features with these regions out of them, what's left of each cut by `cut` in its
 * place, each piece keeping its stamp; empty ones go, and one that lost any loses its type, which
 * was read off the regions it had.
 */
const shrunk = (
  custom: ReadonlyArray<CustomFeature>,
  regions: ReadonlySet<number>,
  cut: Cut | undefined,
  groupId: string,
): Array<CustomFeature> =>
  custom.flatMap((feature) => {
    const left = feature.regions.filter((region) => !regions.has(region))
    if (left.length === feature.regions.length) {
      return [feature]
    }
    const { featureType: _read, ...rest } = feature
    return left.length > 0
      ? piecesLeft(cut, groupId, left).map((piece) => ({ ...rest, regions: piece }))
      : []
  })

/** The groups that cut from the same frame as `groupId`: it and the groups that follow its frame. */
const frameGroupIds = (setups: ReadonlyArray<DraftSetup>, groupId: string): Set<string> => {
  const placed = placedGroups(setups)
  const frameId = placed.find((each) => each.group.id === groupId)?.frameId
  return new Set(placed.filter((each) => each.frameId === frameId).map((each) => each.group.id))
}

/** The faces done, with no kernel named once there are none (as `doneAs` leaves them). */
const withDone = (
  draft: Constraints,
  done: Array<number>,
): Pick<Constraints, 'done' | 'doneKernel'> => ({
  done,
  doneKernel: done.length > 0 ? draft.doneKernel : null,
})

/**
 * Regions assigned to a group as one feature of its own. They come out of every other feature in
 * its frame; with `share` false (Take Over) out of every other frame's too, and with `share` true
 * (Keep Both) other frames keep them, so they are cut from both. They are no longer done. Refused
 * on a part with no `preparationId`, or for a group gone.
 */
export const assignRegionsEdit = (
  draft: Constraints,
  groupId: string,
  regions: ReadonlyArray<number>,
  share: boolean,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  preparationId: string | null,
  cut: Cut | undefined,
): Constraints | Refused => {
  if (preparationId === null) {
    return NOT_BY_REGION
  }
  if (!findPlaced(draft.setups, groupId)) {
    return { refused: GONE }
  }
  const taken = new Set(regions)
  const frame = frameGroupIds(draft.setups, groupId)
  const setups = everyGroup(draft.setups, (group) => {
    const cleared =
      share && !frame.has(group.id)
        ? group
        : withoutRegions(group, taken, regionsOf, preparationId, cut)
    return group.id === groupId
      ? withCustom(cleared, [...customOf(cleared), ownFeature(regions, preparationId)])
      : cleared
  })
  return {
    ...draft,
    setups,
    ...withDone(
      draft,
      draft.done.filter((region) => !taken.has(region)),
    ),
  }
}

/**
 * A feature's regions edited: the feature, assigned or the group's own, replaced by these regions as
 * one of the group's own (an assigned feature left as it was stays assigned). One of the group's own
 * keeps its place among them. Its regions leave every other feature of its frame; of other frames'
 * features, only the regions it gains leave (Take Over), so a region it shared stays shared. Regions
 * it loses are let go. With no regions, the feature goes. With `into`, another group of the same
 * frame, the edited feature goes there instead of staying in `groupId` (D-18).
 *
 * Refused on a part with no `preparationId`; for a group gone, a feature not in it, or `into` a
 * group of another frame; and for one of the group's own made on another analysis (D-44), whose
 * regions name other faces under this one: it can only be let go, and made again.
 */
export const editFeatureEdit = (
  draft: Constraints,
  groupId: string,
  feature: FeatureRef,
  regions: ReadonlyArray<number>,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  preparationId: string | null,
  cut: Cut | undefined,
  into?: string,
): Constraints | Refused => {
  if (preparationId === null) {
    return NOT_BY_REGION
  }
  const group = findPlaced(draft.setups, groupId)?.group
  if (!group) {
    return { refused: GONE }
  }
  const isTag = 'tag' in feature
  const own = isTag ? null : customOf(group)[feature.custom]
  if (isTag ? !group.features.some((tag) => tagKey(tag) === tagKey(feature.tag)) : !own) {
    return NOT_AN_ACTION
  }
  if (own && own.preparationId !== preparationId) {
    return { refused: { kind: 'staleFeature' } }
  }
  const before = ascending(isTag ? regionsOf(feature.tag) : own!.regions)
  const next = ascending(regions)
  const same = next.length === before.length && next.every((region, i) => region === before[i])
  if (isTag && same) {
    return draft
  }
  // A type read off the regions holds while they do, as one moved `into` another group.
  const edited =
    same && own?.featureType
      ? { ...ownFeature(next, preparationId), featureType: own.featureType }
      : ownFeature(next, preparationId)
  const all = new Set(next)
  const gained = new Set(next.filter((region) => !before.includes(region)))
  const frame = frameGroupIds(draft.setups, groupId)
  if (into !== undefined && !frame.has(into)) {
    return findPlaced(draft.setups, into) ? OTHER_WAY : { refused: GONE }
  }
  const target = into ?? groupId
  const setups = everyGroup(draft.setups, (each) => {
    if (each.id === target && target !== groupId) {
      const cleared = withoutRegions(each, all, regionsOf, preparationId, cut)
      return next.length === 0 ? cleared : withCustom(cleared, [...customOf(cleared), edited])
    }
    if (each.id !== groupId) {
      return withoutRegions(each, frame.has(each.id) ? all : gained, regionsOf, preparationId, cut)
    }
    const others = isTag
      ? { ...each, features: each.features.filter((tag) => tagKey(tag) !== tagKey(feature.tag)) }
      : withCustom(
          each,
          customOf(each).filter((_, i) => i !== feature.custom),
        )
    const cleared = withoutRegions(others, all, regionsOf, preparationId, cut)
    if (next.length === 0 || target !== groupId) {
      return cleared
    }
    const custom = [...customOf(cleared)]
    custom.splice(isTag ? custom.length : Math.min(feature.custom, custom.length), 0, edited)
    return withCustom(cleared, custom)
  })
  return {
    ...draft,
    setups,
    ...withDone(
      draft,
      draft.done.filter((region) => !all.has(region)),
    ),
  }
}

/**
 * One of a group's own features let go: Toolpath decides its regions again. Refused for a group
 * gone, or a place it has no feature at.
 */
export const unassignCustomEdit = (
  draft: Constraints,
  groupId: string,
  index: number,
): Constraints | Refused => {
  const group = findPlaced(draft.setups, groupId)?.group
  if (!group) {
    return { refused: GONE }
  }
  if (!customOf(group)[index]) {
    return NOT_AN_ACTION
  }
  return {
    ...draft,
    setups: everyGroup(draft.setups, (each) =>
      each.id === groupId
        ? withCustom(
            each,
            customOf(each).filter((_, i) => i !== index),
          )
        : each,
    ),
  }
}

/**
 * Regions open: in no feature of any group, and not done. Toolpath decides them. With `groupId`, they
 * leave only that group's features — what's left of an assigned feature stays as one of its own —
 * and other groups and the faces done keep them.
 */
export const openRegionsEdit = (
  draft: Constraints,
  regions: ReadonlyArray<number>,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  preparationId: string | null,
  cut: Cut | undefined,
  groupId?: string,
): Constraints => {
  const released = new Set(regions)
  if (groupId !== undefined) {
    return {
      ...draft,
      setups: everyGroup(draft.setups, (group) =>
        group.id === groupId
          ? withoutRegions(group, released, regionsOf, preparationId, cut)
          : group,
      ),
    }
  }
  return {
    ...draft,
    setups: everyGroup(draft.setups, (group) =>
      withoutRegions(group, released, regionsOf, preparationId, cut),
    ),
    ...withDone(
      draft,
      draft.done.filter((region) => !released.has(region)),
    ),
  }
}

/** Regions done also leave every group's own features, what's left cut by `cut`: done outranks any assignment. */
const withoutDoneRegions = (draft: Constraints, cut: Cut | undefined): Constraints => {
  const done = new Set(draft.done)
  if (done.size === 0) {
    return draft
  }
  return {
    ...draft,
    setups: everyGroup(draft.setups, (group) =>
      group.custom ? withCustom(group, shrunk(group.custom, done, cut, group.id)) : group,
    ),
  }
}

/** A custom feature's key where the app lists it beside assigned features: never stored. */
export const customKey = (groupId: string, index: number): string => `custom:${groupId}:${index}`

/** Every group's own features, keyed, with the group they're in. */
export const customFeaturesOf = (
  setups: ReadonlyArray<DraftSetup>,
): Array<{ key: string; groupId: string; index: number; regions: Array<number> }> =>
  placedGroups(setups).flatMap(({ group }) =>
    customOf(group).map((feature, index) => ({
      key: customKey(group.id, index),
      groupId: group.id,
      index,
      regions: feature.regions,
    })),
  )

const SAME_DIRECTION = Math.cos((0.1 * Math.PI) / 180)
const sameWay = (a: PlanDirection, b: PlanDirection): boolean =>
  a.x * b.x + a.y * b.y + a.z * b.z >= SAME_DIRECTION

/** The Engine's plan spec, as far as quoting states one. */
export interface PlanSpecStatement {
  preparationId: string
  skippedRegions?: Array<number>
  setups?: Array<{
    direction: PlanDirection
    exclusiveRegions?: Array<number>
    features?: Array<{ regions: Array<number>; featureType?: string }>
  }>
  /** The directions Toolpath may add setups in; absent for any, `[]` for none. */
  additionalDirections?: Array<PlanDirection>
}

/** Where a feature of a plan spec came from: the group it is stated in, and the feature there. */
export interface SpecSource {
  groupId: string
  feature: FeatureRef
}

/** A draft's plan spec, where each feature in it came from, and what it could not state. */
export interface DraftPlanSpec {
  spec: PlanSpecStatement
  /**
   * `sources[i][j]` is where `spec.setups[i].features[j]` came from: a refusal names a feature by
   * that place in the spec as sent (D-26).
   */
  sources: Array<Array<SpecSource>>
  /**
   * Assigned features the part's report does not have, so not stated by their regions: a plan sent
   * without them would quietly leave them out.
   */
  unstated: Array<{ groupId: string; tag: string }>
  /**
   * Whether the spec holds more region indices, over all its lists, than the Engine takes in one
   * (20,000): sent, it would be refused.
   */
  tooManyRegions: boolean
}

/**
 * The plan spec a draft states, one setup per frame in tree order, each listing its assigned
 * features, then its own: an assigned feature as its regions and type, read from the part; one of the
 * group's own as its regions, with the type it carries (a feature a plan cut), else a type only where
 * they are exactly one feature read from the frame's direction, and exclusive to the frame unless
 * another frame holds them too. Done regions are skipped, and a feature left with none is not
 * stated.
 */
export const planSpecOf = (
  draft: Pick<Constraints, 'setups' | 'done' | 'additionalDirections'>,
  preparationId: string,
  features: ReadonlyArray<SpecFeature>,
): DraftPlanSpec => {
  const byTag = new Map(features.map((feature) => [tagKey(feature.featureTag), feature]))
  const done = new Set(draft.done)
  const placed = placedGroups(draft.setups)
  const unstated: DraftPlanSpec['unstated'] = []
  const frames = framesOf(draft.setups).map((frame) => {
    const inFrame = placed.filter((each) => each.frameId === frame.id)
    /** Regions as one feature read from this frame's direction, typed only where they are exactly one. */
    const typed = (regions: Array<number>) => {
      const reading = features.find(
        (each) =>
          sameWay(each.machiningDirection, frame.direction) &&
          each.regionIdxs.length === regions.length &&
          regions.every((region) => each.regionIdxs.includes(region)),
      )
      return reading ? { regions, featureType: reading.featureType } : { regions }
    }
    // Ignore outranks any statement: a skipped region is in no feature, nor exclusive.
    const kept = (regions: Iterable<number>) =>
      ascending(regions).filter((region) => !done.has(region))
    const assigned = inFrame.flatMap(({ group }) =>
      group.features.flatMap((tag) => {
        const feature = byTag.get(tagKey(tag))
        if (!feature) {
          unstated.push({ groupId: group.id, tag })
          return []
        }
        const regions = kept(feature.regionIdxs)
        if (regions.length === 0) {
          return []
        }
        return [
          {
            stated:
              regions.length === feature.regionIdxs.length
                ? { regions, featureType: feature.featureType }
                : typed(regions),
            source: { groupId: group.id, feature: { tag } },
          },
        ]
      }),
    )
    const own = inFrame.flatMap(({ group }) =>
      customOf(group).flatMap((feature, index) => {
        const regions = kept(feature.regions)
        if (regions.length === 0) {
          return []
        }
        return [
          {
            stated:
              feature.featureType && regions.length === feature.regions.length
                ? { regions, featureType: feature.featureType }
                : typed(regions),
            source: { groupId: group.id, feature: { custom: index } },
          },
        ]
      }),
    )
    return { direction: frame.direction, all: [...assigned, ...own], own }
  })
  // The frames that state each region in a feature.
  const holders = new Map<number, Set<number>>()
  frames.forEach(({ all }, at) =>
    all
      .flatMap(({ stated }) => stated.regions)
      .forEach((region) => holders.set(region, (holders.get(region) ?? new Set()).add(at))),
  )
  const spec: PlanSpecStatement = { preparationId }
  if (draft.done.length > 0) {
    spec.skippedRegions = ascending(draft.done)
  }
  if (frames.length > 0) {
    spec.setups = frames.map(({ direction, all, own }, at) => {
      // Exclusive only where no other frame states the region too (multi-touch is exclusive to none).
      const exclusive = ascending(own.flatMap(({ stated }) => stated.regions)).filter((region) =>
        [...(holders.get(region) ?? [])].every((frameAt) => frameAt === at),
      )
      return {
        direction,
        ...(exclusive.length > 0 ? { exclusiveRegions: exclusive } : {}),
        ...(all.length > 0 ? { features: all.map(({ stated }) => stated) } : {}),
      }
    })
  }
  const additional = additionalDirectionsSent(draft)
  if (additional) {
    spec.additionalDirections = additional
  }
  // A region of a feature exclusive to its frame is in two lists, and the Engine counts both.
  const count =
    (spec.skippedRegions?.length ?? 0) +
    (spec.setups ?? []).reduce(
      (sum, setup) =>
        sum +
        (setup.exclusiveRegions?.length ?? 0) +
        (setup.features ?? []).reduce((each, feature) => each + feature.regions.length, 0),
      0,
    )
  return {
    spec,
    sources: frames.map(({ all }) => all.map(({ source }) => source)),
    unstated,
    tooManyRegions: count > MAX_SPEC_REGIONS,
  }
}

/**
 * Each frame's own features, in tree order, with the analysis each was made on: what a draft states
 * beyond its assigned tags.
 */
export const customByFrame = (
  setups: ReadonlyArray<DraftSetup>,
): Array<{ direction: PlanDirection; features: Array<CustomFeature> }> => {
  const placed = placedGroups(setups)
  return framesOf(setups)
    .map((frame) => ({
      direction: frame.direction,
      features: placed
        .filter((each) => each.frameId === frame.id)
        .flatMap((each) =>
          customOf(each.group).map((feature) => ({
            ...feature,
            regions: ascending(feature.regions),
          })),
        ),
    }))
    .filter((frame) => frame.features.length > 0)
}

/**
 * The places of a group's own features numbered by another analysis than `preparationId` (D-44):
 * sent under this one they'd name other faces, so Apply refuses until they're made again.
 */
export const staleCustomOf = (
  setups: ReadonlyArray<DraftSetup>,
  preparationId: string | null,
): Array<{ groupId: string; index: number }> =>
  preparationId === null
    ? []
    : placedGroups(setups).flatMap(({ group }) =>
        customOf(group).flatMap((feature, index) =>
          feature.preparationId !== preparationId ? [{ groupId: group.id, index }] : [],
        ),
      )

/**
 * Adopt's Confirm, one edit: features Toolpath read pinned into a group by tag, and features taken
 * out of it (by tag, or one of its own by place). A pinned feature's regions leave every other
 * feature of the group's frame; with `share` false (Take Over) every other frame's too, what's left
 * of a feature there staying as one of its own, and with `share` true (Keep Both) other frames keep
 * them, so they are cut from both. They are no longer ignored. Taken out, a feature leaves only this
 * group: another that holds it keeps it. Refused for a group gone, or a pin read from another way
 * than the group is cut from (`directionOf`), as any assignment is.
 */
export const adoptEdit = (
  draft: Constraints,
  groupId: string,
  pin: ReadonlyArray<string>,
  takeOut: ReadonlyArray<FeatureRef>,
  share: boolean,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  preparationId: string | null,
  directionOf: ((tag: string) => PlanDirection | undefined) | undefined,
  cut: Cut | undefined,
): Constraints | Refused => {
  const placed = findPlaced(draft.setups, groupId)
  if (!placed) {
    return { refused: GONE }
  }
  if (
    pin.some((tag) => {
      const direction = directionOf?.(tag)
      return direction !== undefined && !sameDirection(direction, placed.direction)
    })
  ) {
    return OTHER_WAY
  }
  const outTags = new Set(takeOut.flatMap((each) => ('tag' in each ? [tagKey(each.tag)] : [])))
  const outOwn = new Set(takeOut.flatMap((each) => ('custom' in each ? [each.custom] : [])))
  const pinned = [...new Map(pin.map((tag) => [tagKey(tag), tag])).values()].filter(
    (tag) => !outTags.has(tagKey(tag)),
  )
  const pinnedKeys = new Set(pinned.map(tagKey))
  const taken = new Set(pinned.flatMap((tag) => [...regionsOf(tag)]))
  const frame = frameGroupIds(draft.setups, groupId)
  const setups = everyGroup(draft.setups, (group) => {
    if (group.id !== groupId) {
      return share && !frame.has(group.id)
        ? group
        : withoutRegions(group, taken, regionsOf, preparationId, cut)
    }
    const kept = withCustom(
      {
        ...group,
        features: group.features.filter(
          (tag) => !outTags.has(tagKey(tag)) && !pinnedKeys.has(tagKey(tag)),
        ),
      },
      customOf(group).filter((_, i) => !outOwn.has(i)),
    )
    const cleared = withoutRegions(kept, taken, regionsOf, preparationId, cut)
    return { ...cleared, features: [...cleared.features, ...pinned] }
  })
  return {
    ...draft,
    setups,
    ...withDone(
      draft,
      draft.done.filter((region) => !taken.has(region)),
    ),
  }
}

/**
 * The tray's Ignore Confirm, one edit: regions ignored, each leaving every feature it is in (what's
 * left of a pinned feature staying as one of its group's own), and others no longer ignored.
 */
export const ignoreRegionsEdit = (
  draft: Constraints,
  ignore: ReadonlyArray<number>,
  unignore: ReadonlyArray<number>,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  kernel: string | null,
  preparationId: string | null,
  cut: Cut | undefined,
): Constraints => {
  const added = new Set(ignore)
  const dropped = new Set(unignore)
  const done = ascending([
    ...currentFor(draft.done, draft.doneKernel, kernel).filter((region) => !dropped.has(region)),
    ...added,
  ])
  return {
    ...draft,
    setups:
      added.size > 0
        ? everyGroup(draft.setups, (group) =>
            withoutRegions(group, added, regionsOf, preparationId, cut),
          )
        : draft.setups,
    done,
    doneKernel: done.length > 0 ? kernel : null,
  }
}

/**
 * A draft kept to the region rules after any edit, however it was made: the regions of a feature
 * newly assigned to a group leave the other features of its frame (one feature per region per
 * frame); regions ignored leave every group's own features; and with nothing ignored, no kernel is
 * named. What's left of a group's own feature is cut by `cut`.
 */
export const keptToRegionRules = (
  before: Constraints,
  after: Constraints,
  regionsOf: (tag: string) => ReadonlyArray<number>,
  cut: Cut | undefined,
): Constraints => {
  const had = new Map(
    placedGroups(before.setups).map(({ group }) => [group.id, new Set(group.features.map(tagKey))]),
  )
  const placed = placedGroups(after.setups)
  const frameOf = new Map(placed.map((each) => [each.group.id, each.frameId]))
  // Each frame's newly assigned regions.
  const gained = new Map<string, Set<number>>()
  for (const { group, frameId } of placed) {
    for (const tag of group.features) {
      if (had.get(group.id)?.has(tagKey(tag))) {
        continue
      }
      const regions = gained.get(frameId) ?? new Set<number>()
      regionsOf(tag).forEach((region) => regions.add(region))
      gained.set(frameId, regions)
    }
  }
  let draft = after
  if (gained.size > 0) {
    draft = {
      ...draft,
      setups: everyGroup(draft.setups, (group) => {
        const regions = gained.get(frameOf.get(group.id)!)
        return regions ? withCustom(group, shrunk(customOf(group), regions, cut, group.id)) : group
      }),
    }
  }
  const done = new Set(draft.done)
  const doneStated = placedGroups(draft.setups).some(({ group }) =>
    customOf(group).some((feature) => feature.regions.some((region) => done.has(region))),
  )
  if (doneStated) {
    draft = withoutDoneRegions(draft, cut)
  }
  return draft.done.length === 0 && draft.doneKernel !== null
    ? { ...draft, doneKernel: null }
    : draft
}

/**
 * Groups with the features a plan cut as stated by region, which are no features of the part's,
 * each made one of its group's own, its regions and type as the plan cut them; and every region so
 * stated. With no `preparationId` nothing can be stated by region, so they stay assigned by tag,
 * which a `setupPlan` carries.
 */
export const withTrimmedAsOwn = (
  setups: ReadonlyArray<DraftSetup>,
  trimmed: ReadonlyArray<Pick<TrimmedFeature, 'featureTag' | 'featureType' | 'regionIdxs'>>,
  preparationId: string | null,
): { setups: Array<DraftSetup>; regions: Set<number> } => {
  const byTag = new Map(trimmed.map((each) => [tagKey(each.featureTag), each]))
  const regions = new Set<number>()
  if (byTag.size === 0 || preparationId === null) {
    return { setups: [...setups], regions }
  }
  const next = everyGroup(setups, (group) => {
    const own = group.features.flatMap((tag): Array<CustomFeature> => {
      const cut = byTag.get(tagKey(tag))
      return cut && cut.regionIdxs.length > 0
        ? [{ ...ownFeature(cut.regionIdxs, preparationId), featureType: cut.featureType }]
        : []
    })
    if (own.length === 0) {
      return group
    }
    own.forEach((feature) => feature.regions.forEach((region) => regions.add(region)))
    return withCustom(
      { ...group, features: group.features.filter((tag) => !byTag.has(tagKey(tag))) },
      [...customOf(group), ...own],
    )
  })
  return { setups: next, regions }
}
