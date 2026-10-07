import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  TOOL_CORNER_STEPS,
  TOOL_ROUND,
  toolMarkShape,
  toolProfile,
} from '../src/render/tool-marks.js'

const mark = { base: { x: 1, y: 2, z: 3 }, axis: { x: 0, y: 0, z: 1 }, diameter: 6, height: 10 }

describe('toolProfile', () => {
  it('draws a flat end mill as its bottom and its side', () => {
    expect(toolProfile(3, 0, 10).map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [3, 0],
      [3, 10],
    ])
  })

  it('rounds a bull nose corner from its flat to its side', () => {
    const profile = toolProfile(3, 1, 10)
    expect(profile).toHaveLength(TOOL_CORNER_STEPS + 3)
    expect(profile[1]?.toArray()).toEqual([2, 0])
    expect(profile[TOOL_CORNER_STEPS + 1]?.x).toBeCloseTo(3)
    expect(profile[TOOL_CORNER_STEPS + 1]?.y).toBeCloseTo(1)
  })

  it('makes a ball of a corner as round as the tool, and no rounder', () => {
    const ball = toolProfile(3, 9, 10)
    expect(ball[1]?.toArray()).toEqual([0, 0])
    expect(ball.at(-1)?.toArray()).toEqual([3, 10])
  })
})

describe('toolMarkShape', () => {
  it('stands the tool on its base, up its axis, with a dimension the width of the tool across its top', () => {
    const shape = toolMarkShape(mark)
    expect(shape?.base.toArray()).toEqual([1, 2, 3])
    expect(new Vector3(0, 1, 0).applyQuaternion(shape!.turn).toArray().map(Math.round)).toEqual([
      0, 0, 1,
    ])
    const [a, b] = shape!.dimension
    expect(a.distanceTo(b)).toBeCloseTo(6)
    expect(a.z).toBeCloseTo(13)
    expect(shape!.labelAt.toArray()).toEqual([1, 2, 13])
  })

  it('runs the dimension the way asked, made square to the axis', () => {
    const shape = toolMarkShape({ ...mark, across: { x: 0, y: 1, z: 5 } })
    const [a, b] = shape!.dimension
    expect(
      a
        .clone()
        .sub(b)
        .normalize()
        .toArray()
        .map((n) => Math.round(n * 1e6) / 1e6),
    ).toEqual([0, 1, 0])
  })

  it('rims the bottom inside the corner and the top, and a ball only at the top', () => {
    const bull = toolMarkShape({ ...mark, cornerRadius: 1 })!
    expect(bull.rims).toHaveLength(2)
    expect(bull.rims[0]).toHaveLength(TOOL_ROUND + 1)
    expect(bull.rims[0]![0]!.distanceTo(bull.base)).toBeCloseTo(2)
    expect(toolMarkShape({ ...mark, cornerRadius: 3 })!.rims).toHaveLength(1)
  })

  it('draws nothing for a tool with no width or no axis', () => {
    expect(toolMarkShape({ ...mark, diameter: 0 })).toBeNull()
    expect(toolMarkShape({ ...mark, axis: { x: 0, y: 0, z: 0 } })).toBeNull()
  })
})
