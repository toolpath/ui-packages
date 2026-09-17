import { BoxGeometry, Plane, Ray, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  capHit,
  clipSegments,
  pointInContour,
  sampleSection,
  sectionContour,
} from '../src/render/resample.js'

/** A 10 mm cube about the origin, de-indexed: two triangles per face, faces in three's order. */
const cube = () => new BoxGeometry(10, 10, 10).toNonIndexed().getAttribute('position').array

/** Each face of the cube as one region: triangles come in face pairs. */
const cubeRegions = () => Int32Array.from({ length: 12 }, (_, t) => Math.floor(t / 2))

/** Keeps `z < 0`: the top half is cut away. */
const keepBelow = () => new Plane(new Vector3(0, 0, -1), 0)

const segments = (positions: ArrayLike<number>) => {
  const out: { a: Vector3; b: Vector3 }[] = []
  for (let i = 0; i + 5 < positions.length; i += 6) {
    out.push({
      a: new Vector3(positions[i], positions[i + 1], positions[i + 2]),
      b: new Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
    })
  }
  return out
}

describe('clipSegments', () => {
  it('keeps a segment on the kept side, drops one on the other, and trims one that crosses', () => {
    const plane = keepBelow()
    const kept = clipSegments([0, 0, -5, 1, 0, -5], plane)
    expect(kept).toHaveLength(6)
    expect(clipSegments([0, 0, 5, 1, 0, 5], plane)).toHaveLength(0)

    const trimmed = segments(clipSegments([0, 0, -5, 0, 0, 5], plane))
    expect(trimmed).toHaveLength(1)
    expect(trimmed[0]!.a.z).toBeCloseTo(-5, 9)
    expect(trimmed[0]!.b.z).toBeCloseTo(0, 9)
  })

  it('keeps a segment lying in the plane', () => {
    expect(clipSegments([0, 0, 0, 1, 0, 0], keepBelow())).toHaveLength(6)
  })
})

describe('sectionContour', () => {
  it('cuts a cube into a square of four segments, one per face, not one per triangle', () => {
    const contour = segments(sectionContour(cube(), cubeRegions(), keepBelow()))
    expect(contour).toHaveLength(4)
    for (const { a, b } of contour) {
      expect(a.z).toBeCloseTo(0, 6)
      expect(b.z).toBeCloseTo(0, 6)
      expect(a.distanceTo(b)).toBeCloseTo(10, 5)
    }
  })

  it('does not stitch across a fold, whatever the regions say', () => {
    // No region table: every triangle is one surface. The square's sides still
    // meet at right angles, so they stay four segments.
    expect(segments(sectionContour(cube(), null, keepBelow()))).toHaveLength(4)
  })

  it('is empty for a plane that misses the part', () => {
    expect(
      sectionContour(cube(), cubeRegions(), new Plane(new Vector3(0, 0, -1), 20)),
    ).toHaveLength(0)
  })

  it('follows a tilted plane through the cube', () => {
    const tilted = new Plane(new Vector3(1, 0, 1).normalize(), 0)
    const contour = segments(sectionContour(cube(), cubeRegions(), tilted))
    // A diagonal cut through a cube is a rectangle: four edges.
    expect(contour).toHaveLength(4)
    for (const { a, b } of contour) {
      expect(tilted.distanceToPoint(a)).toBeCloseTo(0, 6)
      expect(tilted.distanceToPoint(b)).toBeCloseTo(0, 6)
    }
  })
})

describe('pointInContour', () => {
  const plane = keepBelow()
  const square = sectionContour(cube(), cubeRegions(), plane)

  it('tells inside from outside', () => {
    expect(pointInContour(new Vector3(0, 0, 0), plane, square)).toBe(true)
    expect(pointInContour(new Vector3(4, -4, 0), plane, square)).toBe(true)
    expect(pointInContour(new Vector3(6, 0, 0), plane, square)).toBe(false)
    expect(pointInContour(new Vector3(0, 20, 0), plane, square)).toBe(false)
  })

  it('treats a hole in the outline as outside', () => {
    // A 10 mm square with a 2 mm square hole, as two loops.
    const outer = [-5, -5, 0, 5, -5, 0, 5, -5, 0, 5, 5, 0, 5, 5, 0, -5, 5, 0, -5, 5, 0, -5, -5, 0]
    const inner = [-1, -1, 0, 1, -1, 0, 1, -1, 0, 1, 1, 0, 1, 1, 0, -1, 1, 0, -1, 1, 0, -1, -1, 0]
    const contour = [...outer, ...inner]
    expect(pointInContour(new Vector3(3, 3, 0), plane, contour)).toBe(true)
    expect(pointInContour(new Vector3(0, 0, 0), plane, contour)).toBe(false)
  })
})

describe('capHit', () => {
  const plane = keepBelow()
  const square = sectionContour(cube(), cubeRegions(), plane)

  it('lands on the cap for a ray through the cut, and not beside it', () => {
    const down = new Ray(new Vector3(2, 2, 50), new Vector3(0, 0, -1))
    const hit = capHit(down, plane, square)
    expect(hit).not.toBeNull()
    expect(hit!.z).toBeCloseTo(0, 9)
    expect(hit!.x).toBeCloseTo(2, 9)

    const beside = new Ray(new Vector3(8, 2, 50), new Vector3(0, 0, -1))
    expect(capHit(beside, plane, square)).toBeNull()
  })

  it('misses a plane the ray runs parallel to', () => {
    const sideways = new Ray(new Vector3(-50, 0, 0.5), new Vector3(1, 0, 0))
    expect(capHit(sideways, plane, square)).toBeNull()
  })
})

describe('sampleSection', () => {
  it('trims the edges and appends the outline', () => {
    const plane = keepBelow()
    // One vertical edge of the cube, top to bottom.
    const edges = [5, 5, -5, 5, 5, 5]
    const sample = sampleSection(cube(), cubeRegions(), edges, plane)
    expect(sample.contour).toHaveLength(4 * 6)
    expect(sample.edges).toHaveLength(6 + 4 * 6)
    const [trimmed] = segments(sample.edges)
    expect(Math.max(trimmed!.a.z, trimmed!.b.z)).toBeCloseTo(0, 9)
  })
})
