import { describe, expect, it } from 'vitest'
import {
  applyDraftAction,
  piecesOf,
  planSpecOf,
  sameDirection,
  type Constraints,
  type DraftSetup,
  type PlanDirection,
  type PlanRules,
} from '../../src'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
// A profile read from up holds its walls, which are read as features of their own; a chamfer is one
// band of faces round an edge.
const regions: Record<string, Array<number>> = {
  profile: [20, 21, 22, 23, 24],
  wallA: [20],
  wallB: [21, 22],
  wallC: [23, 24],
  chamfer: [30, 31, 32, 33],
  hole: [40],
}
const read: Array<{ tag: string; direction: PlanDirection; type: string }> = [
  { tag: 'profile', direction: up, type: 'profile' },
  { tag: 'wallA', direction: up, type: 'wall' },
  { tag: 'wallB', direction: up, type: 'wall' },
  { tag: 'wallC', direction: up, type: 'wall' },
  { tag: 'chamfer', direction: up, type: 'chamfer' },
  { tag: 'hole', direction: down, type: 'through_hole' },
]
// Faces in a run touch the next: the profile's walls go round, the chamfer's band too.
const edges: Array<[number, number]> = [
  [20, 21],
  [21, 22],
  [22, 23],
  [23, 24],
  [30, 31],
  [31, 32],
  [32, 33],
]
const touching = (region: number) =>
  edges.flatMap(([a, b]) => (a === region ? [b] : b === region ? [a] : []))
const readingsFrom = (direction: PlanDirection) =>
  read.filter((each) => sameDirection(each.direction, direction)).map((each) => regions[each.tag]!)
const plain: PlanRules = {
  regionsOf: (tag) => regions[tag] ?? [],
  kernel: 'k1',
  preparationId: 'p1',
}
const cutting: PlanRules = { ...plain, readingsFrom, touching }
const setups: Array<DraftSetup> = [
  { id: 'top', name: 'Top', direction: up, features: ['profile', 'chamfer'], groups: [] },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['hole'], groups: [] },
]
const draft: Constraints = { setups, done: [], doneKernel: null }
const made = (result: ReturnType<typeof applyDraftAction>) => {
  if ('refused' in result) throw new Error(result.refused.kind)
  return result.draft
}
const own = (d: Constraints, id: string) =>
  d.setups.find((s) => s.id === id)!.custom?.map((feature) => feature.regions)

describe('piecesOf', () => {
  it('takes the readings that lie wholly in what is left first, largest first, then each run that touches', () => {
    expect(piecesOf([20, 21, 22, 24], readingsFrom(up), touching)).toEqual([[20], [21, 22], [24]])
  })

  it('keeps what is left as one where it is exactly one reading', () => {
    expect(piecesOf([22, 21], readingsFrom(up), touching)).toEqual([[21, 22]])
  })

  it('takes no reading that shares a region with a larger one taken already', () => {
    expect(piecesOf([1, 2, 3], [[2], [1, 2], [2, 3]], undefined)).toEqual([[1, 2], [3]])
  })

  it('takes the reading with the lower first region where two are as large', () => {
    expect(
      piecesOf(
        [1, 2, 3],
        [
          [2, 3],
          [1, 2],
        ],
        undefined,
      ),
    ).toEqual([[1, 2], [3]])
  })

  it('cuts regions that do not touch apart, and keeps them as one with no way to tell', () => {
    expect(piecesOf([30, 32, 33], [], touching)).toEqual([[30], [32, 33]])
    expect(piecesOf([30, 32, 33], [], undefined)).toEqual([[30, 32, 33]])
  })

  it('cuts nothing out of nothing', () => {
    expect(piecesOf([], readingsFrom(up), touching)).toEqual([])
  })
})

describe('what is left of a feature that loses regions', () => {
  it('splits a profile another frame takes a wall face from into its walls and the run left', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'bottom', regions: [22], share: false },
        cutting,
      ),
    )
    expect(next.setups[0]!.features).toEqual(['chamfer'])
    expect(own(next, 'top')).toEqual([[20], [21], [23, 24]])
  })

  it('states each wall left whole with its type, and the run left with none', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'bottom', regions: [22], share: false },
        cutting,
      ),
    )
    const features = [
      { tag: 'profile', type: 'profile' },
      { tag: 'wallA', type: 'wall' },
      { tag: 'wallB', type: 'wall' },
      { tag: 'wallC', type: 'wall' },
    ].map(({ tag, type }) => ({
      featureTag: tag,
      regionIdxs: regions[tag]!,
      featureType: type,
      machiningDirection: up,
    }))
    const top = planSpecOf(next, 'p1', features).spec.setups![0]!.features!
    expect(top.slice(-3)).toEqual([
      { regions: [20], featureType: 'wall' },
      { regions: [21] },
      { regions: [23, 24], featureType: 'wall' },
    ])
  })

  it('cuts a chamfer whose band is broken into the runs left', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'bottom', regions: [31], share: false },
        cutting,
      ),
    )
    expect(own(next, 'top')).toEqual([[30], [32, 33]])
  })

  it('keeps what is left as one feature where it is exactly one reading', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'bottom', regions: [20, 23, 24], share: false },
        cutting,
      ),
    )
    expect(own(next, 'top')).toEqual([[21, 22]])
  })

  it('keeps what is left as one feature with neither readings nor touching faces given', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'bottom', regions: [31], share: false },
        plain,
      ),
    )
    expect(own(next, 'top')).toEqual([[30, 32, 33]])
  })

  it('cuts along the readings alone where touching faces are not given', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'bottom', regions: [21], share: false },
        { ...plain, readingsFrom },
      ),
    )
    expect(own(next, 'top')).toEqual([[20], [22], [23, 24]])
  })

  it('keeps a feature a person makes of regions as made, even where they do not touch', () => {
    const next = made(
      applyDraftAction(
        draft,
        { kind: 'assignRegions', groupId: 'top', regions: [30, 33], share: false },
        cutting,
      ),
    )
    expect(own(next, 'top')).toEqual([
      [31, 32],
      [30, 33],
    ])
  })

  it('keeps an edited feature as saved, cutting only what is left of another it took regions from', () => {
    const next = made(
      applyDraftAction(
        draft,
        {
          kind: 'editFeature',
          groupId: 'top',
          feature: { tag: 'chamfer' },
          regions: [30, 33, 22],
        },
        cutting,
      ),
    )
    expect(own(next, 'top')).toEqual([[20], [21], [23, 24], [22, 30, 33]])
  })

  it('cuts what is left of one of a folder’s own features in its place, each piece keeping its stamp', () => {
    const drawn = made(
      applyDraftAction(
        { ...draft, setups: [{ ...setups[0]!, features: [] }, setups[1]!] },
        { kind: 'assignRegions', groupId: 'top', regions: [30, 31, 32, 33], share: false },
        cutting,
      ),
    )
    const next = made(
      applyDraftAction(drawn, { kind: 'ignoreRegions', ignore: [31], unignore: [] }, cutting),
    )
    expect(next.setups[0]!.custom).toEqual([
      { regions: [30], preparationId: 'p1' },
      { regions: [32, 33], preparationId: 'p1' },
    ])
  })

  it('cuts what is left when regions are ignored, as when they are taken', () => {
    const next = made(
      applyDraftAction(draft, { kind: 'ignoreRegions', ignore: [22], unignore: [] }, cutting),
    )
    expect(own(next, 'top')).toEqual([[20], [21], [23, 24]])
    expect(next.done).toEqual([22])
  })

  it('cuts what is left when regions are left to Toolpath', () => {
    const next = made(applyDraftAction(draft, { kind: 'openRegions', regions: [31] }, cutting))
    expect(own(next, 'top')).toEqual([[30], [32, 33]])
  })

  it('cuts what is left when a folder adopts a feature over another frame’s', () => {
    const across: Constraints = {
      ...draft,
      setups: [
        { ...setups[0]!, features: ['profile'] },
        { ...setups[1]!, features: [] },
      ],
    }
    const next = made(
      applyDraftAction(
        across,
        { kind: 'adopt', groupId: 'bottom', pin: ['hole'], takeOut: [], share: false },
        { ...cutting, regionsOf: (tag) => (tag === 'hole' ? [21] : (regions[tag] ?? [])) },
      ),
    )
    expect(own(next, 'top')).toEqual([[20], [22], [23, 24]])
  })

  it('drops a cut feature’s type with its regions, each piece stated by what it is', () => {
    const cut: Constraints = {
      ...draft,
      setups: [
        {
          ...setups[0]!,
          features: [],
          custom: [{ regions: [30, 31, 32, 33], preparationId: 'p1', featureType: 'chamfer' }],
        },
        setups[1]!,
      ],
    }
    const next = made(applyDraftAction(cut, { kind: 'openRegions', regions: [31] }, cutting))
    expect(next.setups[0]!.custom).toEqual([
      { regions: [30], preparationId: 'p1' },
      { regions: [32, 33], preparationId: 'p1' },
    ])
  })
})
