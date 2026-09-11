/**
 * The one reader for a machinist's number.
 *
 * Three adapters had their own until 2026-08-29 and they disagreed on real
 * inputs, so what is pinned here is the whole grammar in one place — including
 * the two shapes that must **not** read as numbers, which is where the three
 * readers differed and where a wrong answer is silent.
 */

import { describe, expect, it } from 'vitest'

import { MM_PER_INCH, asCount, asLength, convertLength, fractionValue } from '../src/measure.js'

describe('the four shapes a vendor publishes', () => {
  it('reads a decimal, with or without a leading zero', () => {
    expect(fractionValue('.250')).toBe(0.25)
    expect(fractionValue('0.250')).toBe(0.25)
    expect(fractionValue('1.550')).toBe(1.55)
  })

  it('reads a whole number', () => {
    expect(fractionValue('6')).toBe(6)
    expect(fractionValue('0')).toBe(0)
  })

  it('reads a simple fraction', () => {
    expect(fractionValue('3/4')).toBe(0.75)
    expect(fractionValue('9/64')).toBe(0.140625)
  })

  it('reads a mixed number', () => {
    // The shape REGO-FIX's own reader could not take: `Number('1-1/2')` is NaN,
    // so a mixed number was refused there and read as 1.5 by Harvey's.
    expect(fractionValue('1-1/2')).toBe(1.5)
    expect(fractionValue('3-7/16')).toBe(3.4375)
  })

  it('ignores surrounding whitespace', () => {
    expect(fractionValue('  1-1/2  ')).toBe(1.5)
  })
})

describe('what is deliberately not a number', () => {
  it('refuses a range, rather than summing it', () => {
    // The reason the whole-number part of a mixed number is `\\d+` and not a
    // decimal. Destiny Tool really publishes `.035-.040` — a corner-radius
    // range — and reading it as `0.035 + 0.040` would ship a wrong radius with
    // nothing failing.
    expect(fractionValue('.035-.040')).toBeNull()
    expect(fractionValue('0.035-0.040')).toBeNull()
  })

  it('refuses a division by zero, which arrives looking finite', () => {
    // `3/` reached one adapter as Infinity and would have travelled into a row
    // as a nominal size.
    expect(fractionValue('3/')).toBeNull()
    expect(fractionValue('3/0')).toBeNull()
  })

  it('refuses text, a unit, and the empty string', () => {
    // A unit is the caller's business: `unit` decides which column is read, and
    // a reader that accepted `3 mm` would be guessing at a system.
    expect(fractionValue('')).toBeNull()
    expect(fractionValue('abc')).toBeNull()
    expect(fractionValue('3 mm')).toBeNull()
    expect(fractionValue('1/4"')).toBeNull()
  })

  it('answers null rather than throwing, whatever the input', () => {
    // The refusal is the caller's: Harvey skips a cell the column does not
    // apply to, REGO-FIX refuses a collet with no size. Pushing that decision
    // in here would take it from the module that knows.
    for (const token of ['', '-', 'N.P.T.', '1/0', '.5-.6']) {
      expect(() => fractionValue(token)).not.toThrow()
    }
  })
})

describe('the constant, and converting with it', () => {
  it('is the 1959 definition', () => {
    expect(MM_PER_INCH).toBe(25.4)
  })

  it('is a no-op between the same system', () => {
    expect(convertLength(3, 'inches', 'inches')).toBe(3)
    expect(convertLength(3, 'millimeters', 'millimeters')).toBe(3)
  })

  it('converts both ways', () => {
    expect(convertLength(1, 'inches', 'millimeters')).toBe(25.4)
    expect(convertLength(25.4, 'millimeters', 'inches')).toBe(1)
  })
})

/**
 * The two decisions about a cell that has already been read.
 *
 * `vendors/harvey/value.ts` and `vendors/emuge/value.ts` each held a copy of
 * these until 2026-09-01 — the same control flow and the same two warnings,
 * word for word — so what is pinned here is the pair of calls both vendors now
 * make, in the one place they are made.
 */
describe('a read cell as a length', () => {
  const quiet = () => {}

  it('is the number where the cell and the family agree', () => {
    expect(asLength({ value: 3, stated: 'millimeters' }, '3 mm', 'millimeters', 'x', quiet)).toBe(3)
    expect(asLength({ value: 0.125, stated: null }, '.125', 'inches', 'x', quiet)).toBe(0.125)
  })

  it('converts a stated unit the family does not publish, and says so', () => {
    // The value is right and the column's suffix is right, so dropping the row
    // would lose a part somebody can order.
    const said: string[] = []
    const value = asLength(
      { value: 25.4, stated: 'millimeters' },
      '25.4 mm',
      'inches',
      'PART',
      (m) => said.push(m),
    )

    expect(value).toBe(1)
    expect(said.join('\n')).toContain('PART')
    expect(said.join('\n')).toContain('"25.4 mm"')
    expect(said.join('\n')).toContain('converted')
  })

  it('refuses an angle in a length column, and says so', () => {
    // A header that has moved rather than a value that is odd.
    const said: string[] = []
    const value = asLength(
      { value: 140, stated: 'degrees' },
      '140 deg',
      'millimeters',
      'PART',
      (m) => said.push(m),
    )

    expect(value).toBeNull()
    expect(said.join('\n')).toContain('PART')
    expect(said.join('\n')).toContain('skipped')
  })

  it('is null where the reader found no number, and warns about nothing', () => {
    const said: string[] = []
    expect(
      asLength({ value: null, stated: null }, '-', 'inches', 'x', (m) => said.push(m)),
    ).toBeNull()
    expect(said).toEqual([])
  })
})

describe('a read cell as a count', () => {
  it('is the whole number it states', () => {
    expect(asCount({ value: 4, stated: null })).toBe(4)
    expect(asCount({ value: 0, stated: null })).toBe(0)
  })

  it('is null for no number and for a fraction', () => {
    // Half a flute is a column that has moved, not a tool.
    expect(asCount({ value: null, stated: null })).toBeNull()
    expect(asCount({ value: 3.5, stated: null })).toBeNull()
    expect(asCount({ value: 0.125, stated: 'inches' })).toBeNull()
  })
})
