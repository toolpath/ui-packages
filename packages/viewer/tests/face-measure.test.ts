import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  groupReadout,
  holeIndex,
  surfaceCache,
  type MeasuredFace,
  type Point,
} from '../src/render/face-measure.js'
import { BOX_FACE, box, DRILLED_FACE, drilledCylinder, manyFaces, mm } from './measure-parts.js'

const face = (region: number, point: Point): MeasuredFace => ({ kind: 'face', region, point })

const labels = (readout: { labels: Array<{ text: string }> }): Array<string> =>
  readout.labels.map((label) => label.text)

describe('face measuring on a box', () => {
  const { model, geometry } = box(20, 10, 6)
  const surfaceFor = surfaceCache(model, geometry)

  it('reads each side as a plane, facing out', () => {
    const side = surfaceFor(BOX_FACE.px)
    expect(side.kind).toBe('plane')
    if (side.kind !== 'plane') return
    expect(side.normal.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-6)
    expect(side.centroid.distanceTo(new Vector3(10, 0, 0))).toBeLessThan(1e-6)
  })

  it('remembers a face it has read', () => {
    expect(surfaceFor(BOX_FACE.pz)).toBe(surfaceFor(BOX_FACE.pz))
  })

  it('reads two parallel sides as the gap between their planes', () => {
    const readout = groupReadout(
      [face(BOX_FACE.px, [10, 1, 1]), face(BOX_FACE.nx, [-10, -2, 0])],
      surfaceFor,
      mm,
    )
    expect(labels(readout)).toEqual(['20.000 · parallel'])
    // Square across from the first click.
    expect(readout.lines[0]?.points.map((point) => point.toArray())).toEqual([
      [10, 1, 1],
      [-10, 1, 1],
    ])
  })

  it('reads two sides that meet as the angle between them', () => {
    const readout = groupReadout(
      [face(BOX_FACE.px, [10, 0, 1]), face(BOX_FACE.pz, [5, 0, 3])],
      surfaceFor,
      mm,
    )
    expect(labels(readout)).toEqual([expect.stringMatching(/^Angle 90(\.0+)?°$/)])
  })

  it('says nothing of one plane by itself', () => {
    expect(labels(groupReadout([face(BOX_FACE.py, [0, 5, 0])], surfaceFor, mm))).toEqual([])
  })

  it('finds no holes', () => {
    const holes = holeIndex(model, surfaceFor)
    expect(holes.holeOf(BOX_FACE.px)).toBeNull()
    expect(holes.faceOf(BOX_FACE.px)).toBe(BOX_FACE.px)
  })
})

describe('face measuring on a drilled cylinder', () => {
  const { model, geometry } = drilledCylinder(10, 3, 10)
  const surfaceFor = surfaceCache(model, geometry)
  const holes = holeIndex(model, surfaceFor)

  it('reads each half of the hole as half a cylinder on the axis', () => {
    const half = surfaceFor(DRILLED_FACE.holeA)
    expect(half.kind).toBe('cylinder')
    if (half.kind !== 'cylinder') return
    expect(half.radius).toBeCloseTo(3, 6)
    expect(Math.abs(half.axis.y)).toBeCloseTo(1, 6)
    expect(half.sweep).toBeCloseTo(180, 0)
    expect(half.to - half.from).toBeCloseTo(10, 6)
  })

  it('takes the two halves together as one hole, named by the first', () => {
    const hole = holes.holeOf(DRILLED_FACE.holeB)
    expect(hole?.faces).toEqual([DRILLED_FACE.holeA, DRILLED_FACE.holeB])
    expect(hole?.sweep).toBeCloseTo(360, 0)
    expect(holes.faceOf(DRILLED_FACE.holeB)).toBe(DRILLED_FACE.holeA)
    expect(holes.holeOf(DRILLED_FACE.top)).toBeNull()
  })

  it('reads the hole by its diameter and depth', () => {
    const readout = groupReadout([face(DRILLED_FACE.holeA, [0, 4, 3])], surfaceFor, mm, holes)
    expect(labels(readout)).toEqual(['⌀ 6.000  ↧ 10.000'])
  })

  it('reads the outside as a round of its own size', () => {
    const readout = groupReadout([face(DRILLED_FACE.wall, [10, 0, 0])], surfaceFor, mm, holes)
    expect(labels(readout)).toEqual(['⌀ 20.000  ↧ 10.000'])
  })

  it('reads the two ends as the bar’s length', () => {
    const readout = groupReadout(
      [face(DRILLED_FACE.top, [5, 5, 0]), face(DRILLED_FACE.bottom, [5, -5, 0])],
      surfaceFor,
      mm,
    )
    expect(labels(readout)).toEqual(['10.000 · parallel'])
  })
})

describe('face measuring on a part of many faces', () => {
  it('reads the region table about once for each face, not once for each pair', () => {
    const FACES = 400
    const { model, geometry } = manyFaces(FACES)
    let visits = 0
    const regions = new Proxy(model.regions, {
      get: (target, key, receiver) => {
        if (typeof key === 'string' && /^\d+$/.test(key)) visits += 1
        return Reflect.get(target, key, receiver) as unknown
      },
    })
    const counted = { ...model, regions }
    const holes = holeIndex(counted, surfaceCache(counted, geometry))

    expect(holes.faceOf(FACES - 1)).toBe(FACES - 1)
    expect(holes.holeOf(0)).toBeNull()
    expect(visits).toBeLessThanOrEqual(4 * FACES)
  })
})
