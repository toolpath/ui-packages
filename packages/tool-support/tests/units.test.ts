import { describe, expect, it } from 'vitest'

import {
  MM_PER_INCH,
  UNIT_ABBREVIATION,
  UNIT_SYSTEMS,
  convertArea,
  convertLength,
  decimalsFor,
  formatArea,
  formatLength,
  type UnitSystem,
} from '../src/index.js'

describe('the unit system', () => {
  it('is exact by definition', () => {
    expect(MM_PER_INCH).toBe(25.4)
  })

  it('converts a shank diameter both ways', () => {
    // 3/8", the diameter that put 350 tools out of reach of every collet in the
    // crib when a grip check was written without tolerance.
    expect(convertLength(0.375, 'inches', 'millimeters')).toBeCloseTo(9.525, 10)
    expect(convertLength(9.525, 'millimeters', 'inches')).toBeCloseTo(0.375, 10)
  })

  it('is a no-op between one system and itself', () => {
    // Identity rather than a round trip through a division: an inch value
    // converted to inches must be the same float, not one 1e-16 away from it.
    expect(convertLength(0.375, 'inches', 'inches')).toBe(0.375)
    expect(convertLength(9.525, 'millimeters', 'millimeters')).toBe(9.525)
  })

  it('spells and rounds every system it names', () => {
    // The gap this closes is a system added to the union and forgotten in the
    // projections beside it, which is how a lookup table between two spellings
    // of one axis goes wrong.
    for (const system of UNIT_SYSTEMS) {
      expect(UNIT_ABBREVIATION[system], system).toMatch(/^(mm|in)$/)
      expect(decimalsFor(system), system).toBeGreaterThan(0)
    }
    expect(Object.keys(UNIT_ABBREVIATION).sort()).toEqual([...UNIT_SYSTEMS].sort())
  })

  it('reads a thousandth of an inch and a hundredth of a millimetre', () => {
    // Both are about the same distance and both are near the limit of what a
    // mill holds. A fixed decimal count is noise in one system or useless in
    // the other.
    expect(decimalsFor('inches')).toBe(3)
    expect(decimalsFor('millimeters')).toBe(2)
  })

  it('names both systems and no more', () => {
    const named: readonly UnitSystem[] = ['millimeters', 'inches']
    expect([...UNIT_SYSTEMS].sort()).toEqual([...named].sort())
  })
})

describe('converting an area', () => {
  it('squares the conversion', () => {
    // 1 in² is 645.16 mm², not 25.4 — the mistake this exists to stop.
    expect(convertArea(645.16, 'millimeters', 'inches')).toBeCloseTo(1, 9)
    expect(convertArea(1, 'inches', 'millimeters')).toBeCloseTo(645.16, 9)
  })

  it('is a no-op between one system and itself', () => {
    expect(convertArea(806.45, 'millimeters', 'millimeters')).toBe(806.45)
  })

  it('is not the length conversion', () => {
    // A length conversion applied to an area is out by a factor of an inch:
    // large enough to read as a different pocket, small enough that nobody
    // checks it.
    expect(convertArea(645.16, 'millimeters', 'inches')).not.toBeCloseTo(
      convertLength(645.16, 'millimeters', 'inches'),
      6,
    )
  })
})

describe('writing a stored value out', () => {
  it('gives each system the precision it is read at', () => {
    expect(formatLength(8.89, 'inches')).toBe('0.350 in')
    expect(formatLength(8.89, 'millimeters')).toBe('8.89 mm')
  })

  it('names an area as an area', () => {
    expect(formatArea(806.45, 'inches')).toBe('1.250 in²')
    expect(formatArea(806.45, 'millimeters')).toBe('806.45 mm²')
  })

  it('reads the value as the millimetres this domain stores', () => {
    // The second argument is the system a number is *shown* in, never the one
    // it is stored in: a millimetre value asked for millimetres comes back
    // unconverted.
    expect(formatLength(25.4, 'millimeters')).toBe('25.40 mm')
    expect(formatLength(25.4, 'inches')).toBe('1.000 in')
  })

  it('writes every system it names', () => {
    for (const system of UNIT_SYSTEMS) {
      expect(formatLength(25.4, system), system).toMatch(
        new RegExp(`^[\\d.]+ ${UNIT_ABBREVIATION[system]}$`),
      )
      expect(formatArea(645.16, system), system).toMatch(
        new RegExp(`^[\\d.]+ ${UNIT_ABBREVIATION[system]}²$`),
      )
    }
  })
})
