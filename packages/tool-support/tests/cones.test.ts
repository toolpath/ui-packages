import { describe, expect, it } from 'vitest'

import { conesToProfile, profileToCones, type Cone } from '../src/index.js'

const holder: Array<Cone> = [
  { thickness: 10, bottomDiameter: 20, topDiameter: 24 },
  { thickness: 5, bottomDiameter: 24, topDiameter: 24 },
  { thickness: 30, bottomDiameter: 40, topDiameter: 40 },
]

describe('a cone stack as an outline', () => {
  it('is [z, r] from the nose, stepping where diameters disagree', () => {
    expect(conesToProfile(holder)).toEqual([
      [0, 10],
      [10, 12],
      [15, 12],
      [15, 20],
      [45, 20],
    ])
  })

  it('starts where it is told to', () => {
    expect(conesToProfile(holder.slice(0, 1), 50)).toEqual([
      [50, 10],
      [60, 12],
    ])
  })

  it('round-trips', () => {
    expect(profileToCones(conesToProfile(holder, 7))).toEqual(holder)
  })

  it('drops a zero-thickness layer, which is only a step', () => {
    const stepped: Array<Cone> = [
      { thickness: 10, bottomDiameter: 20, topDiameter: 20 },
      { thickness: 0, bottomDiameter: 20, topDiameter: 46 },
      { thickness: 5, bottomDiameter: 46, topDiameter: 46 },
    ]
    expect(profileToCones(conesToProfile(stepped))).toEqual([stepped[0], stepped[2]])
  })

  it('is empty for no layers, and an outline under two points is no stack', () => {
    expect(conesToProfile([])).toEqual([])
    expect(profileToCones([[0, 5]])).toEqual([])
  })

  it('round-trips thicknesses that are not whole, to floating rounding', () => {
    const fine: Array<Cone> = [
      { thickness: 0.1, bottomDiameter: 2, topDiameter: 2 },
      { thickness: 0.2, bottomDiameter: 2, topDiameter: 3 },
      { thickness: 1 / 3, bottomDiameter: 3.3, topDiameter: 3.3 },
    ]
    const back = profileToCones(conesToProfile(fine, 7))
    expect(back).toHaveLength(fine.length)
    back.forEach((layer, index) => {
      const sent = fine[index] as Cone
      expect(layer.thickness).toBeCloseTo(sent.thickness, 12)
      expect([layer.bottomDiameter, layer.topDiameter]).toEqual([
        sent.bottomDiameter,
        sent.topDiameter,
      ])
    })
  })

  it('refuses an outline whose z is not a number', () => {
    expect(() =>
      profileToCones([
        [0, 1],
        [NaN, 1],
        [5, 1],
      ]),
    ).toThrow(RangeError)
    expect(() => profileToCones([[NaN, 1]])).toThrow(RangeError)
  })

  it('refuses an outline running back toward the nose', () => {
    expect(() =>
      profileToCones([
        [10, 5],
        [5, 5],
      ]),
    ).toThrow(RangeError)
  })
})
