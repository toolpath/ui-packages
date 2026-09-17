import {
  BoxGeometry,
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
import {
  POINTS_PER_MEASUREMENT,
  SNAP_PIXELS,
  angleArc,
  angleAt,
  deltaLegs,
  distanceBetween,
  formatDegrees,
  formatMillimetres,
  lockToAxis,
  measurementFromPoints,
  measurementLabel,
  measurementLabelAnchor,
  nextMeasurementId,
  screenPoint,
  snapAt,
} from '../src/render/measure.js'
import { hitUnderRay } from '../src/render/section.js'

const VIEWPORT = { width: 800, height: 600 }

/**
 * A camera looking straight down onto the XY plane, framing 100 mm of height.
 * Orthographic, so a millimetre is the same number of pixels everywhere and
 * the pixel arithmetic below can be done in the head: 600 px over 100 mm is
 * 6 px per mm.
 */
const topDown = () => {
  const camera = new OrthographicCamera(-800 / 12, 800 / 12, 50, -50, 0.1, 1000)
  camera.position.set(0, 0, 100)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

/** The four edges of a 20 mm square in the plane `z = 0`, centred on the origin. */
const square = (matrixWorld = new Matrix4()) => ({
  positions: new Float32Array([
    -10, -10, 0, 10, -10, 0, 10, -10, 0, 10, 10, 0, 10, 10, 0, -10, 10, 0, -10, 10, 0, -10, -10, 0,
  ]),
  matrixWorld,
})

const up = new Vector3(0, 0, 1)

describe('screenPoint', () => {
  it('puts the origin in the middle of the canvas and scales by the frustum', () => {
    const camera = topDown()
    const centre = screenPoint(camera, new Vector3(0, 0, 0), VIEWPORT)
    expect(centre.x).toBeCloseTo(400, 6)
    expect(centre.y).toBeCloseTo(300, 6)
    // +Y is up on screen, so it is a smaller pixel row.
    const above = screenPoint(camera, new Vector3(0, 10, 0), VIEWPORT)
    expect(above.y).toBeCloseTo(240, 6)
  })
})

describe('snapAt', () => {
  it('snaps to a corner from within its reach, and reports no edge for it', () => {
    const camera = topDown()
    // 1 mm inside the corner: 6 px diagonally, well within `SNAP_PIXELS.vertex`.
    const hit = { point: new Vector3(9, 9, 0), normal: up }
    const snap = snapAt(hit, square(), camera, VIEWPORT)
    expect(snap.kind).toBe('vertex')
    expect(snap.point.x).toBeCloseTo(10, 9)
    expect(snap.point.y).toBeCloseTo(10, 9)
    expect(snap.edge).toBeNull()
  })

  it('prefers the corner to the edge it ends, when both are in reach', () => {
    const camera = topDown()
    // On the bottom edge, 1.5 mm (9 px) from the corner: the edge is 0 px away
    // and the corner is 9 px away, and the corner wins.
    const hit = { point: new Vector3(8.5, -10, 0), normal: up }
    expect(snapAt(hit, square(), camera, VIEWPORT).kind).toBe('vertex')
  })

  it('snaps to the midpoint of an edge over the edge itself', () => {
    const camera = topDown()
    // Half a millimetre along from the midpoint, half a millimetre inside.
    const hit = { point: new Vector3(0.5, -9.5, 0), normal: up }
    const snap = snapAt(hit, square(), camera, VIEWPORT)
    expect(snap.kind).toBe('midpoint')
    expect(snap.point.x).toBeCloseTo(0, 9)
    expect(snap.point.y).toBeCloseTo(-10, 9)
    expect(snap.edge).not.toBeNull()
  })

  it('snaps to the nearest point on an edge, away from its ends and middle', () => {
    const camera = topDown()
    // 1 mm inside the bottom edge, 5 mm along from the midpoint — 30 px from
    // the midpoint and 30 px from the corner, and 6 px from the edge.
    const hit = { point: new Vector3(5, -9, 0), normal: up }
    const snap = snapAt(hit, square(), camera, VIEWPORT)
    expect(snap.kind).toBe('edge')
    expect(snap.point.x).toBeCloseTo(5, 9)
    expect(snap.point.y).toBeCloseTo(-10, 9)
    expect(snap.edge![0].z).toBeCloseTo(0, 9)
  })

  it('stays on the face when nothing is in reach', () => {
    const camera = topDown()
    const hit = { point: new Vector3(0, 0, 0), normal: up }
    const snap = snapAt(hit, square(), camera, VIEWPORT)
    expect(snap.kind).toBe('face')
    expect(snap.point).toEqual(new Vector3(0, 0, 0))
    expect(snap.point).not.toBe(hit.point)
  })

  it('snaps to nothing with no edges to snap to', () => {
    const camera = topDown()
    const hit = { point: new Vector3(9.9, 9.9, 0), normal: up }
    expect(snapAt(hit, null, camera, VIEWPORT).kind).toBe('face')
  })

  it('ignores an edge that is within reach of the point but off its surface', () => {
    const camera = topDown()
    // The same square, dropped below the hit's plane. Looking straight down,
    // it is under the pointer to the pixel either way; what tells the two
    // apart is how far off the hit's surface it stands — within the reach it
    // is the edge of this face seen a little askew, beyond it there is a wall
    // of material in between.
    const hit = { point: new Vector3(9.9, 9.9, 0), normal: up }
    const reach = (SNAP_PIXELS.vertex / 6) * 1.5
    const near = square(new Matrix4().makeTranslation(0, 0, -reach * 0.5))
    expect(snapAt(hit, near, camera, VIEWPORT).kind).toBe('vertex')
    const far = square(new Matrix4().makeTranslation(0, 0, -reach * 1.5))
    expect(snapAt(hit, far, camera, VIEWPORT).kind).toBe('face')
  })

  it('reports snapped points in world space when the edges are transformed', () => {
    const camera = topDown()
    const shifted = square(new Matrix4().makeTranslation(5, 0, 0))
    // The corner that was at (10, 10) now stands at (15, 10).
    const hit = { point: new Vector3(14.5, 9.5, 0), normal: up }
    const snap = snapAt(hit, shifted, camera, VIEWPORT)
    expect(snap.kind).toBe('vertex')
    expect(snap.point.x).toBeCloseTo(15, 9)
    expect(snap.point.y).toBeCloseTo(10, 9)
  })

  it('judges reach in pixels, so a perspective camera further away reaches further', () => {
    const camera = new PerspectiveCamera(30, 800 / 600, 0.1, 1000)
    camera.position.set(0, 0, 400)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    // At 400 mm the frustum is ~214 mm tall over 600 px — 2.8 px per mm — so
    // 3 mm inside the corner is about 12 px and snaps; at 100 mm it is 45 px
    // and does not.
    const hit = { point: new Vector3(7, 7, 0), normal: up }
    expect(snapAt(hit, square(), camera, VIEWPORT).kind).toBe('vertex')
    camera.position.set(0, 0, 100)
    camera.updateMatrixWorld(true)
    expect(snapAt(hit, square(), camera, VIEWPORT).kind).toBe('face')
  })
})

describe('hitUnderRay', () => {
  it('skips a surface a clipping plane has taken away', () => {
    const scene = new Group()
    const material = new MeshBasicMaterial()
    const part = new Mesh(new BoxGeometry(10, 10, 10), material)
    scene.add(part)
    scene.updateMatrixWorld(true)

    const raycaster = new Raycaster()
    raycaster.set(new Vector3(0, 0, 50), new Vector3(0, 0, -1))
    expect(hitUnderRay(raycaster, scene)!.point.z).toBeCloseTo(5, 9)

    // Keeps z < 0: the top face is gone. The far wall is a back face, which a
    // single-sided material's ray does not see either, so there is nothing
    // left under the pointer — which is what the eye sees too.
    material.clippingPlanes = [new Plane(new Vector3(0, 0, -1), 0)]
    expect(hitUnderRay(raycaster, scene)).toBeNull()

    // A plane that keeps z > -1 leaves the top face standing.
    material.clippingPlanes = [new Plane(new Vector3(0, 0, 1), 1)]
    expect(hitUnderRay(raycaster, scene)!.point.z).toBeCloseTo(5, 9)
  })
})

describe('measurementFromPoints', () => {
  it('waits for every point a kind needs', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 3, y: 4, z: 0 }
    expect(POINTS_PER_MEASUREMENT.distance).toBe(2)
    expect(POINTS_PER_MEASUREMENT.angle).toBe(3)
    expect(measurementFromPoints('distance', [a], 1)).toBeNull()
    expect(measurementFromPoints('distance', [a, b], 1)).toEqual({
      id: 1,
      kind: 'distance',
      points: [a, b],
    })
    expect(measurementFromPoints('angle', [a, b], 1)).toBeNull()
    expect(measurementFromPoints('angle', [a, b, a], 2)?.kind).toBe('angle')
  })

  it('copies the points rather than holding the caller’s', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 1, y: 0, z: 0 }
    const built = measurementFromPoints('distance', [a, b], 1)!
    expect(built.points[0]).not.toBe(a)
    expect(built.points[0]).toEqual(a)
  })
})

describe('nextMeasurementId', () => {
  it('starts at one and steps past the highest held', () => {
    expect(nextMeasurementId([])).toBe(1)
    const one = measurementFromPoints(
      'distance',
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      7,
    )!
    expect(nextMeasurementId([one])).toBe(8)
  })
})

describe('the readouts', () => {
  const origin = { x: 0, y: 0, z: 0 }

  it('measure a distance and write it in millimetres', () => {
    expect(distanceBetween(origin, { x: 3, y: 4, z: 12 })).toBe(13)
    expect(formatMillimetres(13)).toBe('13.00 mm')
    expect(formatMillimetres(2.345, 1)).toBe('2.3 mm')
  })

  it('measure an angle at the vertex, in degrees, from 0 to 180', () => {
    expect(angleAt(origin, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90, 9)
    expect(angleAt(origin, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBeCloseTo(180, 9)
    expect(angleAt(origin, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 })).toBeCloseTo(45, 9)
    // An arm with no length has no direction.
    expect(angleAt(origin, origin, { x: 1, y: 0, z: 0 })).toBe(0)
    expect(formatDegrees(90)).toBe('90.0°')
  })

  it('label a measurement by its kind, through the caller’s formatter', () => {
    const distance = measurementFromPoints('distance', [origin, { x: 0, y: 0, z: 25.4 }], 1)!
    expect(measurementLabel(distance)).toBe('25.40 mm')
    expect(measurementLabel(distance, (mm) => `${mm} millimetres`)).toBe('25.4 millimetres')
    const angle = measurementFromPoints(
      'angle',
      [{ x: 1, y: 0, z: 0 }, origin, { x: 0, y: 1, z: 0 }],
      2,
    )!
    expect(measurementLabel(angle)).toBe('90.0°')
  })

  it('anchor a distance’s label at its middle and an angle’s off its vertex, inside the arms', () => {
    const distance = measurementFromPoints('distance', [origin, { x: 10, y: 0, z: 0 }], 1)!
    expect(measurementLabelAnchor(distance)).toEqual({ x: 5, y: 0, z: 0 })
    const angle = measurementFromPoints(
      'angle',
      [{ x: 10, y: 0, z: 0 }, origin, { x: 0, y: 10, z: 0 }],
      2,
    )!
    const anchor = measurementLabelAnchor(angle)
    expect(anchor.x).toBeGreaterThan(0)
    expect(anchor.y).toBeGreaterThan(0)
    expect(anchor.x).toBeCloseTo(anchor.y, 9)
  })
})

describe('lockToAxis', () => {
  it('holds the point to the axis it has moved furthest along', () => {
    const from = { x: 1, y: 2, z: 3 }
    expect(lockToAxis(from, { x: 11, y: 4, z: 5 })).toEqual({
      axis: 'x',
      point: { x: 11, y: 2, z: 3 },
    })
    expect(lockToAxis(from, { x: 3, y: -9, z: 5 })).toEqual({
      axis: 'y',
      point: { x: 1, y: -9, z: 3 },
    })
    expect(lockToAxis(from, { x: 3, y: 4, z: 30 })).toEqual({
      axis: 'z',
      point: { x: 1, y: 2, z: 30 },
    })
  })

  it('leaves a point that has not moved where it is', () => {
    const from = { x: 1, y: 2, z: 3 }
    expect(lockToAxis(from, from)).toEqual({ axis: 'x', point: from })
  })

  it('produces a distance with no delta legs to draw', () => {
    const from = { x: 0, y: 0, z: 0 }
    const { point } = lockToAxis(from, { x: 3, y: 4, z: 12 })
    expect(deltaLegs(from, point)).toEqual([])
  })
})

describe('deltaLegs', () => {
  it('walks from a to b one axis at a time, in X, Y, Z order', () => {
    const legs = deltaLegs({ x: 0, y: 0, z: 0 }, { x: 3, y: -4, z: 5 })
    expect(legs.map((leg) => leg.axis)).toEqual(['x', 'y', 'z'])
    expect(legs[0]!.from).toEqual({ x: 0, y: 0, z: 0 })
    expect(legs[0]!.to).toEqual({ x: 3, y: 0, z: 0 })
    expect(legs[1]!.to).toEqual({ x: 3, y: -4, z: 0 })
    expect(legs[2]!.to).toEqual({ x: 3, y: -4, z: 5 })
    expect(legs.map((leg) => leg.length)).toEqual([3, 4, 5])
  })

  it('leaves out a leg with no length', () => {
    const legs = deltaLegs({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 5 })
    expect(legs.map((leg) => leg.axis)).toEqual(['x', 'z'])
  })

  it('draws nothing for a distance that already runs along an axis', () => {
    expect(deltaLegs({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 })).toEqual([])
    expect(deltaLegs({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 })).toEqual([])
  })
})

describe('angleArc', () => {
  const origin = { x: 0, y: 0, z: 0 }

  it('runs from the first arm round to the second at the given radius', () => {
    const arc = angleArc(origin, { x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, 2, 8)
    expect(arc).toHaveLength(9)
    expect(arc[0]!.x).toBeCloseTo(2, 9)
    expect(arc[0]!.y).toBeCloseTo(0, 9)
    expect(arc[8]!.x).toBeCloseTo(0, 9)
    expect(arc[8]!.y).toBeCloseTo(2, 9)
    for (const point of arc) expect(point.length()).toBeCloseTo(2, 9)
  })

  it('has only its two ends when the arms are parallel', () => {
    expect(angleArc(origin, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 1)).toHaveLength(2)
    expect(angleArc(origin, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 1)).toHaveLength(2)
  })

  it('has nothing to draw for an arm with no length', () => {
    expect(angleArc(origin, origin, { x: 1, y: 0, z: 0 }, 1)).toEqual([])
  })
})
