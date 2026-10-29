import { describe, expect, it } from 'vitest'
import {
  clickPick,
  dropLastPick,
  measureReadout,
  pairsOn,
  type MeasureGroup,
  type MeasurePick,
} from '../src/render/measure-picks.js'
import { holeIndex, surfaceCache, type Point } from '../src/render/face-measure.js'
import { BOX_FACE, box, DRILLED_FACE, drilledCylinder, mm } from './measure-parts.js'

const point = (at: Point): MeasurePick => ({ kind: 'point', point: at })
const face = (region: number, at: Point = [0, 0, 0]): MeasurePick => ({
  kind: 'face',
  region,
  point: at,
})

const boxPart = box(20, 10, 6)
const boxSurfaces = surfaceCache(boxPart.model, boxPart.geometry)
const boxPairs = pairsOn(boxSurfaces)

describe('a click while measuring', () => {
  it('pairs a second pick with the first where the two make a dimension', () => {
    const first = clickPick([], point([0, 0, 0]), false, boxPairs)
    expect(clickPick(first, point([1, 0, 0]), false, boxPairs)).toEqual([
      [point([0, 0, 0]), point([1, 0, 0])],
    ])
  })

  it('starts afresh past a pair, and drops what was on screen without Shift', () => {
    const pair: readonly MeasureGroup[] = [[point([0, 0, 0]), point([1, 0, 0])]]
    expect(clickPick(pair, point([2, 0, 0]), false, boxPairs)).toEqual([[point([2, 0, 0])]])
  })

  it('keeps what was on screen with Shift', () => {
    const pair: readonly MeasureGroup[] = [[point([0, 0, 0]), point([1, 0, 0])]]
    expect(clickPick(pair, point([2, 0, 0]), true, boxPairs)).toEqual([...pair, [point([2, 0, 0])]])
  })

  it('drops a face already held, and its measurement with it when it was alone', () => {
    const groups: readonly MeasureGroup[] = [
      [face(BOX_FACE.px)],
      [face(BOX_FACE.nx), face(BOX_FACE.px)],
    ]
    expect(clickPick(groups, face(BOX_FACE.px, [10, 1, 1]), true, boxPairs)).toEqual([
      [face(BOX_FACE.nx)],
    ])
  })

  it('takes the last pick back with Delete, and the measurement once it is empty', () => {
    const groups: readonly MeasureGroup[] = [
      [point([0, 0, 0])],
      [point([1, 0, 0]), point([2, 0, 0])],
    ]
    const once = dropLastPick(groups)
    expect(once).toEqual([[point([0, 0, 0])], [point([1, 0, 0])]])
    expect(dropLastPick(once)).toEqual([[point([0, 0, 0])]])
    expect(dropLastPick([])).toEqual([])
  })
})

describe('which picks pair', () => {
  const drilled = drilledCylinder(10, 3, 10)
  const drilledSurfaces = surfaceCache(drilled.model, drilled.geometry)
  const drilledPairs = pairsOn(drilledSurfaces)

  it('points with points and planes, and planes with planes', () => {
    expect(boxPairs(point([0, 0, 0]), point([1, 1, 1]))).toBe(true)
    expect(boxPairs(point([0, 0, 0]), face(BOX_FACE.px))).toBe(true)
    expect(boxPairs(face(BOX_FACE.px), face(BOX_FACE.nx))).toBe(true)
  })

  it('a hole with no plane its axis is square to', () => {
    expect(drilledPairs(face(DRILLED_FACE.holeA), face(DRILLED_FACE.top))).toBe(false)
    expect(drilledPairs(face(DRILLED_FACE.holeA), point([0, 0, 0]))).toBe(false)
  })
})

describe('what a measurement reads', () => {
  it('reads two points as their distance, with its legs', () => {
    const readout = measureReadout(
      [point([0, 0, 0]), point([3, 4, 0])],
      boxSurfaces,
      holeIndex(boxPart.model, boxSurfaces),
      mm,
    )
    expect(readout.labels.map((label) => label.text)).toEqual(['5.000', 'X 3.000', 'Y 4.000'])
    expect(readout.markers).toHaveLength(2)
  })

  it('reads a point and a plane as the distance square to it', () => {
    const readout = measureReadout(
      [point([4, 1, 2]), face(BOX_FACE.nx, [-10, 0, 0])],
      boxSurfaces,
      holeIndex(boxPart.model, boxSurfaces),
      mm,
    )
    expect(readout.labels.map((label) => label.text)).toEqual(['⟂ 14.000'])
  })
})
