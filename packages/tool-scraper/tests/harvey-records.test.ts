/**
 * Harvey rows -> records, and the two places the record is not a copy of a cell.
 *
 * The CSV holds Harvey's own display strings, so this is where `.1250 (1/8)`
 * becomes a number and where a family with no radius column gets a corner
 * radius. Both are places a wrong answer would look entirely plausible
 * downstream, which is why they are tested against the real family configs
 * rather than a hand-built one.
 */

import { describe, expect, it } from 'vitest'

import { identityColumns } from '../src/conventions.js'
import { VendorResponseError } from '../src/errors.js'
import { recordGuid } from '../src/identity.js'
import { UNSPECIFIED } from '../src/records.js'
import { boundFamily } from '../src/registry.js'
import type { ScrapedRow } from '../src/scrape.js'
import { endmillRecord } from '../src/vendors/harvey/records.js'

const silent = { warn: () => {} }

/** A ball family with no radius column: `harvey_endmill_025.csv`. */
const BALL = boundFamily('harvey_endmill_025.csv')
/** A square family whose table does publish a radius: `harvey_endmill_014.csv`. */
const CORNER_RADIUS = boundFamily('harvey_endmill_014.csv')
/** The metric ball family, to prove the unit is not assumed: `..._030.csv`. */
const METRIC = boundFamily('harvey_endmill_030.csv')

function ballRow(over: Partial<Record<string, string>> = {}): ScrapedRow {
  return {
    'Tool #': '14916',
    Description: 'Miniature End Mills - Ball - Extra Long Length',
    Coating: 'AlTiN COATED',
    FLUTES: '4',
    'CUTTER DIA._in': '.250 (1/4)',
    LOC_in: '.375',
    'OVERALL REACH_in': '4.375',
    'OVERALL REACH RATIO': '(17.5x)',
    'SHANK DIA._in': '1/4',
    OAL_in: '6',
    PRICE_USD: '148.40',
    ...over,
  }
}

describe('one part', () => {
  const record = endmillRecord(ballRow(), BALL, BALL.columns, silent)

  it('names the vendor and the part', () => {
    // Harvey publishes one number, so it fills both roles — see
    // `conventions.IDENTITY_DEVIATIONS.harvey`.
    expect(record.vendor).toBe('Harvey Tool')
    expect(record.materialNumber).toBe('14916')
    expect(record.catalogNumber).toBe(record.materialNumber)
    expect(identityColumns('harvey')).toEqual(['Tool #'])
  })

  it('resolves the display strings into numbers', () => {
    expect(record.geometry).toMatchObject({
      DC: 0.25,
      LCF: 0.375,
      SFDM: 0.25,
      OAL: 6,
      'shoulder-length': 4.375,
      NOF: 4,
    })
  })

  it('carries the coating, because no carbide grade is published anywhere', () => {
    expect(record.coating).toBe('AlTiN COATED')
    expect(record.substrate).toBe('carbide')
  })

  it('states no workpiece-material groups at all, which is no evidence', () => {
    // Nothing in a Harvey variant table rates a tool to ISO 513 groups, so this
    // is `null` — no evidence — and not `[]`, which is what a vendor index that
    // rates a part for nothing produces. Every Harvey record lands here: the
    // per-part page does publish a materials list, and a 2026-08-29 probe found
    // it varying by coating *within* a family, so there is nothing a family fact
    // could honestly say. See the mapper's module docstring.
    expect(record.materialGroups).toBeNull()
    expect(record.materialGroupsSource).toBe(UNSPECIFIED)
  })

  it('mints its guid in the Harvey namespace', () => {
    expect(record.materialNumber).toBe('14916')
    expect(record.brand).toBe('harvey')
    expect(record.guid).toBe(recordGuid('harvey', '14916'))
    expect(recordGuid('harvey', '14916')).not.toBe(recordGuid('kennametal', '14916'))
  })
})

describe('the corner radius', () => {
  it('is half the diameter on a ball family, which publishes no radius column', () => {
    // Not a guess: the radius of a ball end is half its diameter, and the
    // `profile` fact is what says the family is one.
    expect(BALL.profile).toBe('Ball')
    expect(BALL.columns.labels.RE).toBeUndefined()
    expect(endmillRecord(ballRow(), BALL, BALL.columns, silent).geometry.RE).toBe(0.125)
  })

  it('is the published column where the family has one', () => {
    const row: ScrapedRow = {
      'Tool #': '840701',
      Description: 'Miniature End Mills - Corner Radius - Stub & Standard',
      Coating: 'UNCOATED',
      FLUTES: '4',
      'CUTTER DIA._in': '.062 (1/16)',
      'CORNER RADIUS_in': '.005',
      'LENGTH OF CUT_in': '.093',
      'LENGTH OF CUT RATIO': '(1.5x)',
      'SHANK DIA._in': '1/8',
      OAL_in: '1-1/2',
      PRICE_USD: '30.10',
    }
    expect(endmillRecord(row, CORNER_RADIUS, CORNER_RADIUS.columns, silent).geometry.RE).toBe(0.005)
  })

  it('is zero on a square family, not absent', () => {
    // `RE` is optional on the endmill contract precisely so a square end can
    // say zero rather than nothing.
    const square = boundFamily('harvey_endmill_020.csv')
    const row: ScrapedRow = {
      'Tool #': '13905',
      Description: 'Miniature End Mills - Square - Stub & Standard',
      Coating: 'UNCOATED',
      FLUTES: '2',
      'CUTTER DIA._in': '.005',
      LOC_in: '.0075',
      'LOC RATIO': '(1.5x)',
      'SHANK DIA._in': '1/8',
      OAL_in: '1-1/2',
      PRICE_USD: '77.60',
    }
    expect(square.profile).toBe('Square')
    expect(endmillRecord(row, square, square.columns, silent).geometry.RE).toBe(0)
  })
})

describe('units', () => {
  it('reads a metric family in millimetres and says so', () => {
    const row: ScrapedRow = {
      'Tool #': '741311',
      Description: 'Miniature End Mills - Ball - Stub & Standard - Metric',
      Coating: 'UNCOATED',
      FLUTES: '2',
      'CUTTER DIAMETER_mm': '.500 mm',
      'LENGTH OF CUT_mm': '.75',
      'LENGTH OF CUT RATIO': '(1.5x)',
      'SHANK DIAMETER_mm': '3 mm',
      'OVERALL LENGTH_mm': '38 mm',
      PRICE_USD: '52.30',
    }
    const record = endmillRecord(row, METRIC, METRIC.columns, silent)

    // The numbers the `v` field would have got wrong: `v` says 0.0197 for the
    // diameter (inches) and 0.75 for the length of cut (mm), in one row.
    expect(record.unit).toBe('millimeters')
    expect(record.geometry).toMatchObject({ DC: 0.5, LCF: 0.75, SFDM: 3, OAL: 38 })
  })

  it('converts a metric cell on an imperial family, and warns', () => {
    // 46 real cells do this — a metric-shank tool listed among imperial ones.
    const warnings: string[] = []
    const record = endmillRecord(ballRow({ 'SHANK DIA._in': '3 mm' }), BALL, BALL.columns, {
      warn: (m) => warnings.push(m),
    })

    expect(record.geometry.SFDM).toBeCloseTo(3 / 25.4, 10)
    expect(warnings.some((w) => w.includes('14916'))).toBe(true)
  })
})

describe('what a row has to carry', () => {
  it('refuses a row with no tool number', () => {
    expect(() => endmillRecord(ballRow({ 'Tool #': '' }), BALL, BALL.columns, silent)).toThrow(
      VendorResponseError,
    )
  })

  it('refuses a row whose required dimension is blank, naming the part', () => {
    expect(() => endmillRecord(ballRow({ OAL_in: '' }), BALL, BALL.columns, silent)).toThrow(
      /14916.*OAL/s,
    )
  })

  it('leaves the flute count off where the family publishes none', () => {
    // The two deburring families state right- and left-hand tooth counts and no
    // flute count at all. An absent NOF is the honest answer; a default would
    // put a flute count on a tool nobody stated one for.
    const deburring = boundFamily('harvey_endmill_015.csv')
    const row: ScrapedRow = {
      'Tool #': '70225',
      Description: 'Miniature End Mills - Square - Deburring End Mill',
      Coating: 'UNCOATED',
      'CUTTER DIA._in': '.093 (3/32)',
      LOC_in: '.093',
      'LOC RATIO': '(1x)',
      'RIGHT HAND TEETH': '12',
      'LEFT HAND TEETH': '10',
      'SHANK DIA._in': '1/8',
      OAL_in: '1-1/2',
      PRICE_USD: '48.50',
    }
    expect(deburring.columns.labels.NOF).toBeUndefined()
    expect(endmillRecord(row, deburring, deburring.columns, silent).geometry.NOF).toBeUndefined()
  })
})
