/**
 * The value grammar, and the one rule that covers it.
 *
 * Every string here is a real cell. The shapes and their counts across all
 * 12,773 parts are in `docs/HARVEY_PRODUCT_TABLE.md` §4; what is tested is that
 * the leading token is the value and a parenthesised group is Harvey's own
 * annotation — including the case where honouring that distinction is the
 * difference between a 3 mm shank and a 3 inch one.
 */

import { describe, expect, it } from 'vitest'

import { MM_PER_INCH } from '../src/measure.js'
import { count, dimension, parseValue } from '../src/vendors/harvey/value.js'

const silent = () => {}

describe('the leading token is the value', () => {
  it('reads decimals, whole numbers, fractions and mixed numbers', () => {
    expect(parseValue('.1250').value).toBe(0.125)
    expect(parseValue('6').value).toBe(6)
    expect(parseValue('1.550').value).toBe(1.55)
    expect(parseValue('1/16').value).toBe(0.0625)
    expect(parseValue('9/64').value).toBe(0.140625)
    expect(parseValue('1-1/2').value).toBe(1.5)
    expect(parseValue('3-7/16').value).toBe(3.4375)
  })

  it('does not stop at the whole part of a mixed number', () => {
    // The alternation has to try the mixed form first: `\d*\.?\d+` alone
    // matches the `3` of `3-3/4` and reads a 3.75 inch tool as a 3 inch one.
    expect(parseValue('3-3/4').value).toBe(3.75)
  })

  it('keeps a parenthesised equivalent as an annotation, not a value', () => {
    expect(parseValue('.1250 (1/8)')).toMatchObject({ value: 0.125, annotation: '1/8' })
    expect(parseValue('.1181 (3 mm)')).toMatchObject({ value: 0.1181, annotation: '3 mm' })
    expect(parseValue('.028 (.7mm)')).toMatchObject({ value: 0.028, annotation: '.7mm' })
    expect(parseValue('1.8°(N.P.T.)')).toMatchObject({ value: 1.8, degrees: true })
  })

  it('reads a unit the token states outright', () => {
    expect(parseValue('3 mm')).toMatchObject({ value: 3, stated: 'millimeters' })
    expect(parseValue('6.00 mm')).toMatchObject({ value: 6, stated: 'millimeters' })
    expect(parseValue('.250')).toMatchObject({ value: 0.25, stated: null })
  })

  it('reads an angle as an angle', () => {
    expect(parseValue('5.0°')).toMatchObject({ value: 5, degrees: true })
    expect(parseValue('20°')).toMatchObject({ value: 20, degrees: true })
  })

  it('reads a ratio annotation as a ratio and not a dimension', () => {
    expect(parseValue('(1.5x)')).toMatchObject({ value: null, ratio: 1.5 })
    expect(parseValue('(30x)')).toMatchObject({ value: null, ratio: 30 })
    expect(parseValue('(.5x)')).toMatchObject({ value: null, ratio: 0.5 })
  })

  it('reads text with no numeric reading as a code', () => {
    expect(parseValue('I')).toMatchObject({ value: null, code: 'I' })
    expect(parseValue('III')).toMatchObject({ value: null, code: 'III' })
    // The badge in the white-text column, footnote marker and all.
    expect(parseValue('LONG!')).toMatchObject({ value: null, code: 'LONG' })
  })

  it('reads a blank and a dash as no value rather than as zero', () => {
    // 91 cells say `-`, meaning the column does not apply to that row. Zero is
    // a length; "not applicable" is not.
    expect(parseValue('-').value).toBeNull()
    expect(parseValue('').value).toBeNull()
  })

  it('drops a footnote marker from the number it is attached to', () => {
    expect(parseValue('1/4*').value).toBe(0.25)
    expect(parseValue('3/16*').value).toBe(0.1875)
  })
})

describe('resolving a dimension against the family unit', () => {
  it('takes a value stating no unit as the family unit', () => {
    expect(dimension('.1250 (1/8)', 'inches', 'x', silent)).toBe(0.125)
    expect(dimension('.75', 'millimeters', 'x', silent)).toBe(0.75)
  })

  it('converts a value that states a unit the family does not, and warns', () => {
    // 46 cells across six imperial families publish a metric shank or neck
    // outright. Trusting the column would ship a 3-inch shank; refusing would
    // drop a tool somebody can order.
    const warnings: string[] = []
    const value = dimension('3 mm', 'inches', '12345', (m) => warnings.push(m))

    expect(value).toBeCloseTo(3 / MM_PER_INCH, 10)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('12345')
    expect(warnings[0]).toContain('millimeters')
  })

  it('does not convert a parenthesised metric equivalent', () => {
    // `.1181 (3 mm)` is an inch value annotated with its metric equivalent.
    // Converting it would turn 0.1181 in into 3 in.
    const warnings: string[] = []
    expect(dimension('.1181 (3 mm)', 'inches', 'x', (m) => warnings.push(m))).toBe(0.1181)
    expect(warnings).toEqual([])
  })

  it('refuses an angle in a column read as a length, and warns', () => {
    const warnings: string[] = []
    expect(dimension('5.0°', 'inches', 'x', (m) => warnings.push(m))).toBeNull()
    expect(warnings).toHaveLength(1)
  })

  it('is null where the cell publishes nothing', () => {
    expect(dimension('-', 'inches', 'x', silent)).toBeNull()
    expect(dimension('', 'inches', 'x', silent)).toBeNull()
  })
})

describe('counts', () => {
  it('reads a whole number and refuses anything else', () => {
    expect(count('4')).toBe(4)
    expect(count('12')).toBe(12)
    expect(count('')).toBeNull()
    expect(count('-')).toBeNull()
    // A fraction in a flute column is a column that moved, not a tool with
    // half a flute.
    expect(count('1/2')).toBeNull()
  })
})
