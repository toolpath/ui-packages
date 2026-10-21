import { describe, expect, it } from 'vitest'
import { pinnedIn, type Constraints, type DraftSetup, type PlanRules } from '../src/plan-draft'
import {
  featuresAt,
  ignoreClick,
  ignoreEdit,
  ignoreSelection,
  regionLabel,
  takeBackIgnore,
  unignoreEdit,
} from '../src/ignore'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

// 'pocket' (1–4) is pinned in Top; 'hole' (5) in Bottom. 'wall' (4) shares a region with the
// pocket; 'slot' is nobody's.
const regions: Record<string, Array<number>> = {
  pocket: [1, 2, 3, 4],
  wall: [4],
  hole: [5],
  slot: [6, 7],
}
const regionsOf = (tag: string) => regions[tag] ?? []
const context: PlanRules = { regionsOf, kernel: 'k1' }
const setups: Array<DraftSetup> = [
  { id: 'top', name: 'Top', direction: up, features: ['pocket'], folders: [] },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['hole'], folders: [] },
]
const plan: Constraints = {
  setups,
  done: [],
  doneKernel: null,
}

describe('ignoreEdit', () => {
  it('ignores regions, leaving a pin with a region left as it is', () => {
    const { intent: next, unpinned } = ignoreEdit(plan, [4], context)
    expect(next.done).toEqual([4])
    expect(next.doneKernel).toBe('k1')
    expect(unpinned).toEqual([])
    expect(pinnedIn(next.setups, 'pocket')).toBe('top')
    expect(pinnedIn(next.setups, 'hole')).toBe('bottom')
  })

  it('unpins a feature whose every region it ignores, plainly: nothing kept out', () => {
    // Regions 1–3 ignored before; region 4 completes the pocket.
    const before = { ...plan, done: [1, 2, 3], doneKernel: 'k1' }
    const { intent: next, unpinned } = ignoreEdit(before, [4], context)
    expect(unpinned).toEqual([{ tag: 'pocket', setupId: 'top' }])
    expect(next.done).toEqual([1, 2, 3, 4])
    expect(next.setups).toEqual([{ ...setups[0], features: [] }, setups[1]])
    expect(pinnedIn(next.setups, 'hole')).toBe('bottom')
  })

  it('unpins it from every folder it is pinned in', () => {
    const twice = { ...plan, setups: [setups[0]!, { ...setups[1]!, features: ['hole', 'pocket'] }] }
    const { intent: next, unpinned } = ignoreEdit(twice, [1, 2, 3, 4], context)
    expect(unpinned).toEqual([
      { tag: 'pocket', setupId: 'top' },
      { tag: 'pocket', setupId: 'bottom' },
    ])
    expect(next.setups.map((each) => each.features)).toEqual([[], ['hole']])
  })

  it('leaves a pin already ignored whole alone, when the click is on other regions', () => {
    // The pocket was pinned over regions ignored before: a statement, not undone by ignoring the hole.
    const before = { ...plan, done: [1, 2, 3, 4], doneKernel: 'k1' }
    expect(ignoreEdit(before, [5], context).unpinned).toEqual([{ tag: 'hole', setupId: 'bottom' }])
  })

  it('adds to what is ignored, once each, and lets go of regions another analysis numbered', () => {
    expect(
      ignoreEdit({ ...plan, done: [6], doneKernel: 'k1' }, [6, 7], context).intent.done,
    ).toEqual([6, 7])
    expect(ignoreEdit({ ...plan, done: [6], doneKernel: 'k0' }, [7], context).intent.done).toEqual([
      7,
    ])
  })
})

describe('unignoreEdit', () => {
  it('stops ignoring regions, letting go of the kernel once none are left', () => {
    expect(unignoreEdit({ ...plan, done: [6, 7], doneKernel: 'k1' }, [6], context)).toMatchObject({
      done: [7],
      doneKernel: 'k1',
    })
    expect(unignoreEdit({ ...plan, done: [6], doneKernel: 'k1' }, [6], context)).toMatchObject({
      done: [],
      doneKernel: null,
    })
  })
})

describe('featuresAt and ignoreSelection', () => {
  // The pocket read from below too; a profile over nearly everything; the wall within the pocket.
  const features = [
    { tag: 'profile', featureType: 'profile', regionIdxs: [1, 2, 3, 4, 5, 6, 7, 9] },
    { tag: 'pocketBelow', featureType: 'pocket', regionIdxs: [4, 3, 2, 1] },
    { tag: 'pocket', featureType: 'pocket', regionIdxs: [1, 2, 3, 4] },
    { tag: 'wall', featureType: 'wall', regionIdxs: [4] },
    { tag: 'slot', featureType: 'open_pocket', regionIdxs: [6, 7] },
  ]

  // Regions 6 and 7 were split from one CAD face; every other region is a face of its own.
  const model = [1, 2, 3, 4, 5, 6, 7, 9].map((idx) => ({ idx, splitOrigin: idx === 7 ? 6 : idx }))
  const meant = (region: number) =>
    ignoreSelection({ region, mode: 'feature', features, regions: model }).tag

  it('means the most specific owner: the fewest regions, never a profile', () => {
    expect(meant(4)).toBe('wall')
    expect(meant(5)).toBeNull()
    expect(meant(9)).toBeNull()
  })

  it('reads owners of exactly the same regions from two directions as one, the first by tag', () => {
    expect(meant(1)).toBe('pocket')
  })

  it('reads every owner for a choice, most specific first, the profile last and never the default', () => {
    expect(featuresAt(4, features).map((each) => each.tag)).toEqual(['wall', 'pocket', 'profile'])
    expect(featuresAt(9, features).map((each) => each.tag)).toEqual(['profile'])
    expect(featuresAt(8, features)).toEqual([])
  })

  it('takes the region clicked, its CAD face’s regions, or the feature’s regions, by mode', () => {
    const at = (region: number, mode: 'region' | 'face' | 'feature') =>
      ignoreSelection({ region, mode, features, regions: model })
    expect(at(1, 'region')).toEqual({ tag: null, regions: [1] })
    expect(at(6, 'region').regions).toEqual([6])
    // Face: the split face whole; an unsplit one is its region alone. No feature is read.
    expect(at(7, 'face')).toEqual({ tag: null, regions: [6, 7] })
    expect(at(1, 'face').regions).toEqual([1])
    // Feature: the most specific owner's regions.
    expect(at(1, 'feature')).toEqual({ tag: 'pocket', regions: [1, 2, 3, 4] })
    expect(at(6, 'feature').regions).toEqual([6, 7])
    // No feature but the profile owns region 9: the region alone.
    expect(at(9, 'feature')).toEqual({ tag: null, regions: [9] })
  })
})

describe('regionLabel', () => {
  it('names a group by its region ids, ascending, never by a feature', () => {
    expect(regionLabel([4])).toBe('Region 4')
    expect(regionLabel([7, 6])).toBe('Regions 6, 7')
  })
})

describe('takeBackIgnore', () => {
  it('puts the regions back as saved, and nothing else', () => {
    const saved = { ...plan, done: [1], doneKernel: 'k1' }
    const next = ignoreEdit(unignoreEdit(saved, [1], context), [4, 9], context).intent
    expect(takeBackIgnore(next, saved, [4], context)).toEqual({
      setups,
      done: [9],
      doneKernel: 'k1',
    })
    expect(takeBackIgnore(next, saved, [1], context).done).toEqual([1, 4, 9])
  })
})

describe('ignoreClick', () => {
  const base = { ignored: new Set<number>(), regions: [6, 7] }

  it('ignores the regions given, whatever features read them', () => {
    expect(ignoreClick({ ...base, region: 7 })).toEqual({ kind: 'ignore', regions: [6, 7] })
    expect(ignoreClick({ ...base, region: 4, regions: [4] })).toEqual({
      kind: 'ignore',
      regions: [4],
    })
  })

  it('lets go of a region ignored before: those given that are ignored', () => {
    expect(ignoreClick({ ...base, region: 7, ignored: new Set([7, 9]) })).toEqual({
      kind: 'unignore',
      regions: [7],
    })
  })
})
