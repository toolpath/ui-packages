/**
 * The measured-profile core: the datum change, the gates, and the cross-check.
 *
 * Nothing here makes a request. `profiles.ts` is pure by design so that the
 * part of this pipeline with real arithmetic in it can be checked against
 * numbers rather than against a stack that has to be running — which is also
 * what makes the fixtures worth what they are.
 *
 * **`tests/fixtures/holders/*.json` are real `HolderResponse` bodies**, taken
 * from Engine API v1.3.0 / kernel 0.7.2 against the same three STEP files the
 * Fusion-era pipeline measured, at the same 0.05 mm tolerance with `fillBays`
 * off. They are captured rather than invented because the three of them are the
 * three cases the cross-check exists to tell apart:
 *
 * - `BT30ER16060M` — solved 60 against a published 60. Agreement to nanometres.
 * - `BT30HC14100M` — solved 100.355 against a published 100. A real 0.355 mm
 *   nose lip past the face the vendor measures `L1` to, which is *explained*
 *   and must still read as complete.
 * - `BTKV30ER16100M` — solved 89.4 against a published 100. The collet nut the
 *   BTKV30 models omit, which must read as incomplete and carry the 10.6 mm.
 *
 * A test built on round numbers would pass against any tolerance between the
 * second case and the third, and the whole point of `GAUGE_TOLERANCE_MM` is
 * that it sits in that gap on purpose.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ScraperConfigError, VendorResponseError } from '../src/errors.js'
import { holderRecord, type HolderRecord } from '../src/holding.js'
import {
  GAUGE_TOLERANCE_MM,
  PROFILES_VERSION,
  buildProfiles,
  checkProfile,
  layersToProfile,
  taperDesignation,
  type HolderLayer,
  type HolderProfile,
  type MeasuredHolder,
} from '../src/profiles.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/holders')

/** One captured `HolderResponse` as a {@link MeasuredHolder}. */
function measured(catalogNumber: string, over: Partial<MeasuredHolder> = {}): MeasuredHolder {
  const body = JSON.parse(readFileSync(join(FIXTURES, `${catalogNumber}.json`), 'utf8'))
  return {
    brand: 'kennametal',
    catalogNumber,
    layers: body.layers,
    gaugeLength: body.gaugeLength,
    sizeClass: body.sizeClass,
    taperFamily: body.taperFamily,
    kernelVersion: body.kernelVersion,
    options: body.options,
    ...over,
  }
}

/** The scraped holder each fixture belongs to, with the vendor's own `L1`. */
function holder(
  catalogNumber: string,
  materialNumber: string,
  gaugeLength: number,
  over: Partial<Parameters<typeof holderRecord>[0]> = {},
): HolderRecord {
  return holderRecord({
    brand: 'kennametal',
    materialNumber,
    catalogNumber,
    description: '',
    unit: 'millimeters',
    taper: 'BT30',
    contact: 'taper',
    clamping: 'collet',
    style: 'er-collet-chuck',
    colletSeries: 'ER16',
    gaugeLength,
    // Stated rather than left out, so `over` can set any one of them without
    // colliding with an `unpublished` declaration — `tests/holding.test.ts`
    // owns that contract and this fixture only has to satisfy it.
    bore: null,
    usableLength: null,
    clampingLength: null,
    adjustmentRange: null,
    bodyDiameter: null,
    lockNutDiameter: null,
    cadModelUrl: null,
    cadModelSource: 'vendor-stated',
    cadDxfUrl: null,
    unpublished: [],
    ...over,
  })
}

const ER16 = holder('BT30ER16060M', '1258023', 60)
const HC14 = holder('BT30HC14100M', '6480636', 100, {
  clamping: 'hydraulic',
  style: 'hydraulic-chuck',
  colletSeries: null,
  bore: 14,
})
const BTKV = holder('BTKV30ER16100M', '7195558', 100, { contact: 'face' })

/** A two-cone stack: 10 mm of straight 20 mm bar, then 5 mm tapering to 30. */
const STACK: HolderLayer[] = [
  { thickness: 10, bottomDiameter: 20, topDiameter: 20 },
  { thickness: 5, bottomDiameter: 20, topDiameter: 30 },
]

describe('layers to a gage-line silhouette', () => {
  it('puts the nose at +L1 and the spindle end at L1 minus the height', () => {
    expect(layersToProfile(STACK, 10)).toEqual([
      [-5, 15],
      [0, 10],
      [10, 10],
    ])
  })

  it('datums on the nose where the API solved no gauge plane', () => {
    expect(layersToProfile(STACK, null)).toEqual([
      [-15, 15],
      [-10, 10],
      [0, 10],
    ])
  })

  it('emits two points at one z where the solid steps', () => {
    const stepped: HolderLayer[] = [
      { thickness: 4, bottomDiameter: 20, topDiameter: 20 },
      { thickness: 4, bottomDiameter: 40, topDiameter: 40 },
    ]
    // Read upward: 20 mm of bar, a vertical face out to 40, then 40 mm of bar.
    // One point per boundary would draw that face as a slope across 4 mm of
    // holder and quietly shave the envelope.
    expect(layersToProfile(stepped, 8)).toEqual([
      [0, 20],
      [4, 20],
      [4, 10],
      [8, 10],
    ])
  })

  it('has no points for an empty stack rather than refusing', () => {
    // `checkProfile` is where a profile too short to draw is refused, and it
    // says which part it was.
    expect(layersToProfile([], 10)).toEqual([])
  })

  it('reproduces the range Fusion measured on BT30ER16060M', () => {
    const points = layersToProfile(measured('BT30ER16060M').layers, 60)
    expect(points).toHaveLength(115)
    expect(points[0]![0]).toBeCloseTo(-48.4, 9)
    expect(points[points.length - 1]![0]).toBe(60)
    // The ER16 nut, at the scraped `lockNutDiameter` of 32 mm — both ends of
    // the band it holds. Toleranced because the fixture is a real measurement:
    // the API reports the nut as 32.00000000000034 mm.
    expect(points.filter(([, r]) => Math.abs(r - 16) < 1e-9)).toHaveLength(2)
  })
})

describe('reading a taper designation', () => {
  it('reads the three 7:24 prefixes the catalog states', () => {
    expect(taperDesignation('BT30')).toEqual({ sizeClass: 30, family: 'iso7x24' })
    expect(taperDesignation('BT40')).toEqual({ sizeClass: 40, family: 'iso7x24' })
    expect(taperDesignation('CAT40')).toEqual({ sizeClass: 40, family: 'iso7x24' })
    expect(taperDesignation('CAT50')).toEqual({ sizeClass: 50, family: 'iso7x24' })
  })

  // Kennametal's word for the cone MariTool calls CAT. Both are here rather
  // than one rewritten to the other — `HolderRecord.taper` is the interface as
  // the *vendor* designates it — so what has to agree is what comes back.
  it('reads CV as the same cone and size CAT names', () => {
    expect(taperDesignation('CV40')).toEqual(taperDesignation('CAT40'))
    expect(taperDesignation('CV50')).toEqual(taperDesignation('CAT50'))
  })

  // ISO 26623 is a polygon, so it has no 7:24 size to read and no `TaperFamily`
  // to belong to. A PSC family still scrapes and records; it is only the
  // profile check that cannot be made, and it says so rather than passing.
  it('refuses PSC rather than inventing a size for a polygon shank', () => {
    expect(() => taperDesignation('PSC63')).toThrow(ScraperConfigError)
  })

  it('reads an HSK size with or without its form letter', () => {
    expect(taperDesignation('HSK63A')).toEqual({ sizeClass: 63, family: 'hsk' })
    expect(taperDesignation('HSK100A')).toEqual({ sizeClass: 100, family: 'hsk' })
    expect(taperDesignation('HSK40')).toEqual({ sizeClass: 40, family: 'hsk' })
  })

  it('refuses a prefix nobody has written down rather than skipping the check', () => {
    expect(() => taperDesignation('SK40')).toThrow(ScraperConfigError)
    expect(() => taperDesignation('SK40')).toThrow(/TAPER_PREFIXES/)
  })
})

describe('the profile gates', () => {
  const good: HolderProfile = {
    catalogNumber: 'BT30ER16060M',
    datum: 'gage-line',
    points: [
      [-48.4, 8.5],
      [60, 11.5],
    ],
    gaugeLengthSolved: 60,
    gaugeLengthPublished: 60,
    sizeClass: 30,
    taperFamily: 'iso7x24',
    complete: true,
  }

  it('passes a profile that agrees with the row', () => {
    expect(() => checkProfile(good, 'BT30')).not.toThrow()
  })

  it('refuses a profile too short to draw', () => {
    expect(() => checkProfile({ ...good, points: [[-1, 1]] }, 'BT30')).toThrow(
      /at least two points/,
    )
  })

  it('refuses z running backwards', () => {
    const points = [...good.points].reverse()
    expect(() => checkProfile({ ...good, points }, 'BT30')).toThrow(/not ascending/)
  })

  it('allows two points sharing one z, which is a step face', () => {
    const points: HolderProfile['points'] = [
      [-48.4, 8.5],
      [10, 20],
      [10, 12],
      [60, 11.5],
    ]
    expect(() => checkProfile({ ...good, points }, 'BT30')).not.toThrow()
  })

  it('refuses a negative radius', () => {
    const points: HolderProfile['points'] = [
      [-48.4, -1],
      [60, 11.5],
    ]
    expect(() => checkProfile({ ...good, points }, 'BT30')).toThrow(/negative radius/)
  })

  it('refuses a gage line outside the part', () => {
    const points: HolderProfile['points'] = [
      [1, 8.5],
      [60, 11.5],
    ]
    expect(() => checkProfile({ ...good, points }, 'BT30')).toThrow(/the datum was not applied/)
  })

  it('does not ask a nose-datumed profile to straddle zero', () => {
    const points: HolderProfile['points'] = [
      [-108.4, 8.5],
      [0, 11.5],
    ]
    expect(() =>
      checkProfile({ ...good, datum: 'nose', gaugeLengthSolved: null, points }, 'BT30'),
    ).not.toThrow()
  })

  it('refuses a model whose taper is not the one the row declares', () => {
    // The replacement for the reference implementation's `sizeClass == 30`,
    // which was true of a BT30-only catalog and is not of one with CAT50 and
    // nine HSK sizes in it.
    expect(() => checkProfile({ ...good, sizeClass: 40 }, 'BT30')).toThrow(VendorResponseError)
    expect(() => checkProfile({ ...good, taperFamily: 'hsk' }, 'BT30')).toThrow(
      /declares BT30 .* measures size 30 \/ hsk/,
    )
    // An HSK40 and an ISO40 are both 40 and otherwise nothing alike, so a
    // matching size alone must not satisfy it.
    expect(() => checkProfile({ ...good, sizeClass: 40, taperFamily: 'hsk' }, 'BT40')).toThrow(
      VendorResponseError,
    )
    expect(() =>
      checkProfile({ ...good, sizeClass: 40, taperFamily: 'hsk' }, 'HSK40E'),
    ).not.toThrow()
  })

  it('refuses a model that found no taper at all on a row that declares one', () => {
    expect(() => checkProfile({ ...good, sizeClass: null, taperFamily: null }, 'BT30')).toThrow(
      VendorResponseError,
    )
  })
})

describe('building the document', () => {
  it('agrees with the vendor to nanometres where the model is complete', () => {
    const document = buildProfiles([measured('BT30ER16060M')], [ER16])

    expect(document.profilesVersion).toBe(PROFILES_VERSION)
    expect(document.unit).toBe('millimeters')
    expect(document.kernelVersion).toBe('0.7.2')
    expect(document.options).toEqual({ tolerance: 0.05, fillBays: false, flipped: false })
    expect(document.holderCount).toBe(1)

    const profile = document.holders[ER16.guid]!
    expect(profile.catalogNumber).toBe('BT30ER16060M')
    expect(profile.datum).toBe('gage-line')
    expect(profile.gaugeLengthSolved).toBe(60)
    expect(profile.gaugeLengthPublished).toBe(60)
    expect(profile.complete).toBe(true)
    expect(profile).not.toHaveProperty('shortfallMm')
  })

  it('calls the 0.355 mm nose lip complete, because it is real material', () => {
    // The vendor measures `L1` to the nose face; this model carries 0.355 mm of
    // holder past it that its 16 mm sibling does not have. Explained, and well
    // inside the tolerance.
    const profile = Object.values(buildProfiles([measured('BT30HC14100M')], [HC14]).holders)[0]!
    expect(profile.gaugeLengthSolved).toBe(100.355)
    expect(profile.gaugeLengthPublished).toBe(100)
    expect(profile.complete).toBe(true)
    expect(GAUGE_TOLERANCE_MM).toBeGreaterThan(0.355)
  })

  it('records the missing BTKV30 collet nut as a shortfall and never invents it', () => {
    const profile = Object.values(buildProfiles([measured('BTKV30ER16100M')], [BTKV]).holders)[0]!
    expect(profile.gaugeLengthSolved).toBe(89.4)
    expect(profile.gaugeLengthPublished).toBe(100)
    expect(profile.complete).toBe(false)
    expect(profile.shortfallMm).toBe(10.6)
    // Nothing was added to close the gap: the stack still ends where the model
    // does.
    expect(profile.points[profile.points.length - 1]![0]).toBe(89.4)
  })

  it('keys by guid and orders by catalog number', () => {
    const document = buildProfiles(
      [measured('BTKV30ER16100M'), measured('BT30ER16060M')],
      [ER16, BTKV],
    )
    expect(Object.keys(document.holders)).toEqual([ER16.guid, BTKV.guid])
    expect(document.holderCount).toBe(2)
  })

  it('converts an inch holder’s published L1 before comparing it', () => {
    // A shape measures what it measures: the API works in mm whatever the
    // family's unit is, so the cross-check is against `gaugeLengthMm`.
    const inch = holder('BT30ER16060M', '1258023', 2.362, { unit: 'inches' })
    expect(inch.gaugeLengthMm).toBeCloseTo(59.9948, 4)
    const profile = Object.values(buildProfiles([measured('BT30ER16060M')], [inch]).holders)[0]!
    expect(profile.gaugeLengthPublished).toBeCloseTo(59.9948, 4)
    expect(profile.complete).toBe(true)
  })

  it('refuses a measurement matching no scraped holder', () => {
    // A family measured and then renamed or dropped. Omitting it silently would
    // look exactly like a holder the vendor publishes no model for.
    expect(() => buildProfiles([measured('BT30ER16060M')], [BTKV])).toThrow(
      /matches no scraped kennametal holder/,
    )
  })

  it('joins on the brand as well as the catalog number', () => {
    // The two live in two `stepDir`s and have never had to be distinct from
    // each other.
    const other = { ...ER16, brand: 'regofix' } as HolderRecord
    expect(() => buildProfiles([measured('BT30ER16060M')], [other])).toThrow(
      /matches no scraped kennametal holder/,
    )
  })

  it('refuses one catalog number claimed by two holders', () => {
    const twin = holder('BT30ER16060M', '9999999', 60)
    expect(() => buildProfiles([measured('BT30ER16060M')], [ER16, twin])).toThrow(
      /publishes it twice/,
    )
  })

  it('refuses a batch that spans two kernel versions', () => {
    expect(() =>
      buildProfiles(
        [measured('BT30ER16060M'), measured('BTKV30ER16100M', { kernelVersion: '0.8.0' })],
        [ER16, BTKV],
      ),
    ).toThrow(/one document states one kernel version/)
  })

  it('refuses a batch that spans two sets of import options', () => {
    // A drawing profile and a collision envelope are both correct and are not
    // the same document.
    expect(() =>
      buildProfiles(
        [
          measured('BT30ER16060M'),
          measured('BTKV30ER16100M', {
            options: { tolerance: 0.05, fillBays: true, flipped: false },
          }),
        ],
        [ER16, BTKV],
      ),
    ).toThrow(/one document states one set of options/)
  })

  it('refuses an empty batch rather than writing a document covering nothing', () => {
    expect(() => buildProfiles([], [ER16])).toThrow(ScraperConfigError)
  })
})
