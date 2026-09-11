/**
 * The feature in section, with the tool in it.
 *
 * The drawing a machinist sketches before a setup: the tool's tip on the
 * feature's bottom, its edge against the wall, and the part beyond standing as
 * tall as the reach curve says. Everything is millimetres in the drawing's own
 * frame — `x` across from the tool's axis, `z` up from the feature's bottom.
 *
 * **The staircase is the sweep's own.** What this draws beyond the wall has to
 * be the same material `clearance` refuses a holder for; a picture that
 * disagrees with its own verdict is worse than no picture. That is asserted
 * here against `heightAt` rather than against a copied table of numbers.
 */

import { describe, expect, it } from 'vitest'

import {
  FLOOR_BAND,
  REACH,
  heightAt,
  sectionOutline,
  type FeatureSection,
  type ReachCurve,
  type SectionPoint,
} from '../src/index.js'

/** A 12 mm wall standing 2 mm out from the cut, rising to 30 mm past 8 mm out. */
const curve: ReachCurve = { horizontalOffset: [2, 8], verticalOffset: [12, 30] }

const pocket: FeatureSection = {
  kind: 'pocket',
  depth: 10,
  hasFloor: true,
  width: 20,
  filletRadius: 0,
  coneDeg: null,
  topAbove: 10,
  curve: null,
}

const mill = { diameter: 6, form: 'flat end mill' }
const drill = { diameter: 6, form: 'drill' }

/** Every vertex of every polygon, for a question about the drawing as a whole. */
const vertices = (polygons: ReadonlyArray<ReadonlyArray<SectionPoint>>): SectionPoint[] =>
  polygons.flatMap((polygon) => [...polygon])

describe('a pocket in section', () => {
  it('stands the walls off the tool and floors it between them', () => {
    const section = sectionOutline(pocket, mill)
    // The cutting edge is against the left wall, so the wall is at −R and the
    // right wall one width across from it.
    expect(section.leftWall).toBe(-3)
    expect(section.rightWall).toBe(17)
    expect(section.floor).toEqual({ from: -3, to: 17 })
  })

  it('draws stock under the floor, and none under a through feature', () => {
    expect(sectionOutline(pocket, mill).extent.bottom).toBe(-FLOOR_BAND)

    const through = sectionOutline({ ...pocket, hasFloor: false }, mill)
    expect(through.extent.bottom).toBe(0)
    expect(through.floor).toBeNull()
  })

  it('carries the walls up to the top of the feature', () => {
    const section = sectionOutline(pocket, mill)
    expect(section.extent.top).toBe(10)
  })

  it('widens to the tool where the feature is narrower than it', () => {
    // A 4 mm slot cannot be cut by a 6 mm end mill, and drawing the walls
    // inside the tool would show it cutting air on both flanks.
    const narrow = sectionOutline({ ...pocket, width: 4 }, mill)
    expect(narrow.rightWall).toBe(3)
    expect((narrow.rightWall ?? 0) - (narrow.leftWall ?? 0)).toBe(mill.diameter)
  })

  it('leaves the right side open on a wall, which has only one', () => {
    const wall = sectionOutline({ ...pocket, kind: 'wall' }, mill)
    expect(wall.rightWall).toBeNull()
    // The floor still has to run somewhere, so it runs out to the drawing.
    expect(wall.floor?.to).toBe(wall.extent.right)
  })

  it('states no right wall where the datasheet states no width', () => {
    expect(sectionOutline({ ...pocket, width: null }, mill).rightWall).toBeNull()
  })
})

describe('the floor fillet', () => {
  it('starts the floor at the fillet’s tangent, not at the wall', () => {
    const filleted = sectionOutline({ ...pocket, filletRadius: 2 }, mill)
    expect(filleted.floor).toEqual({ from: -1, to: 15 })
  })

  it('rounds from the floor tangent up to the wall tangent', () => {
    const filleted = sectionOutline({ ...pocket, filletRadius: 2 }, mill)
    const points = vertices(filleted.material)
    // One radius in from the wall, on the floor; and one radius up the wall.
    expect(points).toContainEqual({ x: -1, z: 0 })
    expect(points).toContainEqual({ x: -3, z: 2 })
  })

  it('clamps a fillet deeper than the feature to the feature', () => {
    // A radius the datasheet states larger than the pocket is deep would put
    // the tangent above the top of the wall.
    const deep = sectionOutline({ ...pocket, depth: 3, filletRadius: 9 }, mill)
    expect(deep.floor).toEqual({ from: 0, to: 14 })
  })
})

describe('a drilled hole', () => {
  const hole: FeatureSection = { ...pocket, kind: 'hole', width: 8, coneDeg: 118 }

  it('puts a drill on the axis rather than against a wall', () => {
    // A drill does not hug a wall, so the bore is centred on the tool.
    const section = sectionOutline(hole, drill)
    expect(section.leftWall).toBe(-4)
    expect(section.rightWall).toBe(4)
  })

  it('puts an end mill against the wall in the same hole', () => {
    // The same feature, entered by something that helixes: it hugs the wall.
    const section = sectionOutline(hole, mill)
    expect(section.leftWall).toBe(-3)
  })

  it('stands the walls on the cone’s rim and the tip in its apex', () => {
    const section = sectionOutline(hole, drill)
    // 118° included: the rim stands |leftWall| / tan(59°) above the apex.
    const rise = 4 / Math.tan((59 * Math.PI) / 180)
    expect(vertices(section.material)).toContainEqual({ x: 0, z: 0 })
    const rim = vertices(section.material).find((point) => point.x === -4 && point.z > 0)
    expect(rim?.z).toBeCloseTo(rise, 6)
  })

  it('is flat-bottomed at 180 degrees, and where the datasheet says nothing', () => {
    for (const coneDeg of [180, null]) {
      const flat = sectionOutline({ ...hole, coneDeg }, drill)
      expect(flat.floor).toEqual({ from: -4, to: 4 })
      // Nothing rises off the floor between the walls.
      expect(vertices(flat.material).some((point) => point.x === 0 && point.z === 0)).toBe(false)
    }
  })
})

describe('the material beyond the wall', () => {
  it('is the same staircase the sweep walks', () => {
    // The check that makes the drawing worth trusting: every run drawn beyond
    // the wall stands at `heightAt` for that distance from the cut, so what the
    // picture shows a holder clearing is what the verdict cleared.
    //
    // Measured across each run rather than at each vertex: a knot carries two
    // vertices, the top of one run and the bottom of the next, and asking a
    // riser how tall it is has two right answers.
    const section = sectionOutline({ ...pocket, curve }, mill)
    const wall = section.material[0]!
    const runs = wall
      .slice(1)
      .map((point, index) => ({ from: wall[index]!, to: point }))
      .filter(({ from, to }) => from.z === to.z && from.x !== to.x && from.z > 0)

    expect(runs.length).toBeGreaterThan(1)
    for (const { from, to } of runs) {
      // `x` is across from the axis; the curve's offsets run from the cutting
      // edge, which is one radius further in.
      const offset = Math.abs((from.x + to.x) / 2) - mill.diameter / 2
      expect(from.z, `across the run ${offset} mm out from the cut`).toBeCloseTo(
        Math.max(heightAt(curve, offset), pocket.depth),
        6,
      )
    }
  })

  it('rises at the start of each run, so a knot is already as tall as it says', () => {
    const section = sectionOutline({ ...pocket, curve, depth: 1 }, mill)
    const points = vertices(section.material)
    // The 30 mm step is reached at the 2 mm knot, not at the 8 mm one.
    expect(points).toContainEqual({ x: -5, z: 30 })
  })

  it('runs the part out past the last knot at the last height', () => {
    const section = sectionOutline({ ...pocket, curve }, mill)
    // 8 mm out is the last knot; the drawing carries 30 mm on for `REACH`.
    expect(section.extent.left).toBeCloseTo(-3 - 8 - REACH, 6)
    expect(vertices(section.material)).toContainEqual({ x: section.extent.left, z: 30 })
  })

  it('stands the part at the feature’s top where no curve was stated', () => {
    const section = sectionOutline({ ...pocket, curve: null, topAbove: 25 }, mill)
    expect(section.extent.top).toBe(25)
  })
})

describe('a face', () => {
  const face: FeatureSection = { ...pocket, kind: 'face', width: null, topAbove: 0 }

  it('is the floor, with stock under the whole drawing', () => {
    const section = sectionOutline(face, mill)
    expect(section.leftWall).toBeNull()
    expect(section.rightWall).toBeNull()
    expect(section.floor).toEqual({ from: section.extent.left, to: section.extent.right })
    expect(section.extent.top).toBe(0)
  })

  it('stands whatever the curve says is beside it, on both flanks', () => {
    const section = sectionOutline({ ...face, curve }, mill)
    expect(section.extent.top).toBe(30)
    // Symmetric: a face is approached from above, so neither flank is special.
    expect(section.extent.right).toBeCloseTo(-section.extent.left, 6)
  })
})
