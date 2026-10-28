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
  Vector3,
} from 'three'
import { describe, expect, it } from 'vitest'
import { regionEdgesGeometry } from '../src/render/edges.js'
import { holeIndex, surfaceCache } from '../src/render/face-measure.js'
import { SNAP_REACH } from '../src/render/measure-picks.js'
import {
  type PartAt,
  cutSampler,
  edgeSnaps,
  onCanvas,
  underPointer,
} from '../src/render/measure-under.js'
import { buildRegionIndex } from '../src/model/region-index.js'
import type { PartModel } from '../src/model/types.js'

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
  const edges = regionEdgesGeometry(geometry, model).getAttribute('position').array
  const surfaceFor = surfaceCache(model, geometry)
  return {
    model,
    surfaceFor,
    holes: holeIndex(model, surfaceFor),
    snaps: edgeSnaps(edges),
    cut: cutSampler(geometry, model, edges),
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

  it('gives a face picked in mesh space', () => {
    const point = underPointer(cutCube(SHIFT), near(SHIFT + 5, 1, -2), null)?.under.on?.face.point
    expect(point?.[0]).toBeCloseTo(5, 6)
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
