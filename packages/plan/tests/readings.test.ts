import { describe, expect, it } from 'vitest'
import type { CoverageFeature } from '../src/coverage'
import type { PlanDirection } from '../src/engine-plan'
import { faceRegions, readingsFor, type ReadingAt, type ReadingScope } from '../src/readings'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

const feature = (
  tag: string,
  direction: PlanDirection,
  regionIdxs: Array<number>,
  featureType = 'pocket',
) => ({ tag, featureType, regionIdxs, direction })
// A profile of four walls from below; from above, each wall on its own, the first split in two.
const walls = [
  feature('profile', down, [1, 2, 3, 4, 5], 'profile'),
  feature('wallA', up, [1, 2]),
  feature('wallA1', up, [1]),
  feature('wallB', up, [3]),
  feature('rim', up, [1, 2, 3, 4, 5]),
]
const contextOf = (
  features: ReadonlyArray<CoverageFeature & { direction: PlanDirection }>,
  pinnedIn?: (tag: string) => string | null,
) => ({
  features,
  featureOf: (tag: string) =>
    features.find((each) => each.tag.toLowerCase() === tag.toLowerCase()) ?? null,
  pinnedIn,
})
const folder: ReadingScope = { kind: 'folder', id: 'f1', direction: up }

describe('faceRegions', () => {
  it('groups the regions split from one face; a region with no origin is its own', () => {
    const regions = [
      { idx: 1, splitOrigin: 7 },
      { idx: 2, splitOrigin: 7 },
      { idx: 3, splitOrigin: 8 },
    ]
    expect(faceRegions(regions, 2)).toEqual([1, 2])
    expect(faceRegions(regions, 3)).toEqual([3])
    expect(faceRegions(regions, 9)).toEqual([9])
  })
})

describe('readingsFor in a folder', () => {
  const read = (at: Partial<ReadingAt> = {}, scope = folder) =>
    readingsFor(
      { regions: [1], ranked: ['rim', 'wallA', 'wallA1', 'profile'], ...at },
      scope,
      contextOf(walls),
    )

  it('reads the clicked face from the folder’s direction, largest first, the first the default', () => {
    expect(read()).toEqual({ tags: ['rim', 'wallA', 'wallA1'], default: 'rim' })
  })

  it('only reads the face from the folder’s direction', () => {
    expect(read({}, { ...folder, direction: down })).toEqual({
      tags: ['profile'],
      default: 'profile',
    })
    expect(read({ regions: [9] })).toEqual({ tags: [], default: null })
  })

  it('breaks ties in size by the viewer’s ranking', () => {
    const twins = [feature('a', up, [1]), feature('b', up, [1])]
    expect(
      readingsFor({ regions: [1], ranked: ['b', 'a'] }, folder, contextOf(twins)).tags,
    ).toEqual(['b', 'a'])
    // Unranked, report order stands.
    expect(readingsFor({ regions: [1] }, folder, contextOf(twins)).tags).toEqual(['a', 'b'])
  })

  it('takes a reading already pinned in the folder as the default, not one pinned elsewhere', () => {
    const pinnedIn = (tag: string) => (tag === 'wallA1' ? 'f1' : tag === 'wallA' ? 'f2' : null)
    expect(readingsFor({ regions: [1] }, folder, contextOf(walls, pinnedIn)).default).toBe('wallA1')
  })
})

describe('readingsFor while ignoring', () => {
  // The pocket read from below too; a profile over nearly everything; the wall within the pocket.
  const features = [
    feature('profile', up, [1, 2, 3, 4, 5, 6, 7, 9], 'profile'),
    feature('pocketBelow', down, [4, 3, 2, 1]),
    feature('pocket', up, [1, 2, 3, 4]),
    feature('wall', up, [4], 'wall'),
    feature('slot', up, [6, 7], 'open_pocket'),
  ]
  const read = (region: number, prefer?: string) =>
    readingsFor({ regions: [region], prefer }, { kind: 'ignore' }, contextOf(features))

  it('reads every owner, most specific first, the profile last and never the default', () => {
    expect(read(4)).toEqual({ tags: ['wall', 'pocket', 'profile'], default: 'wall' })
    expect(read(9)).toEqual({ tags: ['profile'], default: null })
    expect(read(8)).toEqual({ tags: [], default: null })
  })

  it('reads owners of exactly the same regions from two directions as one, the first by tag', () => {
    expect(read(1)).toEqual({ tags: ['pocket', 'profile'], default: 'pocket' })
  })

  it('takes the feature preferred, even a profile', () => {
    expect(read(4, 'profile').default).toBe('profile')
  })
})

describe('readingsFor over the whole part', () => {
  const all: ReadingScope = { kind: 'all' }
  const read = (at: Partial<ReadingAt> = {}, pinnedIn?: (tag: string) => string | null) =>
    readingsFor({ regions: [1], ...at }, all, contextOf(walls, pinnedIn))

  it('reads every direction, largest first, the viewer’s rank breaking ties', () => {
    expect(read({ ranked: ['profile', 'rim'] })).toEqual({
      tags: ['profile', 'rim', 'wallA', 'wallA1'],
      default: 'profile',
    })
  })

  it('reads a feature on any of several faces once', () => {
    expect(read({ regions: [1, 2, 3] }).tags).toEqual([
      'profile',
      'rim',
      'wallA',
      'wallA1',
      'wallB',
    ])
  })

  it('takes a reading pinned anywhere as the default, else the largest', () => {
    expect(read({}, (tag) => (tag === 'wallA' ? 'f2' : null)).default).toBe('wallA')
    expect(read().default).toBe('profile')
  })

  it('takes the feature preferred where it is among the readings, in any case, else the rule', () => {
    expect(read({ prefer: 'WALLA1' }).default).toBe('wallA1')
    expect(read({ prefer: 'wallB' }).default).toBe('profile')
  })
})
