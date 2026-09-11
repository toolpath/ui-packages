/**
 * The grammar of an EMUGE-FRANKEN property, against the shapes it really
 * publishes.
 *
 * Every literal below was taken from a live response on 2026-09-01 — the
 * space-separated mixed inch, the label that carries a unit tag beside one that
 * does not, the `999` flute sentinel, the German comma in a tolerance, and the
 * two ranges that would read as sums if the mixed-number form allowed a hyphen.
 */

import { describe, expect, it } from 'vitest'

import { bareLabel, measureIn, parseMeasure, wholeCount } from '../src/vendors/emuge/value.js'

describe('a property label', () => {
  it('loses the unit tag the column suffix already states', () => {
    expect(bareLabel('cutting diameter Ød₁ [inch]')).toBe('cutting diameter Ød₁')
    expect(bareLabel('cutting length l₂ [mm]')).toBe('cutting length l₂')
    expect(bareLabel('nominal diameter d₁ [in]')).toBe('nominal diameter d₁')
    expect(bareLabel('pitch [mm]')).toBe('pitch')
  })

  it('is otherwise the vendor’s own, subscripts and Ø included', () => {
    // The same measurement is tagged on one label and untagged on the next, in
    // one response — which is why the reading of the unit comes from the value.
    expect(bareLabel('overall length l₁')).toBe('overall length l₁')
    expect(bareLabel('neck diameter Ød₃')).toBe('neck diameter Ød₃')
    expect(bareLabel('square ◘')).toBe('square ◘')
    expect(bareLabel('point angle')).toBe('point angle')
  })
})

describe('a value', () => {
  it('reads a millimetre decimal', () => {
    expect(parseMeasure('3 mm')).toEqual({ value: 3, stated: 'millimeters' })
    expect(parseMeasure('0.546 mm')).toEqual({ value: 0.546, stated: 'millimeters' })
    expect(parseMeasure('2.845 mm')).toEqual({ value: 2.845, stated: 'millimeters' })
  })

  it('reads an inch fraction and an inch decimal', () => {
    expect(parseMeasure('1/8 "')).toEqual({ value: 0.125, stated: 'inches' })
    expect(parseMeasure('3/8 "')).toEqual({ value: 0.375, stated: 'inches' })
    expect(parseMeasure('0.01 "')).toEqual({ value: 0.01, stated: 'inches' })
  })

  it('reads a mixed inch written with a space', () => {
    // EMUGE writes `1 1/2` where `measure.fractionValue`'s own form is `1-1/2`.
    // Reading the leading token alone would publish a 1.5 inch tool as a 1 inch
    // one.
    expect(parseMeasure('1 1/2 "')).toEqual({ value: 1.5, stated: 'inches' })
    expect(parseMeasure('2 3/4 "')).toEqual({ value: 2.75, stated: 'inches' })
  })

  it('reads an angle as degrees rather than as a length', () => {
    expect(parseMeasure('140 deg')).toEqual({ value: 140, stated: 'degrees' })
    expect(parseMeasure('17.5 deg')).toEqual({ value: 17.5, stated: 'degrees' })
  })

  it('reads a bare number as stating no unit', () => {
    expect(parseMeasure('4')).toEqual({ value: 4, stated: null })
  })

  it('refuses a range rather than summing it', () => {
    // `35-38` fits a hyphenated mixed number with the denominator absent, so
    // `fractionValue` would answer 73. The grammar here admits no hyphen at
    // all, which is what keeps a helix-angle range and a clamping-range out.
    expect(parseMeasure('35-38 deg')).toEqual({ value: null, stated: null })
    expect(parseMeasure('2 - 10 mm')).toEqual({ value: null, stated: null })
  })

  it('refuses a tolerance rather than guessing at its comma', () => {
    expect(parseMeasure('<=0,003 mm')).toEqual({ value: null, stated: null })
    expect(parseMeasure('± 0,0008 "')).toEqual({ value: null, stated: null })
    expect(parseMeasure('h6')).toEqual({ value: null, stated: null })
  })

  it('refuses an empty cell', () => {
    expect(parseMeasure('')).toEqual({ value: null, stated: null })
    expect(parseMeasure('   ')).toEqual({ value: null, stated: null })
  })
})

describe('a value read as a length', () => {
  const quiet = () => {}

  it('is the number when the family and the value agree', () => {
    expect(measureIn('3 mm', 'millimeters', 'x', quiet)).toBe(3)
    expect(measureIn('1/8 "', 'inches', 'x', quiet)).toBe(0.125)
  })

  it('converts a stated unit the family does not publish, and says so', () => {
    const said: string[] = []
    expect(measureIn('25.4 mm', 'inches', 'PART', (m) => said.push(m))).toBe(1)
    expect(said.join('\n')).toContain('PART')
    expect(said.join('\n')).toContain('converted')
  })

  it('refuses an angle in a length column, and says so', () => {
    // A length column stating an angle is a property that has moved, not a
    // value that is odd — so it is skipped rather than converted.
    const said: string[] = []
    expect(measureIn('140 deg', 'millimeters', 'PART', (m) => said.push(m))).toBeNull()
    expect(said.join('\n')).toContain('PART')
  })

  it('is null where the cell publishes no number', () => {
    expect(measureIn('', 'millimeters', 'x', quiet)).toBeNull()
    expect(measureIn('<=0,003 mm', 'millimeters', 'x', quiet)).toBeNull()
  })
})

describe('a value read as a count', () => {
  it('is the integer it states', () => {
    expect(wholeCount('4')).toBe(4)
    expect(wholeCount('999')).toBe(999)
  })

  it('is null where the cell is not a whole number', () => {
    expect(wholeCount('')).toBeNull()
    expect(wholeCount('3.5')).toBeNull()
    expect(wholeCount('1/8 "')).toBeNull()
  })
})
