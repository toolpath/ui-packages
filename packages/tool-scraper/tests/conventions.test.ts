/**
 * The conventions the vendor CSVs share, and the one that already broke.
 *
 * A CSV keeps its vendor's own column labels, so there is no schema to test.
 * What there is: a short list of rules that hold across the CSVs anyway, and
 * which of them are enforced. These are the rules themselves.
 *
 * **Whether a vendor keeps them is checked in that vendor's own test file**,
 * against the header its adapter really writes — a header quoted as a literal
 * here would be a second copy somebody updates at the same time as the
 * adapter, which is exactly the check being lost.
 */

import { describe, expect, it } from 'vitest'

import {
  CAD_COLUMN,
  CAD_DXF_COLUMN,
  DIN_PREFIX,
  IDENTITY_COLUMNS,
  IDENTITY_DEVIATIONS,
  UNIT_SUFFIX,
  checkIdentityColumns,
  dimensionalColumn,
  identityColumns,
} from '../src/conventions.js'
import { ScraperConfigError } from '../src/errors.js'
import { BRANDS } from '../src/identity.js'

describe('identity columns', () => {
  it('passes a header that carries them', () => {
    // The failure the check prevents: a re-scrape whose part-number column
    // moved or was renamed produces a CSV that still parses, still has the
    // right number of rows, and mints every guid off an empty string.
    expect(() =>
      checkIdentityColumns('regofix', ['Material Number', 'ISO Catalog Number', 'L1_mm']),
    ).not.toThrow()
    expect(() => checkIdentityColumns('destinytool', ['itemNumber', 'cutDia_in'])).not.toThrow()
  })

  it('refuses a header missing one, by name', () => {
    expect(() => checkIdentityColumns('regofix', ['CST', 'L1_mm'])).toThrow(ScraperConfigError)

    try {
      checkIdentityColumns('regofix', ['CST', 'L1_mm'])
      expect.unreachable('should have thrown')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain('regofix')
      expect(message).toContain('Material Number')
      expect(message).toContain('ISO Catalog Number')
    }
  })

  it('writes down every vendor that broke the convention', () => {
    // REGO-FIX adopted Kennametal's identity labels; Destiny Tool passes
    // Firestore's own `itemNumber` straight through, and Harvey Tool and
    // MariTool each genuinely publish one number per part and no catalog
    // designation at all — MariTool keeps `Material Number` and drops only the
    // second column, which is a deviation all the same: a header check that
    // did not know would fail every MariTool CSV. The
    // convention was real but informal, and it eroded the first time a vendor
    // did not resemble the first two — so each deviation is a table entry, and
    // the next vendor's drift has to be a decision somebody made rather than a
    // thing that happened.
    expect(Object.keys(IDENTITY_DEVIATIONS).sort()).toEqual(['destinytool', 'harvey', 'maritool'])
    expect(identityColumns('destinytool')).toEqual(['itemNumber'])
    expect(identityColumns('harvey')).toEqual(['Tool #'])
    expect(identityColumns('maritool')).toEqual(['Material Number'])
    expect(identityColumns('regofix')).toEqual(IDENTITY_COLUMNS)
  })

  it('declares every deviation for a brand this package knows', () => {
    // A deviation keyed on a brand nothing scrapes is a rule with nothing to
    // apply it to, and would silently stop applying if a brand were renamed.
    // `IDENTITY_DEVIATIONS` is keyed by `BrandName`, so the compiler holds
    // this now; the assertion keeps the claim visible and catches a widened
    // key type.
    for (const brand of Object.keys(IDENTITY_DEVIATIONS)) {
      expect(Object.keys(BRANDS)).toContain(brand)
    }
  })

  it('gives an unlisted brand the convention rather than an exemption', () => {
    // The lookup defaults to the rule, not to "no identity columns" — a brand
    // added without an entry is held to the convention until somebody writes
    // down that it cannot be. The Python passed an unknown brand here; that is
    // a compile error now, so the case is made with the three real brands that
    // carry no deviation.
    expect(identityColumns('kennametal')).toEqual(IDENTITY_COLUMNS)
    expect(identityColumns('widia')).toEqual(IDENTITY_COLUMNS)
    expect(identityColumns('regofix')).toEqual(IDENTITY_COLUMNS)
  })
})

describe('units', () => {
  it('carries the unit in the suffix, and there are only two', () => {
    expect(UNIT_SUFFIX).toEqual({ millimeters: '_mm', inches: '_in' })
    expect(dimensionalColumn('D1', 'millimeters')).toBe('D1_mm')
    expect(dimensionalColumn('D1', 'inches')).toBe('D1_in')
  })

  it('refuses an unknown unit system rather than defaulting', () => {
    // A typo that silently picked millimetres would produce a clean conversion
    // with the wrong numbers in it — which is the failure mode a declared
    // `unit` exists to prevent, not one it may cause. `'metric'` is the
    // plausible typo: it is what the vendor's own URL calls it.
    expect(() => dimensionalColumn('D1', 'metric')).toThrow(/unknown unit system/)
    expect(() => dimensionalColumn('D1', 'metric')).toThrow(ScraperConfigError)
  })

  it('does not treat an inherited property as a unit system', () => {
    // `Object.hasOwn` rather than `in`: `'toString' in UNIT_SUFFIX` is true,
    // and would suffix a column with `undefined`.
    expect(() => dimensionalColumn('D1', 'toString')).toThrow(/unknown unit system/)
  })
})

describe('the advisory rules', () => {
  it('names the CAD column once across vendors', () => {
    // Named for what it holds rather than for how one vendor names the format.
    // It was `CAD_STP_LWM` until 2026-08-08 — CDS Visual's key for
    // Kennametal's lightweight model — and the moment a second vendor wrote
    // into the column that name became a claim about the data that was false.
    expect(CAD_COLUMN).toBe('CAD_STEP_URL')
    expect(CAD_COLUMN.endsWith('_mm')).toBe(false)
    expect(CAD_COLUMN.endsWith('_in')).toBe(false)
  })

  it('keeps a 2D profile out of the STEP column', () => {
    // Harvey publishes a DXF for almost every part and a STEP for none, and
    // writing that link into `CAD_STEP_URL` would repeat the mistake the
    // `CAD_STP_LWM` rename fixed: a column name that is a claim about the data,
    // and false. Two columns, both vendor-neutral, neither owned by a vendor.
    expect(CAD_DXF_COLUMN).toBe('CAD_DXF_URL')
    expect(CAD_DXF_COLUMN).not.toBe(CAD_COLUMN)
  })

  it('keeps an unmapped vendor code from reading as a dimension', () => {
    // A bare `A2` beside `L1_mm` reads as a labelled dimension. `DIN_A2` reads
    // as what it is: a vendor code, pending a source.
    expect(DIN_PREFIX).toBe('DIN_')
    expect(`${DIN_PREFIX}A2`.endsWith('_mm')).toBe(false)
    expect(`${DIN_PREFIX}A2`.endsWith('_in')).toBe(false)
  })
})
