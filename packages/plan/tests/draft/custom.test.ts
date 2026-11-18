import { describe, expect, it } from 'vitest'
import {
  applyDraftAction,
  customByFrame,
  customFeaturesOf,
  parseDraftSetups,
  planSpecOf,
  refusalClauses,
  staleCustomOf,
  type Constraints,
  type DraftAction,
  type DraftSetup,
  type PlanRules,
} from '../../src'

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }
const regions: Record<string, Array<number>> = {
  pocket: [6, 7],
  face: [0, 1],
  slot: [12, 13],
  wall: [12],
}
const rules: PlanRules = {
  regionsOf: (tag) => regions[tag] ?? [],
  kernel: 'k1',
  preparationId: 'p1',
}
const setups: Array<DraftSetup> = [
  { id: 'top', name: 'Top', direction: up, features: ['face', 'pocket', 'wall'], groups: [] },
  { id: 'side', name: 'Side', direction: side, features: ['slot'], groups: [] },
]
const draft: Constraints = { setups, done: [], doneKernel: null }
const made = (result: ReturnType<typeof applyDraftAction>) => {
  if ('refused' in result) throw new Error(result.refused.kind)
  return result.draft
}
const group = (d: Constraints, id: string) => d.setups.find((s) => s.id === id)!

describe('region plans', () => {
  it('assigns regions as a feature of the group’s own, leaving what’s left of a feature they cut as its own too', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [7, 10], share: false },
        rules,
      ),
    )
    expect(group(next, 'top').features).toEqual(['face', 'wall'])
    expect(group(next, 'top').custom).toEqual([
      { regions: [6], preparationId: 'p1' },
      { regions: [7, 10], preparationId: 'p1' },
    ])
  })

  it('takes regions over from another frame, or keeps them there too', () => {
    const over = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [13], share: false },
        rules,
      ),
    )
    expect(group(over, 'side').features).toEqual([])
    expect(group(over, 'side').custom).toEqual([{ regions: [12], preparationId: 'p1' }])
    const both = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [13], share: true },
        rules,
      ),
    )
    expect(group(both, 'side').features).toEqual(['slot'])
  })

  it('edits an assigned feature into one of the group’s own, and lets it go with no regions', () => {
    const edited = made(
      applyDraftAction(
        draft,
        { kind: 'editFeature', groupId: 'top', feature: { tag: 'pocket' }, regions: [6] },
        rules,
      ),
    )
    expect(group(edited, 'top').features).toEqual(['face', 'wall'])
    expect(group(edited, 'top').custom).toEqual([{ regions: [6], preparationId: 'p1' }])
    const gone = made(
      applyDraftAction(
        edited,
        { kind: 'editFeature', groupId: 'top', feature: { custom: 0 }, regions: [] },
        rules,
      ),
    )
    expect(group(gone, 'top').custom).toBeUndefined()
  })

  it('refuses to adopt a feature Toolpath plans no pass for, as any pin of one', () => {
    const unpinned: Constraints = {
      ...draft,
      setups: [{ ...setups[0]!, features: ['face'] }, setups[1]!],
    }
    const result = applyDraftAction(
      unpinned,
      { kind: 'adopt', groupId: 'top', pin: ['pocket'], takeOut: [], share: false },
      { ...rules, unplannable: (tag) => tag === 'pocket' },
    )
    expect(result).toEqual({ refused: { kind: 'noTool' } })
  })

  it('moves an edited feature into another group of its frame with `into` (D-18), regions taken out left open', () => {
    const nested: Constraints = {
      ...draft,
      setups: [
        {
          ...setups[0]!,
          features: [],
          groups: [
            { id: 'a', name: 'A', features: ['pocket'], groups: [] },
            { id: 'b', name: 'B', features: ['face'], groups: [] },
          ],
        } as DraftSetup,
        setups[1]!,
      ],
    }
    const moved = made(
      applyDraftAction(
        nested,
        {
          kind: 'editFeature',
          groupId: 'a',
          feature: { tag: 'pocket' },
          regions: [6, 1],
          into: 'b',
        },
        rules,
      ),
    )
    const [a, b] = moved.setups[0]!.groups
    expect(a!.features).toEqual([])
    expect(a!.custom).toBeUndefined()
    // Region 1 left the face, which stays in B as what's left of it; the edit joins it there.
    expect(b!.features).toEqual([])
    expect(b!.custom).toEqual([
      { regions: [0], preparationId: 'p1' },
      { regions: [1, 6], preparationId: 'p1' },
    ])
    // Another frame isn't a place to move to, and a group gone isn't either.
    const into = (to: string) =>
      applyDraftAction(
        nested,
        { kind: 'editFeature', groupId: 'a', feature: { tag: 'pocket' }, regions: [6], into: to },
        rules,
      )
    expect(into('side')).toEqual({ refused: { kind: 'otherWay' } })
    expect(into('gone')).toEqual({ refused: { kind: 'groupGone' } })
  })

  it('never trims an assigned feature with no preparationId: it goes only where every region is taken', () => {
    const noprep = { ...rules, preparationId: null }
    const pinned = made(
      applyDraftAction(
        draft,
        { kind: 'adopt', groupId: 'side', pin: ['wall'], takeOut: [], share: false },
        noprep,
      ),
    )
    // The wall moved whole to Side; the slot it half covers stays whole beside it.
    expect(group(pinned, 'top').features).toEqual(['face', 'pocket'])
    expect(group(pinned, 'side').features).toEqual(['slot', 'wall'])
    const ignored = made(
      applyDraftAction(pinned, { kind: 'ignoreRegions', ignore: [6], unignore: [] }, noprep),
    )
    expect(group(ignored, 'top').features).toEqual(['face', 'pocket'])
    const opened = made(applyDraftAction(pinned, { kind: 'openRegions', regions: [12] }, noprep))
    expect(group(opened, 'side').features).toEqual(['slot'])
    for (const each of [pinned, ignored, opened]) {
      expect(customFeaturesOf(each.setups)).toEqual([])
    }
    // Nor makes a feature of regions there, which no analysis numbers.
    const notByRegion = { refused: { kind: 'notByRegion' } }
    expect(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [7], share: false },
        noprep,
      ),
    ).toEqual(notByRegion)
    expect(
      applyDraftAction(
        draft,
        { kind: 'editFeature', groupId: 'top', feature: { tag: 'pocket' }, regions: [6] },
        noprep,
      ),
    ).toEqual(notByRegion)
  })

  it('frees regions from every feature and from done, and done takes them out of the group’s own', () => {
    const own = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [10, 11], share: false },
        rules,
      ),
    )
    const done = made(applyDraftAction(own, { kind: 'markDone', regions: [10] }, rules))
    expect(group(done, 'side').custom).toEqual([{ regions: [11], preparationId: 'p1' }])
    const freed = made(applyDraftAction(done, { kind: 'openRegions', regions: [10, 11, 0] }, rules))
    expect(freed.done).toEqual([])
    expect(group(freed, 'side').custom).toBeUndefined()
    expect(group(freed, 'top').features).toEqual(['pocket', 'wall'])
    expect(group(freed, 'top').custom).toEqual([{ regions: [1], preparationId: 'p1' }])
  })

  it('lists the group’s own features under keys of their own', () => {
    const own = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [10, 11], share: false },
        rules,
      ),
    )
    expect(customFeaturesOf(own.setups)).toEqual([
      { key: 'custom:side:0', groupId: 'side', index: 0, regions: [10, 11] },
    ])
  })

  it('states one setup per frame: assigned features typed, its own exclusive unless shared, done skipped', () => {
    const features = [
      { featureTag: 'face', regionIdxs: [0, 1], featureType: 'face', machiningDirection: up },
      { featureTag: 'pocket', regionIdxs: [6, 7], featureType: 'pocket', machiningDirection: up },
      { featureTag: 'wall', regionIdxs: [12], featureType: 'wall', machiningDirection: up },
      {
        featureTag: 'slot',
        regionIdxs: [12, 13],
        featureType: 'open_pocket',
        machiningDirection: side,
      },
      {
        featureTag: 'hole',
        regionIdxs: [10, 11],
        featureType: 'blind_hole',
        machiningDirection: up,
      },
    ]
    const own = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [10, 11], share: false },
        rules,
      ),
    )
    const done = made(applyDraftAction(own, { kind: 'markDone', regions: [2] }, rules))
    expect(planSpecOf(done, 'prep', features).spec).toEqual({
      preparationId: 'prep',
      skippedRegions: [2],
      setups: [
        {
          direction: up,
          exclusiveRegions: [10, 11],
          features: [
            { regions: [0, 1], featureType: 'face' },
            { regions: [6, 7], featureType: 'pocket' },
            { regions: [12], featureType: 'wall' },
            { regions: [10, 11], featureType: 'blind_hole' },
          ],
        },
        { direction: side, features: [{ regions: [12, 13], featureType: 'open_pocket' }] },
      ],
    })
  })

  it('adopts features into a folder in one step, taking over or keeping them both', () => {
    const over = made(
      applyDraftAction(
        draft,
        {
          kind: 'adopt',
          groupId: 'side',
          pin: ['pocket'],
          takeOut: [{ tag: 'slot' }],
          share: false,
        },
        rules,
      ),
    )
    expect(group(over, 'side').features).toEqual(['pocket'])
    expect(group(over, 'top').features).toEqual(['face', 'wall'])
    const both = made(
      applyDraftAction(
        draft,
        { kind: 'adopt', groupId: 'side', pin: ['pocket'], takeOut: [], share: true },
        rules,
      ),
    )
    expect(group(both, 'side').features).toEqual(['slot', 'pocket'])
    expect(group(both, 'top').features).toEqual(['face', 'pocket', 'wall'])
  })

  it('adopts out of the frame’s other features, and un-ignores what it pins', () => {
    const ignored = { ...draft, done: [6, 9], doneKernel: 'k1' }
    const next = made(
      applyDraftAction(
        ignored,
        { kind: 'adopt', groupId: 'side', pin: ['wall'], takeOut: [], share: true },
        rules,
      ),
    )
    // The wall is the slot's region 12: the slot keeps what's left, as a feature of Side's own.
    expect(group(next, 'side').features).toEqual(['wall'])
    expect(group(next, 'side').custom).toEqual([{ regions: [13], preparationId: 'p1' }])
    expect(next.done).toEqual([6, 9])
    const pinned = made(
      applyDraftAction(
        ignored,
        { kind: 'adopt', groupId: 'side', pin: ['pocket'], takeOut: [], share: false },
        rules,
      ),
    )
    expect(pinned.done).toEqual([9])
  })

  it('ignores and un-ignores regions in one step, an ignored region leaving every feature', () => {
    const ignored = { ...draft, done: [20], doneKernel: 'k1' }
    const next = made(
      applyDraftAction(ignored, { kind: 'ignoreRegions', ignore: [7], unignore: [20] }, rules),
    )
    expect(next.done).toEqual([7])
    expect(group(next, 'top').features).toEqual(['face', 'wall'])
    expect(group(next, 'top').custom).toEqual([{ regions: [6], preparationId: 'p1' }])
    const none = made(
      applyDraftAction(next, { kind: 'ignoreRegions', ignore: [], unignore: [7] }, rules),
    )
    expect(none).toMatchObject({ done: [], doneKernel: null })
  })

  it('stamps a folder’s own features with the analysis that numbered them, and finds stale ones', () => {
    const made1 = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [20], share: false },
        rules,
      ),
    )
    expect(group(made1, 'side').custom).toEqual([{ regions: [20], preparationId: 'p1' }])
    expect(staleCustomOf(made1.setups, 'p1')).toEqual([])
    expect(staleCustomOf(made1.setups, 'p2')).toEqual([{ groupId: 'side', index: 0 }])
    expect(staleCustomOf(made1.setups, null)).toEqual([])
  })

  it('refuses to edit a feature made on another analysis, which can only be let go', () => {
    const made1 = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [20], share: false },
        rules,
      ),
    )
    const reanalyzed = { ...rules, preparationId: 'p2' }
    const edit = (regions: Array<number>, into?: string) =>
      applyDraftAction(
        made1,
        { kind: 'editFeature', groupId: 'side', feature: { custom: 0 }, regions, into },
        reanalyzed,
      )
    expect(edit([20, 21])).toEqual({ refused: { kind: 'staleFeature' } })
    // Unchanged, it still can't be moved under the new analysis's stamp.
    expect(edit([20], 'side')).toEqual({ refused: { kind: 'staleFeature' } })
    const gone = made(
      applyDraftAction(made1, { kind: 'unassignCustom', groupId: 'side', index: 0 }, reanalyzed),
    )
    expect(group(gone, 'side').custom).toBeUndefined()
  })

  it('refuses to let go of one of a group’s own features that isn’t there', () => {
    const made1 = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [20], share: false },
        rules,
      ),
    )
    const unassign = (groupId: string, index: number) =>
      applyDraftAction(made1, { kind: 'unassignCustom', groupId, index }, rules)
    expect(unassign('gone', 0)).toEqual({ refused: { kind: 'groupGone' } })
    expect(unassign('side', 1)).toEqual({ refused: { kind: 'notAnAction' } })
    expect(unassign('side', 0.5)).toEqual({ refused: { kind: 'notAnAction' } })
  })

  it('refuses to adopt a feature read from another way than the group, or into a group gone', () => {
    const directions: Record<string, typeof up> = { pocket: up, slot: side }
    const way = { ...rules, directionOf: (tag: string) => directions[tag] }
    const adopt = (groupId: string, pin: Array<string>) =>
      applyDraftAction(draft, { kind: 'adopt', groupId, pin, takeOut: [], share: false }, way)
    expect(adopt('side', ['pocket'])).toEqual({ refused: { kind: 'otherWay' } })
    expect(adopt('gone', ['pocket'])).toEqual({ refused: { kind: 'groupGone' } })
    expect(adopt('top', ['pocket', 'slot'])).toEqual({ refused: { kind: 'otherWay' } })
    // Its own way, or a feature whose way the rules don't say, is adopted.
    expect(group(made(adopt('side', ['slot', 'wall'])), 'side').features).toEqual(['slot', 'wall'])
  })

  it('refuses a region action whose feature is not a feature, instead of throwing', () => {
    const not = { refused: { kind: 'notAnAction' } }
    for (const feature of [null, 'pocket', 7, {}, { tag: 7 }, { custom: 'x' }]) {
      expect(
        applyDraftAction(
          draft,
          { kind: 'editFeature', groupId: 'top', feature, regions: [6] } as unknown as DraftAction,
          rules,
        ),
      ).toEqual(not)
      expect(
        applyDraftAction(
          draft,
          {
            kind: 'adopt',
            groupId: 'top',
            pin: [],
            takeOut: [feature],
            share: false,
          } as unknown as DraftAction,
          rules,
        ),
      ).toEqual(not)
    }
    expect(
      applyDraftAction(
        draft,
        {
          kind: 'adopt',
          groupId: 'top',
          pin: [7],
          takeOut: [],
          share: false,
        } as unknown as DraftAction,
        rules,
      ),
    ).toEqual(not)
  })

  it('frees regions out of one folder’s features only, what’s left of a pin staying its own', () => {
    const both = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [6], share: true },
        rules,
      ),
    )
    const freed = made(
      applyDraftAction(both, { kind: 'openRegions', regions: [6], groupId: 'top' }, rules),
    )
    expect(group(freed, 'top').features).toEqual(['face', 'wall'])
    expect(group(freed, 'top').custom).toEqual([{ regions: [7], preparationId: 'p1' }])
    expect(group(freed, 'side').custom).toEqual([{ regions: [6], preparationId: 'p1' }])
  })

  it('keeps a folder’s own regions exclusive to its frame only while no other frame states them', () => {
    const features = [
      {
        featureTag: 'slot',
        regionIdxs: [12, 13],
        featureType: 'open_pocket',
        machiningDirection: side,
      },
    ]
    const own = {
      ...draft,
      setups: draft.setups.map((s) =>
        s.id === 'side' ? { ...s, custom: [{ regions: [20], preparationId: 'p' }] } : s,
      ),
    }
    expect(planSpecOf(own, 'p', features).spec.setups?.[1]?.exclusiveRegions).toEqual([20])
    const both = {
      ...own,
      setups: own.setups.map((s) =>
        s.id === 'top' ? { ...s, custom: [{ regions: [20], preparationId: 'p' }] } : s,
      ),
    }
    expect(
      planSpecOf(both, 'p', features).spec.setups?.every((s) => !s.exclusiveRegions?.includes(20)),
    ).toBe(true)
  })

  it('takes a newly pinned feature’s regions out of the frame’s own features', () => {
    const own = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'side', regions: [6, 20], share: false },
        rules,
      ),
    )
    const pinned = made(
      applyDraftAction(
        own,
        { kind: 'assignInto', tag: 'pocket', direction: side, groupId: 'side' },
        rules,
      ),
    )
    expect(group(pinned, 'side').custom).toEqual([{ regions: [20], preparationId: 'p1' }])
  })

  it('edits a feature in its place, taking over only the regions it gains from other frames', () => {
    const shared = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [12, 30], share: true },
        rules,
      ),
    )
    const two = made(
      applyDraftAction(
        shared,
        { kind: 'assignRegions', groupId: 'top', regions: [40], share: false },
        rules,
      ),
    )
    const edited = made(
      applyDraftAction(
        two,
        { kind: 'editFeature', groupId: 'top', feature: { custom: 0 }, regions: [12, 13, 30] },
        rules,
      ),
    )
    // Side keeps 12 (shared before), loses 13 (gained): the slot's remainder is its own.
    expect(group(edited, 'side').custom).toEqual([{ regions: [12], preparationId: 'p1' }])
    expect(group(edited, 'top').custom).toEqual([
      { regions: [12, 13, 30], preparationId: 'p1' },
      { regions: [40], preparationId: 'p1' },
    ])
    // A feature no longer there is refused, not quietly passed over.
    expect(
      applyDraftAction(
        edited,
        { kind: 'editFeature', groupId: 'top', feature: { custom: 9 }, regions: [1] },
        rules,
      ),
    ).toEqual({ refused: { kind: 'notAnAction' } })
  })

  it('states regions in a folder that holds folders too, as a pin there, and nothing in one that is gone', () => {
    const parent: Constraints = {
      ...draft,
      setups: [
        {
          ...setups[0]!,
          features: ['face'],
          groups: [{ id: 'kid', name: 'Kid', features: ['pocket'], groups: [] }],
        },
      ],
    }
    const own = made(
      applyDraftAction(
        parent,
        { kind: 'assignRegions', groupId: 'top', regions: [20], share: false },
        rules,
      ),
    )
    expect(group(own, 'top').custom).toEqual([{ regions: [20], preparationId: 'p1' }])
    const edited = made(
      applyDraftAction(
        own,
        { kind: 'editFeature', groupId: 'top', feature: { custom: 0 }, regions: [20, 21] },
        rules,
      ),
    )
    expect(group(edited, 'top').custom).toEqual([{ regions: [20, 21], preparationId: 'p1' }])
    const stored = {
      id: 'top',
      name: 'Top',
      direction: up,
      features: ['fa'],
      custom: [{ regions: [21, 20], preparationId: 'a1' }],
      groups: [{ id: 'kid', name: 'Kid', features: ['b0'], groups: [] }],
    }
    expect(parseDraftSetups([stored])).toEqual([
      { ...stored, custom: [{ regions: [20, 21], preparationId: 'a1' }] },
    ])
    expect(customByFrame(edited.setups)).toEqual([
      { direction: up, features: [{ regions: [20, 21], preparationId: 'p1' }] },
    ])
    const features = [
      { featureTag: 'face', regionIdxs: [0, 1], featureType: 'face', machiningDirection: up },
      { featureTag: 'pocket', regionIdxs: [6, 7], featureType: 'pocket', machiningDirection: up },
    ]
    const { spec, sources } = planSpecOf(edited, 'p1', features)
    expect(spec.setups?.[0]?.features).toEqual([
      { regions: [0, 1], featureType: 'face' },
      { regions: [6, 7], featureType: 'pocket' },
      { regions: [20, 21] },
    ])
    expect(sources[0]).toEqual([
      { groupId: 'top', feature: { tag: 'face' } },
      { groupId: 'kid', feature: { tag: 'pocket' } },
      { groupId: 'top', feature: { custom: 0 } },
    ])
    expect(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'nope', regions: [6], share: false },
        rules,
      ),
    ).toEqual({ refused: { kind: 'groupGone' } })
  })

  it('says where each feature it states came from, in the order sent, and what it could not state', () => {
    const stated: Pick<Constraints, 'setups' | 'done'> = {
      setups: [
        {
          id: 'top',
          name: 'Top',
          direction: up,
          features: ['face', 'gone'],
          custom: [{ regions: [20], preparationId: 'p1' }],
          groups: [
            {
              id: 'kid',
              name: 'Kid',
              features: ['pocket'],
              custom: [{ regions: [30, 31], preparationId: 'p1' }],
              groups: [],
            },
          ],
        },
        {
          id: 'side',
          name: 'Side',
          direction: side,
          features: ['slot'],
          custom: [{ regions: [20, 21], preparationId: 'p1' }],
          groups: [],
        },
      ],
      // The face, every region ignored, is left out: it is not lost.
      done: [0, 1],
    }
    const features = [
      { featureTag: 'face', regionIdxs: [0, 1], featureType: 'face', machiningDirection: up },
      { featureTag: 'pocket', regionIdxs: [6, 7], featureType: 'pocket', machiningDirection: up },
      {
        featureTag: 'slot',
        regionIdxs: [12, 13],
        featureType: 'open_pocket',
        machiningDirection: side,
      },
    ]
    const { spec, sources, unstated } = planSpecOf(stated, 'p1', features)
    expect(spec).toEqual({
      preparationId: 'p1',
      skippedRegions: [0, 1],
      setups: [
        {
          direction: up,
          // Region 20 is in a feature of both frames: exclusive to neither.
          exclusiveRegions: [30, 31],
          features: [
            { regions: [6, 7], featureType: 'pocket' },
            { regions: [20] },
            { regions: [30, 31] },
          ],
        },
        {
          direction: side,
          exclusiveRegions: [21],
          features: [{ regions: [12, 13], featureType: 'open_pocket' }, { regions: [20, 21] }],
        },
      ],
    })
    expect(sources).toEqual([
      [
        { groupId: 'kid', feature: { tag: 'pocket' } },
        { groupId: 'top', feature: { custom: 0 } },
        { groupId: 'kid', feature: { custom: 0 } },
      ],
      [
        { groupId: 'side', feature: { tag: 'slot' } },
        { groupId: 'side', feature: { custom: 0 } },
      ],
    ])
    expect(unstated).toEqual([{ groupId: 'top', tag: 'gone' }])
    // A refusal's place in the spec as sent finds the feature it names.
    const [clause] = refusalClauses(
      'refused_plan_spec: 1 statement of the plan spec refused: setup 1: feature 1 reads as no feature',
    )!
    expect(clause).toMatchObject({ setup: 1, feature: 1 })
    if (clause?.kind === 'clause') {
      expect(sources[clause.setup!]?.[clause.feature!]).toEqual({
        groupId: 'side',
        feature: { custom: 0 },
      })
    }
  })

  it('names no kernel once nothing is done, and skips no region it still states', () => {
    const done = made(applyDraftAction(draft, { kind: 'markDone', regions: [40] }, rules))
    expect(
      made(applyDraftAction(done, { kind: 'openRegions', regions: [40] }, rules)).doneKernel,
    ).toBeNull()
    const features = [
      { featureTag: 'pocket', regionIdxs: [6, 7], featureType: 'pocket', machiningDirection: up },
    ]
    const partly = { ...draft, done: [7], doneKernel: 'k1' }
    expect(planSpecOf(partly, 'p', features).spec.setups?.[0]?.features).toEqual([{ regions: [6] }])
  })

  it('states a cut feature’s type with its regions until they change, and keeps it stored', () => {
    const cut = { regions: [30, 31], preparationId: 'a1', featureType: 'profile' }
    const typed: Constraints = {
      ...draft,
      setups: [{ ...setups[0]!, features: [], custom: [cut] }],
    }
    const statedOf = (d: Constraints) => planSpecOf(d, 'p1', []).spec.setups?.[0]?.features
    expect(statedOf(typed)).toEqual([{ regions: [30, 31], featureType: 'profile' }])
    expect(parseDraftSetups(typed.setups)).toEqual(typed.setups)
    const onA1 = { ...rules, preparationId: 'a1' }
    const shrunk = made(applyDraftAction(typed, { kind: 'openRegions', regions: [31] }, onA1))
    expect(group(shrunk, 'top').custom).toEqual([{ regions: [30], preparationId: 'a1' }])
    const edited = made(
      applyDraftAction(
        typed,
        { kind: 'editFeature', groupId: 'top', feature: { custom: 0 }, regions: [30, 31, 32] },
        onA1,
      ),
    )
    expect(statedOf(edited)).toEqual([{ regions: [30, 31, 32] }])
  })

  it('says a spec holds more regions than the Engine takes, counting a region in two lists twice', () => {
    const stating = (count: number) =>
      planSpecOf(
        {
          setups: [
            {
              ...setups[0]!,
              features: [],
              custom: [{ regions: Array.from({ length: count }, (_, i) => i), preparationId: 'p' }],
            },
          ],
          done: [],
        },
        'p',
        [],
      )
    // Each region is in the feature and exclusive to its frame: 2 × 10,000 is the most.
    expect(stating(10_000).tooManyRegions).toBe(false)
    expect(stating(10_001).tooManyRegions).toBe(true)
  })

  it('refuses a stored group’s own features that are not lists of the part’s regions', () => {
    const stored = (custom: unknown) => [{ ...setups[0]!, features: [], custom }]
    const refused = { invalid: { kind: 'notCustomFeatures' } }
    const prep = { preparationId: 'a1' }
    expect(parseDraftSetups(stored([{ regions: [], ...prep }]))).toEqual(refused)
    expect(parseDraftSetups(stored([{ regions: [2 ** 32], ...prep }]))).toEqual(refused)
    expect(parseDraftSetups(stored([{ regions: [1], featureType: 7, ...prep }]))).toEqual(refused)
    expect(parseDraftSetups(stored([{ regions: [1], preparationId: 'not-one' }]))).toEqual(refused)
    // No analysis numbers its regions: it could only be sent naming whatever faces they are now.
    expect(parseDraftSetups(stored([{ regions: [1] }]))).toEqual(refused)
    expect(
      parseDraftSetups(stored([{ regions: Array.from({ length: 20_001 }, (_, i) => i), ...prep }])),
    ).toEqual(refused)
    expect(
      parseDraftSetups(stored(Array.from({ length: 5001 }, () => ({ regions: [1], ...prep })))),
    ).toEqual(refused)
    expect(parseDraftSetups(stored([{ regions: [2 ** 32 - 1], ...prep }]))).toMatchObject([
      { custom: [{ regions: [2 ** 32 - 1], preparationId: 'a1' }] },
    ])
  })
})

describe('additional directions', () => {
  const none = made(
    applyDraftAction(draft, { kind: 'setAdditionalDirections', directions: [] }, rules),
  )

  it('states that Toolpath adds no setup, and takes it back', () => {
    expect(none.additionalDirections).toEqual([])
    expect(planSpecOf(none, 'p1', []).spec.additionalDirections).toEqual([])
    const any = made(
      applyDraftAction(none, { kind: 'setAdditionalDirections', directions: null }, rules),
    )
    expect(any.additionalDirections).toBeNull()
    expect(planSpecOf(any, 'p1', []).spec).not.toHaveProperty('additionalDirections')
  })

  it('sends none only with a setup stated: no setups and none added would plan nothing', () => {
    expect(planSpecOf({ ...none, setups: [] }, 'p1', []).spec).toEqual({ preparationId: 'p1' })
  })

  it('keeps each direction as its x, y and z alone', () => {
    const extra = { ...side, label: 'side' } as typeof side
    const set = made(
      applyDraftAction(draft, { kind: 'setAdditionalDirections', directions: [extra] }, rules),
    )
    expect(set.additionalDirections).toEqual([side])
    expect(planSpecOf(set, 'p1', []).spec.additionalDirections).toEqual([side])
  })

  it('lets Toolpath add any once the last setup goes, so a setup added later starts that way', () => {
    const gone = made(applyDraftAction(none, { kind: 'remove', groups: ['top', 'side'] }, rules))
    expect(gone.setups).toEqual([])
    expect(gone.additionalDirections).toBeNull()
  })

  it('refuses what is not a list of directions', () => {
    const junk = {
      kind: 'setAdditionalDirections',
      directions: [{ x: 'up' }],
    } as unknown as DraftAction
    expect(applyDraftAction(draft, junk, rules)).toEqual({ refused: { kind: 'notAnAction' } })
  })
})
