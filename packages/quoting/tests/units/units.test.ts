import { describe, expect, it } from 'vitest'
import {
  formatDimensions,
  formatFeed,
  formatLength,
  formatSurfaceSpeed,
  formatWeight,
  fromInput,
  parseToolLength,
  PRECISION,
  roundTo,
  stepFor,
  toInput,
  toStored,
  type Quantity,
  type Units,
} from '../../src/units/units'

describe('formatLength', () => {
  it('shows a millimetre value in the chosen unit', () => {
    expect(formatLength(6.35, 'mm')).toBe('6.35 mm')
    expect(formatLength(25.4, 'in')).toBe('1"')
    expect(formatLength(0.508, 'in')).toBe('0.02"')
  })
})

describe('formatDimensions', () => {
  it('shows a millimetre size in the chosen unit', () => {
    const size = { length: 50.8, width: 38.1, height: 12.7 }
    expect(formatDimensions(size, 'mm')).toBe('50.8 x 38.1 x 12.7 mm')
    expect(formatDimensions(size, 'in')).toBe('2 x 1.5 x 0.5 in')
  })
})

describe('formatFeed', () => {
  it('shows mm/min or in/min', () => {
    expect(formatFeed(4850, 'mm')).toBe('4850 mm/min')
    expect(formatFeed(4850, 'in')).toBe('190.9 in/min')
  })
})

describe('formatSurfaceSpeed', () => {
  it('shows m/min or SFM', () => {
    expect(formatSurfaceSpeed(58, 'mm')).toBe('58 m/min')
    expect(formatSurfaceSpeed(58, 'in')).toBe('190 SFM')
  })
})

describe('formatWeight', () => {
  it('shows kilograms or pounds', () => {
    expect(formatWeight(1, 'mm')).toBe('1 kg')
    expect(formatWeight(1, 'in')).toBe('2.205 lb')
  })
})

describe('profile inputs', () => {
  const QUANTITIES: Array<Quantity> = ['density', 'length', 'ratio', 'angle', 'count']
  const SYSTEMS: Array<Units> = ['mm', 'in']

  /** Every value at a field's shown precision, across a spread of magnitudes. */
  const typed = (places: number): Array<number> => {
    const step = 10 ** -places
    return Array.from({ length: 2000 }, (_, i) => roundTo((i + 1) * step * 37, places))
  }

  it('reads back exactly what was typed, in either system, after being stored canonical', () => {
    for (const quantity of QUANTITIES) {
      for (const units of SYSTEMS) {
        for (const value of typed(PRECISION[quantity][units])) {
          const stored = fromInput(quantity, value, units)
          expect(toInput(quantity, stored, units)).toBe(value)
        }
      }
    }
  })

  it('stores canonical values at the metric precision, which is what the server keeps', () => {
    expect(fromInput('density', 0.0975, 'in')).toBe(2698.8)
    expect(fromInput('length', 0.125, 'in')).toBe(3.175)
    expect(toStored('density', 2698.7909)).toBe(2698.8)
  })

  it('shows only values its step allows, so a switched field is never invalid', () => {
    for (const quantity of QUANTITIES) {
      for (const units of SYSTEMS) {
        const step = Number(stepFor(quantity, units))
        for (const canonical of [1.2, 7850, 3.175, 2698.8, 0.1, 30]) {
          const shown = toInput(quantity, canonical, units)
          const steps = shown / step
          expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6)
        }
      }
    }
  })

  it('leaves the canonical unchanged in millimetres', () => {
    expect(toInput('density', 2700, 'mm')).toBe(2700)
    expect(toInput('length', 6.35, 'mm')).toBe(6.35)
    expect(toInput('length', 3.175, 'in')).toBe(0.125)
  })
})

describe('parseToolLength', () => {
  it('reads inch decimals, fractions and mixed numbers into millimetres', () => {
    expect(parseToolLength('0.25', 'in')).toBe(6.35)
    expect(parseToolLength('.25', 'in')).toBe(6.35)
    expect(parseToolLength('1/4', 'in')).toBe(6.35)
    expect(parseToolLength('1/4"', 'in')).toBe(6.35)
    expect(parseToolLength('1-1/4', 'in')).toBe(31.75)
    expect(parseToolLength('1 1/4 in', 'in')).toBe(31.75)
  })

  it('reads millimetres as they are', () => {
    expect(parseToolLength('6.35', 'mm')).toBe(6.35)
    expect(parseToolLength('12 mm', 'mm')).toBe(12)
  })

  it('refuses what is not a length', () => {
    expect(parseToolLength('', 'in')).toBeUndefined()
    expect(parseToolLength('abc', 'in')).toBeUndefined()
    expect(parseToolLength('1/0', 'in')).toBeUndefined()
    expect(parseToolLength('-1', 'mm')).toBeUndefined()
  })
})

describe('round stock dimensions', () => {
  it('shows diameter and axial length in the selected units', () => {
    const size = { length: 25.4, width: 25.4, height: 50.8 }
    expect(formatDimensions(size, 'mm', 'cylinder')).toBe('Ø 25.4 x 50.8 mm')
    expect(formatDimensions(size, 'in', 'cylinder')).toBe('Ø 1 x 2 in')
  })
})
