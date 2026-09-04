import { Box3, Plane, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  PICKED_SURFACE_LABEL,
  dragPlane,
  sectionBounds,
  sectionConstant,
  sectionDepth,
  sectionDepthConstant,
  sectionDepthRange,
  sectionFromPick,
  sectionOffset,
  sectionPlane,
} from '../src/render/section.js'
import { resolveSectionPlane } from '../src/section-view.js'

/**
 * A section is a plane constant and a sign convention, and every bug in one is
 * a sign error: the part stays whole, or vanishes entirely, or the plane draws
 * behind what it was meant to cut. So the conventions are pinned here.
 */

const cube = () => new Box3(new Vector3(0, 0, 0), new Vector3(50.8, 50.8, 50.8))
const inside = (point: Vector3, box: Box3) => box.containsPoint(point)

describe('sectionBounds', () => {
  it('sweeps from whole to gone', () => {
    const box = cube()
    const bounds = sectionBounds(box, { x: 0, y: 0, z: 1 })
    const plane = sectionPlane(box, { x: 0, y: 0, z: 1 }, 0)

    // t = 0 keeps every corner; t = 1 keeps none. The margin exists because a
    // corner exactly on the plane is not strictly inside the kept half-space.
    for (let corner = 0; corner < 8; corner += 1) {
      const point = new Vector3(
        corner & 1 ? box.max.x : box.min.x,
        corner & 2 ? box.max.y : box.min.y,
        corner & 4 ? box.max.z : box.min.z,
      )
      expect(plane.distanceToPoint(point)).toBeGreaterThan(0)
    }

    const gone = sectionPlane(box, { x: 0, y: 0, z: 1 }, 1)
    expect(gone.distanceToPoint(box.max)).toBeLessThan(0)
    expect(bounds.min).toBeLessThan(bounds.max)
  })

  /**
   * The reason bounds come from the eight corners rather than one axis extent:
   * a tilted plane leaves the box through a corner, and an axis-aligned
   * approximation either stops short of the part or sweeps through empty space
   * before reaching it.
   */
  it('sweeps a tilted plane across the whole part', () => {
    const box = cube()
    const tilted = { x: 0.577, y: 0.577, z: 0.577 }

    const whole = sectionPlane(box, tilted, 0)
    const gone = sectionPlane(box, tilted, 1)

    expect(whole.distanceToPoint(box.min)).toBeGreaterThan(0)
    expect(whole.distanceToPoint(box.max)).toBeGreaterThan(0)
    expect(gone.distanceToPoint(box.min)).toBeLessThan(0)
    expect(gone.distanceToPoint(box.max)).toBeLessThan(0)
  })

  it('keeps the half its normal points into', () => {
    const box = cube()
    const half = sectionPlane(box, { x: 0, y: 0, z: 1 }, 0.5)

    // +Z keeps the top and takes the bottom away, so the sweep eats upward.
    // This is the sign the whole feature turns on: reversed, the cut removes
    // the half somebody was trying to look at.
    expect(half.distanceToPoint(new Vector3(25.4, 25.4, 50.8))).toBeGreaterThan(0)
    expect(half.distanceToPoint(new Vector3(25.4, 25.4, 0))).toBeLessThan(0)
    expect(inside(new Vector3(25.4, 25.4, 25.4), box)).toBe(true)
  })
})

describe('sectionOffset', () => {
  it('inverts sectionConstant', () => {
    const bounds = sectionBounds(cube(), { x: 0, y: 0, z: 1 })

    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(sectionOffset(bounds, sectionConstant(bounds, t))).toBeCloseTo(t, 9)
    }
  })

  it('keeps a slider at rest rather than at NaN on a part with no extent', () => {
    const flat = new Box3(new Vector3(0, 0, 5), new Vector3(10, 10, 5))
    const bounds = { min: 0, max: 0 }

    expect(sectionOffset(bounds, 0)).toBe(0)
    expect(Number.isNaN(sectionOffset(sectionBounds(flat, { x: 1, y: 0, z: 0 }), 0))).toBe(false)
  })
})

describe('sectionFromPick', () => {
  /**
   * The pick reports the surface normal, which faces the viewer; the plane keeps
   * what its own normal points into. Getting this backwards leaves the part
   * whole with a plane drawn behind it.
   */
  it('turns a picked face into a cut that removes material in front of it', () => {
    const box = cube()
    const placement = sectionFromPick({
      point: { x: 25.4, y: 25.4, z: 50.8 },
      normal: { x: 0, y: 0, z: 1 },
    })

    expect(placement.normal.x).toBeCloseTo(0, 12)
    expect(placement.normal.y).toBeCloseTo(0, 12)
    expect(placement.normal.z).toBe(-1)
    expect(placement.label).toBe(PICKED_SURFACE_LABEL)

    // One millimetre past the top face removes the top millimetre and keeps
    // everything below it.
    const cut = new Plane(
      new Vector3(placement.normal.x, placement.normal.y, placement.normal.z),
      sectionDepthConstant(placement.normal, placement.point, 1),
    )
    expect(cut.distanceToPoint(new Vector3(25.4, 25.4, 49.5))).toBeGreaterThan(0)
    expect(cut.distanceToPoint(new Vector3(25.4, 25.4, 50.5))).toBeLessThan(0)
    expect(inside(new Vector3(25.4, 25.4, 49.5), box)).toBe(true)
  })
})

describe('sectionDepth', () => {
  it('measures how far past the anchor the cut sits, and is its own inverse', () => {
    const normal = { x: 0, y: 0, z: -1 }
    const anchor = { x: 0, y: 0, z: 50.8 }

    const constant = sectionDepth(normal, anchor, 3)
    expect(sectionDepth(normal, anchor, constant)).toBeCloseTo(3, 9)
  })

  it('reports the depths at which the cut starts and finishes', () => {
    const box = cube()
    const normal = { x: 0, y: 0, z: -1 }
    const anchor = { x: 25.4, y: 25.4, z: 50.8 }
    const range = sectionDepthRange(sectionBounds(box, normal), normal, anchor)

    // From just above the top face to just past the bottom one: the full
    // thickness, plus the margin at each end.
    expect(range.min).toBeLessThan(0)
    expect(range.max).toBeGreaterThan(50)
  })
})

describe('dragPlane', () => {
  it('faces the camera while containing the axis being dragged', () => {
    const axis = new Vector3(0, 0, 1)
    const view = new Vector3(1, 0, 0)
    const plane = dragPlane(axis, view, new Vector3())

    // Contains the axis, so travel along it is measurable, and faces the
    // viewer as squarely as it can.
    expect(plane.normal.dot(axis)).toBeCloseTo(0, 9)
    expect(Math.abs(plane.normal.dot(view))).toBeCloseTo(1, 9)
  })

  it('picks a workable plane when the axis points at the camera', () => {
    const axis = new Vector3(0, 0, 1)
    const plane = dragPlane(axis, new Vector3(0, 0, 1), new Vector3())

    // Edge-on, the cross product degenerates; any plane containing the axis
    // will do, and NaN will not.
    expect(Number.isFinite(plane.normal.length())).toBe(true)
    expect(plane.normal.dot(axis)).toBeCloseTo(0, 9)
  })
})

/**
 * The same unmeasured box the grid guards against, at the seam that reads it
 * next. `part-mesh` calls this on its first frame, before `useContentBox` has
 * anything to report, and an empty `Box3` sweeps between infinite bounds — a
 * NaN plane constant clips the whole scene away, so the part does not appear
 * at all rather than appearing uncut.
 */
describe('resolveSectionPlane', () => {
  it('has no cut for an unmeasured scene', () => {
    expect(resolveSectionPlane({ enabled: true }, new Box3())).toBeNull()
  })

  it('has no cut when sectioning is off', () => {
    expect(resolveSectionPlane({ enabled: false }, cube())).toBeNull()
    expect(resolveSectionPlane(undefined, cube())).toBeNull()
  })

  it('cuts a measured part on a finite plane', () => {
    const resolved = resolveSectionPlane({ enabled: true, offset: 0.5 }, cube())
    if (resolved === null) throw new Error('a measured part gets a cut')

    expect(Number.isFinite(resolved.plane.constant)).toBe(true)
    expect(resolved.state.enabled).toBe(true)
  })
})
