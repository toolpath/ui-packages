import { describe, expect, it } from 'vitest'
import {
  directionIndexOf,
  directionLabel,
  groupByDirection,
  nearestDirection,
} from '../src/model/directions.js'
import type { Vec3 } from '../src/model/types.js'
import { cubeModel } from './fixtures.js'

describe('groupByDirection', () => {
  it("groups the cube's features in candidateDirections order", () => {
    const model = cubeModel()
    const groups = groupByDirection(model)

    expect(groups.map((group) => group.direction)).toEqual([...model.candidateDirections])
    // Six per direction: one face, one profile, four walls.
    expect(groups.map((group) => group.features.length)).toEqual([6, 6, 6, 6])
    expect(groups.flatMap((group) => group.features)).toHaveLength(24)
  })

  it('keeps a direction that no feature uses', () => {
    const model = cubeModel()
    const extra = { x: 1, y: 0, z: 0 }
    const groups = groupByDirection({
      ...model,
      candidateDirections: [...model.candidateDirections, extra],
    })

    // A setup with no features is still a setup the part can be held in, so it
    // stays in the list rather than vanishing from the panel.
    expect(groups).toHaveLength(5)
    expect(groups.at(-1)?.features).toEqual([])
  })

  /**
   * Every observed feature's direction is one of `candidateDirections` — 1122
   * of them across three parts, no exceptions — so this bucket is defensive.
   * What it must not do is drop the features silently.
   */
  it('collects features whose direction is not a candidate', () => {
    const model = cubeModel()
    const groups = groupByDirection({ ...model, candidateDirections: [{ x: 0, y: 0, z: 1 }] })

    expect(groups).toHaveLength(2)
    expect(groups[0]?.features).toHaveLength(6)
    expect(groups[1]?.index).toBe(-1)
    expect(groups[1]?.features).toHaveLength(18)
  })
})

describe('directionIndexOf', () => {
  it('finds a direction, and reports -1 for one that is absent', () => {
    const model = cubeModel()

    expect(directionIndexOf(model, { x: 0, y: 0, z: -1 })).toBe(1)
    expect(directionIndexOf(model, { x: 1, y: 0, z: 0 })).toBe(-1)
  })

  it('tolerates float drift rather than requiring bit equality', () => {
    const model = cubeModel()

    expect(directionIndexOf(model, { x: 0, y: 0, z: 1 - 1e-9 })).toBe(0)
  })
})

describe('nearestDirection', () => {
  it('matches an exact axis', () => {
    expect(nearestDirection(cubeModel(), { x: 0, y: 0, z: -1 })).toBe(1)
  })

  /**
   * A setup axis comes out of a rotated work coordinate system, not out of the
   * report, so it is a fraction of a degree off the candidate it means — far
   * outside `sameDirection`'s epsilon.
   */
  it('matches an axis a fraction of a degree off, which directionIndexOf misses', () => {
    const model = cubeModel()
    const tilt = (0.3 * Math.PI) / 180
    const axis: Vec3 = { x: Math.sin(tilt), y: 0, z: Math.cos(tilt) }

    expect(directionIndexOf(model, axis)).toBe(-1)
    expect(nearestDirection(model, axis)).toBe(0)
  })

  it('does not snap an axis outside the tolerance', () => {
    const model = cubeModel()
    const tilt = (5 * Math.PI) / 180
    const axis: Vec3 = { x: Math.sin(tilt), y: 0, z: Math.cos(tilt) }

    expect(nearestDirection(model, axis)).toBe(-1)
    expect(nearestDirection(model, axis, 10)).toBe(0)
  })

  it('accepts an axis that is not unit length', () => {
    expect(nearestDirection(cubeModel(), { x: 0, y: 0, z: 3 })).toBe(0)
  })

  it('matches nothing for a zero-length axis', () => {
    expect(nearestDirection(cubeModel(), { x: 0, y: 0, z: 0 })).toBe(-1)
  })

  it('picks the closer of two candidates inside the tolerance', () => {
    const near: Vec3 = { x: Math.sin(0.001), y: 0, z: Math.cos(0.001) }
    const model = { candidateDirections: [near, { x: 0, y: 0, z: 1 }] }

    expect(nearestDirection(model, { x: 0, y: 0, z: 1 })).toBe(1)
  })
})

describe('directionLabel', () => {
  it('names an axis', () => {
    expect(directionLabel({ x: 0, y: 0, z: 1 })).toBe('+Z')
    expect(directionLabel({ x: 0, y: -1, z: 0 })).toBe('−Y')
    expect(directionLabel({ x: 1, y: 0, z: 0 })).toBe('+X')
  })

  /**
   * Real parts return tilted directions alongside the axis-aligned ones — a 36°
   * five-axis setup among them. Axis-aligned is the common case, not the only
   * one, so the general form has to be readable too.
   */
  it('spells out a direction that is not an axis', () => {
    const tilted: Vec3 = { x: 0.587_785_252_292_476_9, y: 0, z: 0.809_016_994_374_944_8 }

    expect(directionLabel(tilted)).toBe('0.588, 0, 0.809')
  })

  it('does not call a non-unit vector an axis', () => {
    expect(directionLabel({ x: 0, y: 0, z: 0.5 })).toBe('0, 0, 0.5')
  })
})
