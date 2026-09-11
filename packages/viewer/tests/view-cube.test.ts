import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../src/model/types.js'
import {
  CHAMFER,
  VIEW_NAMES,
  cubeZones,
  panelGeometry,
  squaredUp,
  viewKind,
  viewUp,
  viewVector,
} from '../src/render/view-cube.js'

/**
 * The cube is the only control in the viewport that is also geometry, so its
 * shape is testable in node: 26 planar panels, each facing the direction it
 * takes the camera to.
 */

describe('the 26 standard views', () => {
  it('covers six faces, twelve edges and eight corners', () => {
    const kinds = VIEW_NAMES.map(viewKind)

    expect(VIEW_NAMES).toHaveLength(26)
    expect(kinds.filter((kind) => kind === 'face')).toHaveLength(6)
    expect(kinds.filter((kind) => kind === 'edge')).toHaveLength(12)
    expect(kinds.filter((kind) => kind === 'corner')).toHaveLength(8)
  })

  it('names them in the Z-up frame the part data is authored in', () => {
    // +Z is the top, −Y is the front, +X is the right. Getting this wrong puts
    // every label on the wrong panel, which is not subtle but is easy to do.
    expect(viewVector('top')).toEqual({ x: 0, y: 0, z: 1 })
    expect(viewVector('front')).toEqual({ x: 0, y: -1, z: 0 })
    expect(viewVector('right')).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('gives every view a unit direction', () => {
    for (const name of VIEW_NAMES) {
      const { x, y, z } = viewVector(name)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12)
    }
  })
})

describe('viewUp', () => {
  it('keeps Z up for every view that is not looking down it', () => {
    expect(viewUp(viewVector('front'))).toEqual({ x: 0, y: 0, z: 1 })
    expect(viewUp(viewVector('top-front-right'))).toEqual({ x: 0, y: 0, z: 1 })
  })

  /**
   * Straight down Z, an up vector parallel to the view is degenerate and the
   * camera has no defined roll. ±Y puts the front edge at the bottom of the
   * screen, which is what every CAD package does.
   */
  it('falls to Y on the two views that look down Z', () => {
    expect(viewUp(viewVector('top'))).toEqual({ x: 0, y: 1, z: 0 })
    expect(viewUp(viewVector('bottom'))).toEqual({ x: 0, y: -1, z: 0 })
  })
})

/**
 * Clicking a panel squares the view, and there are four ways to be square. The
 * cube picks the one nearest the pose being left, as the Fusion cube does — so
 * a view is reached without the part spinning on the way to it.
 */
describe('squaredUp', () => {
  const near = (a: Vec3, b: Vec3) => {
    expect(a.x).toBeCloseTo(b.x, 12)
    expect(a.y).toBeCloseTo(b.y, 12)
    expect(a.z).toBeCloseTo(b.z, 12)
  }

  it('is perpendicular to the view, and one of its four rolls, for all 26 views', () => {
    // A camera rolled well off any axis, so nothing here passes by accident.
    const rolled = { x: 0.3, y: -0.42, z: 0.86 }

    for (const name of VIEW_NAMES) {
      const direction = viewVector(name)
      const up = squaredUp(direction, rolled)
      const canonical = viewUp(direction)

      expect(Math.hypot(up.x, up.y, up.z)).toBeCloseTo(1, 12)
      expect(up.x * direction.x + up.y * direction.y + up.z * direction.z).toBeCloseTo(0, 12)

      // Square, and only square: a quarter turn about the view leaves the up
      // vector either along the canonical one or square to it, never between.
      // (Measured against the canonical up with its own view component
      // removed, which is the 0° roll itself.)
      const along =
        canonical.x * direction.x + canonical.y * direction.y + canonical.z * direction.z
      const zero = {
        x: canonical.x - along * direction.x,
        y: canonical.y - along * direction.y,
        z: canonical.z - along * direction.z,
      }
      const length = Math.hypot(zero.x, zero.y, zero.z)
      const cosine = (up.x * zero.x + up.y * zero.y + up.z * zero.z) / length

      expect(Math.min(Math.abs(cosine), Math.abs(Math.abs(cosine) - 1))).toBeCloseTo(0, 12)
    }
  })

  it('keeps a face view on an axis, whichever roll it lands on', () => {
    for (const name of ['top', 'bottom', 'front', 'back', 'left', 'right'] as const) {
      const up = squaredUp(viewVector(name), { x: 0.3, y: -0.42, z: 0.86 })

      for (const component of [up.x, up.y, up.z]) {
        expect(Math.min(Math.abs(component), Math.abs(Math.abs(component) - 1))).toBeCloseTo(0, 12)
      }
    }
  })

  it('takes the canonical roll when the camera is already near it', () => {
    near(squaredUp(viewVector('front'), { x: 0, y: 0, z: 1 }), { x: 0, y: 0, z: 1 })
    near(squaredUp(viewVector('top'), { x: 0, y: 1, z: 0 }), { x: 0, y: 1, z: 0 })
  })

  /**
   * The point of choosing rather than imposing. Arriving at the bottom view
   * from a camera rolled a quarter turn, the canonical −Y up is a 90° spin
   * away and +X is already there, so +X is what it lands on.
   */
  it('takes a quarter turn when that is the nearer square', () => {
    near(squaredUp(viewVector('bottom'), { x: 0.9, y: -0.1, z: 0 }), { x: 1, y: 0, z: 0 })
    near(squaredUp(viewVector('front'), { x: -0.95, y: 0, z: 0.2 }), { x: -1, y: 0, z: 0 })
  })

  it('turns all the way over when the camera is upside down', () => {
    near(squaredUp(viewVector('front'), { x: 0, y: 0, z: -1 }), { x: 0, y: 0, z: -1 })
  })

  /** Nothing to be near, so it falls to the orientation the labels are drawn for. */
  it('falls back to the canonical roll for a camera with no up', () => {
    near(squaredUp(viewVector('front'), { x: 0, y: 0, z: 0 }), { x: 0, y: 0, z: 1 })
  })
})

describe('cubeZones', () => {
  const zones = cubeZones()

  it('gives a square to a face, a rectangle to an edge and a triangle to a corner', () => {
    const sides = (kind: string) =>
      zones.filter((zone) => zone.kind === kind).map((zone) => zone.polygon.length)

    expect(new Set(sides('face'))).toEqual(new Set([4]))
    expect(new Set(sides('edge'))).toEqual(new Set([4]))
    expect(new Set(sides('corner'))).toEqual(new Set([3]))
  })

  /**
   * Every panel is wound counter-clockwise seen from outside. Getting one
   * backwards makes it invisible from the front and solid from behind, which
   * reads as a hole in the cube.
   */
  it('winds every panel to face outwards', () => {
    for (const zone of zones) {
      const [a, b, c] = zone.polygon
      if (!a || !b || !c) throw new Error(`${zone.name} has no polygon`)

      const facing = new Vector3()
        .subVectors(new Vector3(b.x, b.y, b.z), new Vector3(a.x, a.y, a.z))
        .cross(new Vector3().subVectors(new Vector3(c.x, c.y, c.z), new Vector3(a.x, a.y, a.z)))

      expect(
        facing.dot(new Vector3(zone.direction.x, zone.direction.y, zone.direction.z)),
      ).toBeGreaterThan(0)
    }
  })

  it('keeps every panel planar and on its own side of the cube', () => {
    for (const zone of zones) {
      const normal = new Vector3(zone.direction.x, zone.direction.y, zone.direction.z)
      const distances = zone.polygon.map((point) =>
        new Vector3(point.x, point.y, point.z).dot(normal),
      )

      // All at one distance along the normal: a planar panel.
      for (const distance of distances) {
        expect(distance).toBeCloseTo(distances[0]!, 9)
        expect(distance).toBeGreaterThan(0)
      }
    }
  })

  it('takes the chamfer off the faces, which is what leaves room for the rest', () => {
    const top = zones.find((zone) => zone.name === 'top')

    // A face reaches CHAMFER of the way out; the remainder is the chamfer the
    // edge and corner panels occupy.
    for (const point of top?.polygon ?? []) {
      expect(Math.abs(point.x)).toBeCloseTo(CHAMFER, 9)
      expect(point.z).toBeCloseTo(1, 9)
    }
    expect(CHAMFER).toBeLessThan(1)
  })

  it('builds a triangle fan for every panel', () => {
    for (const zone of zones) {
      const geometry = panelGeometry(zone)
      const vertices = geometry.getAttribute('position').count

      expect(vertices).toBe((zone.polygon.length - 2) * 3)
      expect(geometry.getAttribute('normal').count).toBe(vertices)
    }
  })
})
