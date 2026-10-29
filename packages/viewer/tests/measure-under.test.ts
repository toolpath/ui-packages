import {
  BoxGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Sphere,
  Vector3,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { regionEdgesGeometry } from '../src/render/edges.js'
import { edgeCorners, edgeLines, zoomedReach } from '../src/render/edge-corners.js'
import { holeIndex, surfaceCache, type Point } from '../src/render/face-measure.js'
import { SNAP_REACH } from '../src/render/measure-picks.js'
import {
  type PartAt,
  cutSampler,
  edgeSnapsFor,
  onCanvas,
  partSphere,
  underPointer,
} from '../src/render/measure-under.js'
import { buildRegionIndex } from '../src/model/region-index.js'
import type { PartModel } from '../src/model/types.js'
import { BOX_FACE, box, type TestPart } from './measure-parts.js'

/** How many times a part's edges have been found: each walks every triangle. */
const edgeWalks = vi.hoisted(() => ({ count: 0 }))
vi.mock('../src/render/edges.js', async (original) => {
  const edges = await original<typeof import('../src/render/edges.js')>()
  return {
    ...edges,
    regionEdgesGeometry: (...args: Parameters<typeof edges.regionEdgesGeometry>) => {
      edgeWalks.count += 1
      return edges.regionEdgesGeometry(...args)
    },
  }
})

/**
 * What is under the measure tool's pointer, on a 10 mm cube about the origin
 * with its top half cut away: the cut plane keeps `z < 0`, so the cut face is
 * the square at `z = 0`. The camera looks straight down, 400 px for 20 mm.
 */

const VIEWPORT = { width: 400, height: 400 }
const NO_HELD = null

/** Six regions, one per face, two triangles each, in `BoxGeometry`'s order: +x, -x, +y, -y, +z, -z. */
const cubeModel = (): PartModel => {
  const regions = Array.from({ length: 6 }, (_, idx) => ({
    idx,
    splitOrigin: idx,
    shapeKind: 'plane' as const,
    area: 100,
    triangles: { start: idx * 2, end: idx * 2 + 2 },
  }))
  return {
    partId: 'cube',
    kernelVersion: 'test',
    features: [],
    regions,
    candidateDirections: [],
    mesh: { pointCount: 36, triangleCount: 12, glbUrl: null, stlUrl: null, thumbnailUrl: null },
    regionIndex: buildRegionIndex({ regions, features: [], triangleCount: 12 }),
    warnings: [],
  } as unknown as PartModel
}

const BOTTOM = 5

/** The cube, cut, in a group `shift` mm along x: the part need not sit at the world's origin. */
const cutCube = (shift = 0): PartAt => {
  const model = cubeModel()
  const geometry = new BoxGeometry(10, 10, 10).toNonIndexed()
  const plane = new Plane(new Vector3(0, 0, -1), 0)
  const surface = new Mesh(
    geometry,
    new MeshBasicMaterial({ side: DoubleSide, clippingPlanes: [plane] }),
  )
  const group = new Group()
  group.position.x = shift
  group.add(surface)
  group.updateMatrixWorld()
  const surfaceFor = surfaceCache(model, geometry)
  return {
    model,
    geometry,
    surfaceFor,
    holes: holeIndex(model, surfaceFor),
    cut: cutSampler(geometry, model),
    surfaces: [surface],
    raycaster: new Raycaster(),
  }
}

const cameraAbove = (): OrthographicCamera => {
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100)
  camera.position.set(0, 0, 50)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

/** The pointer over the point `(x, y)` of the part, seen from above. */
const over = (x: number, y: number) => ({
  camera: cameraAbove(),
  viewport: VIEWPORT,
  pointer: { x: (x + 10) * 20, y: (10 - y) * 20 },
})

/** A camera above, in front and to the right, so the cut face and two sides show. */
const cameraTilted = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(45, 1, 0.1, 200)
  camera.position.set(20, -30, 40)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

/** The pointer a few pixels off the world point `(x, y, z)`, seen by the tilted camera. */
const near = (x: number, y: number, z: number) => {
  const camera = cameraTilted()
  const at = onCanvas([x, y, z], new Matrix4(), camera, VIEWPORT)
  return { camera, viewport: VIEWPORT, pointer: { x: at.x + 6, y: at.y - 6 } }
}

const withAlt = { reach: SNAP_REACH, heldLine: NO_HELD }

describe('underPointer on a cut part', () => {
  it('does not offer the face behind the cut face', () => {
    const found = underPointer(cutCube(), over(1, 2), null)
    expect(found?.under.on?.face.region).not.toBe(BOTTOM)
  })

  it('keeps a plain pointer on the cut face on the part, on no face', () => {
    const found = underPointer(cutCube(), over(1, 2), null)
    expect(found).not.toBeNull()
    expect(found?.under.on).toBeNull()
    // Where a double click aims the orbit: on the cut face, in world space.
    expect(found?.at?.toArray().map((value) => Number(value.toFixed(6)))).toEqual([1, 2, 0])
  })

  it('puts an Alt point on the cut face', () => {
    const snap = underPointer(cutCube(), over(1, 2), withAlt)?.under.snap
    expect(snap?.kind).toBe('face')
    expect(snap?.point[0]).toBeCloseTo(1, 6)
    expect(snap?.point[1]).toBeCloseTo(2, 6)
    expect(snap?.point[2]).toBeCloseTo(0, 6)
  })

  it('snaps an Alt point to a corner of the cut face', () => {
    const snap = underPointer(cutCube(), near(5, -5, 0), withAlt)?.under.snap
    expect(snap?.kind).toBe('vertex')
    expect(snap?.point[0]).toBeCloseTo(5, 6)
    expect(snap?.point[1]).toBeCloseTo(-5, 6)
    expect(snap?.point[2]).toBeCloseTo(0, 6)
  })

  it('does not offer a corner the cut face hides', () => {
    const snap = underPointer(cutCube(), near(-5, 5, -5), withAlt)?.under.snap
    expect(snap?.point).not.toEqual([-5, 5, -5])
  })
})

describe('underPointer on a part away from the origin', () => {
  const SHIFT = 3

  it('gives a face picked in mesh space, and where the ray met it in world space', () => {
    const found = underPointer(cutCube(SHIFT), near(SHIFT + 5, 1, -2), null)
    expect(found?.under.on?.face.point[0]).toBeCloseTo(5, 6)
    expect(found?.at?.x).toBeCloseTo(SHIFT + 5, 6)
  })

  it('gives an Alt point on the cut face in mesh space', () => {
    const snap = underPointer(cutCube(SHIFT), over(SHIFT + 1, 2), withAlt)?.under.snap
    expect(snap?.point[0]).toBeCloseTo(1, 6)
    expect(snap?.point[1]).toBeCloseTo(2, 6)
  })

  it('snaps an Alt point to a corner in mesh space', () => {
    const snap = underPointer(cutCube(SHIFT), near(SHIFT + 5, -5, 0), withAlt)?.under.snap
    expect(snap?.kind).toBe('vertex')
    expect(snap?.point[0]).toBeCloseTo(5, 6)
  })

  it('gives an edge in mesh space', () => {
    const snap = underPointer(cutCube(SHIFT), near(SHIFT + 5, 0, -5), withAlt)?.under.snap
    expect(snap?.edge?.every(([x]) => Math.abs(x - 5) < 1e-6)).toBe(true)
  })
})

/** A camera on +Z looking at the origin, `distance` away. */
const cameraAt = (distance: number): PerspectiveCamera => {
  const camera = new PerspectiveCamera(45, 1, 0.1, 100_000)
  camera.position.set(0, 0, distance)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return camera
}

/** What `underPointer` needs, for a part drawn as one mesh at the origin, uncut. */
const partAt = ({ model, geometry }: TestPart): PartAt => {
  const surfaceFor = surfaceCache(model, geometry)
  const surface = new Mesh(geometry, new MeshBasicMaterial())
  surface.updateMatrixWorld()
  return {
    model,
    geometry,
    surfaceFor,
    holes: holeIndex(model, surfaceFor),
    cut: cutSampler(geometry, model),
    surfaces: [surface],
    raycaster: new Raycaster(),
  }
}

const apart = (point: Point, to: [number, number, number]): number =>
  new Vector3(...point).distanceTo(new Vector3(...to))

describe('the part’s edges', () => {
  const { model, geometry } = box(20, 10, 6)
  const positions = regionEdgesGeometry(geometry, model).getAttribute('position').array

  it('are a box’s 8 corners and the middles of its 12 edges', () => {
    const corners = edgeCorners(positions)
    expect(corners.filter((corner) => corner.kind === 'vertex')).toHaveLength(8)
    const middles = corners.filter((corner) => corner.kind === 'midpoint')
    expect(middles).toHaveLength(12)
    expect(middles.map((middle) => middle.point.toArray())).toContainEqual([0, 5, 3])
  })

  it('are a box’s 12 lines, each corner to corner', () => {
    const { lines } = edgeLines(positions)
    expect(lines).toHaveLength(12)
    for (const line of lines) expect(line).toHaveLength(2)
  })

  it('are found once per part, and kept with its geometry', () => {
    const snaps = edgeSnapsFor(model, geometry)
    expect(snaps).not.toBeNull()
    expect(edgeSnapsFor(model, geometry)).toBe(snaps)
    // A new model of the same geometry (the analysis's) has regions of its own.
    expect(edgeSnapsFor({ ...model }, geometry)).not.toBe(snaps)
  })

  it('are found only once a point is snapped, and once for a part', () => {
    const part = partAt(box(20, 10, 6))
    const screen = { camera: cameraAt(50), viewport: VIEWPORT, pointer: { x: 200, y: 200 } }
    const before = edgeWalks.count
    expect(underPointer(part, screen, null)?.under.on?.face.region).toBe(BOX_FACE.pz)
    expect(edgeWalks.count).toBe(before)
    underPointer(part, screen, withAlt)
    underPointer(part, screen, withAlt)
    expect(edgeWalks.count).toBe(before + 1)
  })
})

describe('the snap reach', () => {
  const sphere = new Sphere(new Vector3(), 10)

  it('is as written with the part 400 pixels across', () => {
    // Where a 45° view 400 pixels high shows the sphere's diameter in all of it.
    const camera = cameraAt(10 / Math.tan(Math.PI / 8))
    const reach = zoomedReach(SNAP_REACH, sphere, camera, VIEWPORT)
    expect(reach.vertex).toBeCloseTo(SNAP_REACH.vertex, 6)
    expect(reach.edge).toBeCloseTo(SNAP_REACH.edge, 6)
  })

  it('grows no further than twice, zoomed right in', () => {
    expect(zoomedReach(SNAP_REACH, sphere, cameraAt(11), VIEWPORT)).toEqual({
      vertex: SNAP_REACH.vertex * 2,
      midpoint: SNAP_REACH.midpoint * 2,
      edge: SNAP_REACH.edge * 2,
    })
  })

  it('shrinks no further than half, zoomed right out', () => {
    expect(zoomedReach(SNAP_REACH, sphere, cameraAt(10_000), VIEWPORT)).toEqual({
      vertex: SNAP_REACH.vertex / 2,
      midpoint: SNAP_REACH.midpoint / 2,
      edge: SNAP_REACH.edge / 2,
    })
  })
})

describe('underPointer on a whole part', () => {
  const part = partAt(box(20, 10, 6))
  const camera = cameraAt(50)
  const screen = (pointer: { x: number; y: number }) => ({ camera, viewport: VIEWPORT, pointer })
  const atCorner = (point: Point) => onCanvas(point, new Matrix4(), camera, VIEWPORT)

  it('finds the face the pointer is on, with a real ray', () => {
    const found = underPointer(part, screen({ x: 200, y: 200 }), null)
    expect(found?.under.on?.face.region).toBe(BOX_FACE.pz)
    expect(found?.under.on?.surface.kind).toBe('plane')
    expect(apart(found?.under.on?.face.point ?? [9, 9, 9], [0, 0, 3])).toBeLessThan(1e-6)
    expect(found?.under.snap).toBeNull()
  })

  it('finds nothing off the part', () => {
    expect(underPointer(part, screen({ x: 5, y: 5 }), null)).toBeNull()
  })

  it('snaps an Alt point to a corner in reach', () => {
    const corner = atCorner([10, 5, 3])
    const found = underPointer(part, screen({ x: corner.x - 6, y: corner.y + 6 }), withAlt)
    expect(found?.under.snap?.kind).toBe('vertex')
    expect(apart(found?.under.snap?.point ?? [0, 0, 0], [10, 5, 3])).toBeLessThan(1e-6)
  })

  it('does not offer a corner round the back, which the part hides', () => {
    const back = atCorner([10, 5, -3])
    const found = underPointer(part, screen({ x: back.x, y: back.y }), withAlt)
    expect(found?.under.snap?.kind).toBe('vertex')
    expect(apart(found?.under.snap?.point ?? [0, 0, 0], [10, 5, 3])).toBeLessThan(1e-6)
  })

  it('puts an Alt point on the face where no corner or edge is in reach', () => {
    const found = underPointer(part, screen({ x: 200, y: 200 }), withAlt)
    expect(found?.under.snap?.kind).toBe('face')
  })

  it('measures the part’s size on screen from its bounding sphere', () => {
    const sphere = partSphere(box(20, 10, 6).geometry, part.surfaces)
    expect(sphere.radius).toBeCloseTo(Math.hypot(10, 5, 3), 6)
  })
})
