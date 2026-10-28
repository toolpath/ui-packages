import { describe, expect, it } from 'vitest'
import type { PartModel } from '../src/model/types.js'
import { bestOwner, cycleOwner, featureTypeRank, rankOwners } from '../src/render/selection.js'
import { cubeModel } from './fixtures.js'

/**
 * The ranking is a heuristic wearing a confident face, and its failure mode is
 * silent — the code does exactly what it was told while the user quietly stops
 * trusting the viewport. It is pure, so every case that matters can be pinned
 * here, straight off the cube's measured structure.
 */

const PZ = { x: 0, y: 0, z: 1 }
const PY = { x: 0, y: 1, z: 0 }

function owners(model: PartModel, region: number) {
  return model.regionIndex.featuresForRegion(region)
}

function typeOf(model: PartModel, tag: string | null) {
  return model.features.find((feature) => feature.tag === tag)?.featureType
}

function directionOf(model: PartModel, tag: string | null) {
  return model.features.find((feature) => feature.tag === tag)?.machiningDirection
}

describe('rankOwners', () => {
  /**
   * The one rule that does real work. Under `+Z`, region 3 is covered by that
   * direction's `wall` *and* its `profile`; a profile traces a boundary rather
   * than cutting a surface, so it must never win the surface it traces.
   */
  it("puts a wall ahead of its own direction's profile", () => {
    const model = cubeModel()
    const ranked = rankOwners(model, owners(model, 3), { activeDirection: PZ })

    expect(ranked.map((tag) => typeOf(model, tag))).toEqual(['wall', 'profile'])
  })

  it('filters by the active direction before any other rule applies', () => {
    const model = cubeModel()
    const all = owners(model, 3)

    expect(all).toHaveLength(8)
    expect(rankOwners(model, all, { activeDirection: PZ })).toHaveLength(2)
    expect(
      rankOwners(model, all, { activeDirection: PZ }).map((tag) => directionOf(model, tag)),
    ).toEqual([PZ, PZ])
  })

  /**
   * Reachable, not hypothetical: with `+Z` active, the bottom of the cube
   * belongs to no feature at all. A ranking that assumed a non-empty candidate
   * set would report this as a pick that missed the part.
   */
  it('returns nothing for a region the active direction cannot reach', () => {
    const model = cubeModel()
    // Region 0 is the −Z face; nothing approaching from +Z owns it.
    const ranked = rankOwners(model, owners(model, 0), { activeDirection: PZ })

    expect(owners(model, 0)).toHaveLength(5)
    expect(ranked).toEqual([])
    expect(bestOwner(model, owners(model, 0), { activeDirection: PZ })).toBeNull()
  })

  it('never truncates the owner set when nothing is scoping it', () => {
    const model = cubeModel()

    // The worst case any panel layout has to survive: eight rows, four groups.
    expect(rankOwners(model, owners(model, 3))).toHaveLength(8)
    expect(rankOwners(model, owners(model, 5))).toHaveLength(8)
  })

  /**
   * Camera alignment is the third layer, and it only gets to speak once type
   * specificity has tied. Region 3 has four walls, one per direction; which one
   * a click means depends on where the click came from.
   */
  it('prefers the owner facing the camera among equally specific types', () => {
    const model = cubeModel()
    const all = owners(model, 3)

    const fromAbove = bestOwner(model, all, { viewDirection: PZ })
    const fromSide = bestOwner(model, all, { viewDirection: PY })

    expect(typeOf(model, fromAbove)).toBe('wall')
    expect(directionOf(model, fromAbove)).toEqual(PZ)
    expect(directionOf(model, fromSide)).toEqual(PY)
  })

  it('prefers a face over a wall on the surface the face owns', () => {
    const model = cubeModel()
    // Region 1 is the +Z face: one `face` from +Z, walls and profiles from ±Y.
    const best = bestOwner(model, owners(model, 1), { viewDirection: PZ })

    expect(typeOf(model, best)).toBe('face')
  })

  it('is deterministic for the same inputs', () => {
    const model = cubeModel()
    const once = rankOwners(model, owners(model, 3), { viewDirection: PZ })
    const twice = rankOwners(model, owners(model, 3), { viewDirection: PZ })

    expect(once).toEqual(twice)
  })

  it('drops a tag the report does not know', () => {
    expect(rankOwners(cubeModel(), ['nope'])).toEqual([])
  })
})

describe('featureTypeRank', () => {
  it('orders holes ahead of bulk surfaces and profile last', () => {
    expect(featureTypeRank('through_hole')).toBeLessThan(featureTypeRank('pocket'))
    expect(featureTypeRank('pocket')).toBeLessThan(featureTypeRank('chamfer'))
    expect(featureTypeRank('chamfer')).toBeLessThan(featureTypeRank('wall'))
    expect(featureTypeRank('wall')).toBe(featureTypeRank('face'))
    expect(featureTypeRank('face')).toBeLessThan(featureTypeRank('profile'))
  })

  /**
   * A circular wall is the outside of a whole cylinder: a stud or a round boss,
   * which read as a `boss` before the kernel reported the type, or a turned
   * part's outline, which read as a `wall`. Either way it is a shape a click
   * means, not bulk surface.
   */
  it('ranks a circular wall with the bosses', () => {
    expect(featureTypeRank('circular_wall')).toBe(featureTypeRank('boss'))
    expect(featureTypeRank('circular_wall')).toBeLessThan(featureTypeRank('chamfer'))
  })

  /**
   * `featureType` is an open set — eighteen values across two parts, and the
   * kernel will add more. A type nobody has seen is likelier to be a specific
   * machined feature than a new kind of wall, so it outranks the bulk surfaces
   * without displacing the ones actually known to be specific.
   */
  it('places an unknown type between transitions and bulk surfaces', () => {
    expect(featureTypeRank('some_future_feature')).toBeGreaterThan(featureTypeRank('chamfer'))
    expect(featureTypeRank('some_future_feature')).toBeLessThan(featureTypeRank('wall'))
  })
})

describe('cycleOwner', () => {
  it('walks the owners in order and wraps', () => {
    expect(cycleOwner(['a', 'b', 'c'], null)).toBe('a')
    expect(cycleOwner(['a', 'b', 'c'], 'a')).toBe('b')
    expect(cycleOwner(['a', 'b', 'c'], 'c')).toBe('a')
  })

  it('restarts rather than dead-ending on an owner it does not hold', () => {
    expect(cycleOwner(['a', 'b'], 'z')).toBe('a')
  })

  it('has nothing to cycle through when there are no owners', () => {
    expect(cycleOwner([], 'a')).toBeNull()
  })

  /**
   * Eight clicks on region 3 must visit all eight owners and land back on the
   * first — the escape hatch only works if it actually reaches everything.
   */
  it("reaches every owner of the cube's worst-case region", () => {
    const model = cubeModel()
    const ranked = rankOwners(model, owners(model, 3))

    const visited: Array<string | null> = []
    let current: string | null = null
    for (let click = 0; click < ranked.length; click += 1) {
      current = cycleOwner(ranked, current)
      visited.push(current)
    }

    expect(new Set(visited).size).toBe(8)
    expect(cycleOwner(ranked, current)).toBe(ranked[0])
  })
})
