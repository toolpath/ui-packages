/**
 * EMUGE-FRANKEN rows -> records, one part per kind.
 *
 * The rows are built by the adapter's own `variantRow` rather than written out
 * as literals, so the column labels a record reads are the ones a scrape really
 * writes — a literal here would be a second copy of the header, updated at the
 * same time as the first, checking nothing. The payloads are trimmed from live
 * responses on 2026-09-01.
 *
 * Every case goes through `registry.toRecords`, which is what runs
 * `checkIdentityColumns` and `checkColumnsExist` before the first row: a family
 * whose column map names a label the scrape does not write fails here, naming
 * the family.
 */

import { describe, expect, it } from 'vitest'

import { RECORD_GEOMETRY, UNSPECIFIED } from '../src/records.js'
import { toRecords } from '../src/registry.js'
import { unionHeader, type ScrapeResult, type ScrapedRow } from '../src/scrape.js'
import { PRODUCT_LINES, PRODUCT_LINE_COLUMNS } from '../src/vendors/emuge/records.js'
import { variantRow } from '../src/vendors/emuge/scrape.js'
import { VendorResponseError } from '../src/errors.js'

interface Property {
  property: string
  value: string
}

function scrapeOf(rows: ScrapedRow[]): ScrapeResult {
  return { header: unionHeader(rows), rows, source: 'test', familyCode: null }
}

/* ------------------------------------------------------------------ end mill */

const MILL_GROUP = {
  code: 'H301025',
  productListInfo: 'Solid carbide end mill with corner radius, long, type N.',
  technicalDetails: [
    { property: 'category', value: 'End Mill' },
    { property: 'version', value: 'Corner Radius' },
  ] as Property[],
}

function millVariant(neck: boolean): {
  code: string
  articleCode: string
  dimensionFeatureValue: string
  mainDrawing: { technicalDetails: Property[] }
} {
  return {
    code: neck ? '000000000010261509' : '000000000010261378',
    articleCode: neck ? '2998L.012015' : '2998L.012010',
    dimensionFeatureValue: neck ? 'Ø1/8 / R0.015' : 'Ø1/8 / R0.010',
    mainDrawing: {
      technicalDetails: [
        { property: 'cutting diameter Ød₁ [inch]', value: '1/8 "' },
        { property: 'shank diameter Ød₂ [inch]', value: neck ? '1/4 "' : '1/8 "' },
        { property: 'cutting length l₂ [inch]', value: '3/8 "' },
        { property: 'overall length l₁', value: '1 1/2 "' },
        { property: 'radius r₁ [inch]', value: '0.01 "' },
        ...(neck
          ? [
              { property: 'neck diameter Ød₃', value: '0.118 "' },
              { property: 'neck length l₃ [inch]', value: '0.75 "' },
            ]
          : []),
      ],
    },
  }
}

function millDetail(code: string, flutes: string) {
  return {
    code,
    technicalDetails: [
      { property: 'number of flutes Z', value: flutes },
      // Milling states its product line per part rather than on the group —
      // the grouped listing publishes none at all. See `PRODUCT_LINE_COLUMNS`.
      { property: 'product line', value: 'FRANKEN TOP-Cut VAR' },
      { property: 'Cutting material', value: 'carbide' },
      { property: 'coating', value: 'ALCR' },
      { property: 'internal coolant supply', value: 'Without internal cooling' },
    ] as Property[],
    applicationMaterials: [{ code: 'S' }, { code: 'P' }, { code: 'H' }],
  }
}

function millRow(neck: boolean, flutes = '4'): ScrapedRow {
  const variant = millVariant(neck)
  return variantRow(MILL_GROUP, variant, millDetail(variant.code, flutes), 'inches')
}

/**
 * A plain part and a necked one, which is the smallest end mill scrape the
 * family's column map can be checked against.
 *
 * `records.checkColumnsExist` is a **family**-level gate: it asks whether the
 * CSV carries every mapped column, not whether a given row fills it. EMUGE
 * publishes `neck length l₃` and `neck diameter Ød₃` on its necked lines only,
 * so a scrape of plain parts alone maps two columns the header does not have —
 * and the failure names the family, which is the point. The real inch and
 * metric families both hold necked lines.
 */
function millScrape(...rows: ScrapedRow[]): ScrapeResult {
  return scrapeOf([...rows, millRow(true)])
}

/* --------------------------------------------------------------------- drill */

const DRILL_GROUP = {
  code: 'H109070',
  productListInfo: 'Solid carbide twist drill, 5xD, with internal coolant supply.',
  technicalDetails: [
    { property: 'Specification', value: 'Twist drill' },
    { property: 'Length standard', value: '5xD DIN 6537L' },
    { property: 'Number of margins', value: '4' },
    // Drilling and tapping state the line on the *group*, under a geometry
    // code — `MULTI` here, which the vendor's own article page calls
    // MultiDRILL.
    { property: 'Geometry', value: 'MULTI' },
  ] as Property[],
}

const DRILL_VARIANT = {
  code: '000000000010727835',
  articleCode: 'TA219744.0300',
  dimensionFeatureValue: 'd1=3,0',
  mainDrawing: {
    technicalDetails: [
      { property: 'nominal diameter d₁ [mm]', value: '3 mm' },
      { property: 'Shank diameter d₂', value: '6 mm' },
      { property: 'Overall length l₁', value: '66 mm' },
      { property: 'Flute length l₂', value: '28 mm' },
      { property: 'usable length l₃', value: '23 mm' },
      { property: 'Center length l₅', value: '0.546 mm' },
    ] as Property[],
  },
}

const DRILL_DETAIL = {
  code: DRILL_VARIANT.code,
  technicalDetails: [
    { property: 'nominal diameter d₁ [in]', value: '0.1181 "' },
    { property: 'Coolant supply', value: 'internal coolant supply' },
    { property: 'point angle', value: '140 deg' },
    { property: 'Coating', value: 'TIALN-T63' },
    { property: 'Cutting material', value: 'carbide' },
    { property: 'shank diameter tolerance', value: 'h6' },
  ] as Property[],
  applicationMaterials: [{ code: 'P' }, { code: 'M' }, { code: 'K' }, { code: 'N' }],
}

const drillRow = (): ScrapedRow =>
  variantRow(DRILL_GROUP, DRILL_VARIANT, DRILL_DETAIL, 'millimeters')

/* ----------------------------------------------------------------------- tap */

const TAP_GROUP = {
  code: 'H100331',
  productListInfo: 'HSSE-PM machine tap, straight flutes with spiral point.',
  technicalDetails: [
    { property: 'chamfer form', value: 'Form B (Plug)' },
    { property: 'thread orientation', value: 'internal' },
    { property: 'Geometry', value: 'Z' },
  ] as Property[],
}

const TAP_VARIANT = {
  code: '000000000010565149',
  articleCode: 'BU20A601.5003',
  dimensionFeatureValue: 'Nr.4-40 UNC-2BX',
  mainDrawing: {
    technicalDetails: [
      { property: 'nominal diameter d₁ [mm]', value: '2.845 mm' },
      { property: 'Shank diameter d₂', value: '3.581 mm' },
      { property: 'Overall length l₁', value: '56 mm' },
      { property: 'length of cutting edge l₂', value: '6 mm' },
      { property: 'usable length l₃', value: '18 mm' },
      { property: 'square ◘', value: '2.79 mm' },
    ] as Property[],
  },
}

const TAP_DETAIL = {
  code: TAP_VARIANT.code,
  technicalDetails: [
    { property: 'thread symbol', value: 'UNC' },
    { property: 'pitch [mm]', value: '0.635 mm' },
    { property: 'threads per inch', value: '40' },
    { property: 'nominal size', value: '#4' },
    { property: 'coolant supply', value: 'Without' },
    { property: 'Coating', value: 'GLT-1' },
    { property: 'Cutting material', value: 'HSSE-PM' },
  ] as Property[],
  applicationMaterials: [{ code: 'P' }, { code: 'M' }],
}

const tapRow = (): ScrapedRow => variantRow(TAP_GROUP, TAP_VARIANT, TAP_DETAIL, 'millimeters')

/* ------------------------------------------------------------------ form tap */

/**
 * A cold-forming tap out of `FG02`, trimmed from the live responses on
 * 2026-09-07.
 *
 * The same part number in the same thread as {@link TAP_VARIANT} would be too
 * neat to be evidence, so this is the real `Nr.4-40 UNC-2BX` former EMUGE sells
 * beside it — `BU37Z700.5003`, out of the `US-InnoForm 1-Z-SN-PM-TIN-80` group.
 * Note what it shares with the cutting tap above and what it does not: an
 * identical dimension table down to the column labels, the same `Geometry: Z`,
 * the same `#4` at 40 TPI — and `lead taper form` where the cutting tap states
 * `chamfer form`. Nothing but the category tells the two apart, which is the
 * whole reason `threadMethod` exists.
 */
const FORM_TAP_GROUP = {
  code: 'H102080',
  productListInfo: 'EMUGE-Z style cold forming tap, (UNC, UNF threads).',
  technicalDetails: [
    { property: 'lead taper form', value: 'Form C (Semi-Bottoming)' },
    { property: 'thread orientation', value: 'internal' },
    { property: 'Geometry', value: 'Z' },
  ] as Property[],
}

const FORM_TAP_VARIANT = {
  code: '000000000010563370',
  articleCode: 'BU37Z700.5003',
  dimensionFeatureValue: 'Nr.4-40 UNC-2BX',
  mainDrawing: {
    technicalDetails: [
      { property: 'nominal diameter d₁ [mm]', value: '2.845 mm' },
      { property: 'Shank diameter d₂', value: '3.581 mm' },
      { property: 'Overall length l₁', value: '56 mm' },
      // The vendor's own label on a tool with no cutting edge. It reaches the
      // CSV as published — see `families/emuge.ts`'s `TAP_COLUMNS`.
      { property: 'length of cutting edge l₂', value: '6 mm' },
      { property: 'usable length l₃', value: '18 mm' },
      { property: 'square ◘', value: '2.79 mm' },
    ] as Property[],
  },
}

const FORM_TAP_DETAIL = {
  code: FORM_TAP_VARIANT.code,
  technicalDetails: [
    { property: 'thread symbol', value: 'UNC' },
    { property: 'pitch [mm]', value: '0.635 mm' },
    { property: 'threads per inch', value: '40' },
    { property: 'nominal size', value: '#4' },
    { property: 'coolant supply', value: 'Without' },
    { property: 'lead taper form', value: 'Form C (Semi-Bottoming)' },
    { property: 'Coating', value: 'TIN-80' },
    { property: 'Cutting material', value: 'HSSE-PM' },
  ] as Property[],
  applicationMaterials: [{ code: 'P' }, { code: 'K' }, { code: 'N' }],
}

const formTapRow = (): ScrapedRow =>
  variantRow(FORM_TAP_GROUP, FORM_TAP_VARIANT, FORM_TAP_DETAIL, 'millimeters')

/* --------------------------------------------------------------------- tests */

describe('an end mill', () => {
  const [record] = toRecords('emuge_end_mills_inch.csv', millScrape(millRow(false)))

  it('is minted in this brand’s own namespace, from the SAP material number', () => {
    expect(record?.brand).toBe('emuge')
    expect(record?.vendor).toBe('EMUGE-FRANKEN')
    expect(record?.materialNumber).toBe('000000000010261378')
    expect(record?.catalogNumber).toBe('2998L.012010')
    expect(record?.guid).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reads a fractional inch as a number, in the family’s declared unit', () => {
    expect(record?.unit).toBe('inches')
    expect(record?.geometry.DC).toBe(0.125)
    expect(record?.geometry.LCF).toBe(0.375)
    expect(record?.geometry.OAL).toBe(1.5)
    expect(record?.geometry.RE).toBe(0.01)
  })

  it('falls back to the flute length and the cutting diameter on a plain shank', () => {
    expect(record?.geometry['shoulder-length']).toBe(record?.geometry.LCF)
    expect(record?.geometry['shoulder-diameter']).toBe(record?.geometry.DC)
  })

  it('reads the neck where the vendor publishes one', () => {
    const [, necked] = toRecords('emuge_end_mills_inch.csv', millScrape(millRow(false)))

    expect(necked?.geometry['shoulder-length']).toBe(0.75)
    expect(necked?.geometry['shoulder-diameter']).toBe(0.118)
  })

  it('takes the flute count from the part’s own record', () => {
    expect(record?.geometry.NOF).toBe(4)
  })

  it('omits the flute count where the vendor publishes its sentinel, and says so', () => {
    // 64 end mill variants answer `999`, which is not a count.
    const said: string[] = []
    const [odd] = toRecords('emuge_end_mills_inch.csv', millScrape(millRow(false, '999')), {
      warn: (m) => said.push(m),
    })

    expect(odd?.geometry.NOF).toBeUndefined()
    expect(said.join('\n')).toContain('999')
  })

  it('carries the vendor’s free text, and never its catalog number', () => {
    expect(record?.description).toBe(MILL_GROUP.productListInfo)
    expect(record?.description).not.toContain(record!.catalogNumber)
  })

  it('reorders the vendor’s material index onto ISO 513’s own order', () => {
    // The vendor answered S, P, H.
    expect(record?.materialGroups).toEqual(['P', 'S', 'H'])
    expect(record?.materialGroupsSource).toBe('vendor-stated')
  })

  it('records the coating raw and the substrate in this package’s vocabulary', () => {
    expect(record?.coating).toBe('ALCR')
    expect(record?.substrate).toBe('carbide')
    expect(record?.coolantThrough).toBe(false)
  })
})

describe('a drill', () => {
  const [record] = toRecords('emuge_drills.csv', scrapeOf([drillRow()]))

  it('reads the point angle the vendor states, rather than assuming one', () => {
    // The only drill family in this package that does. Kennametal's two lines
    // assume theirs or derive them from a point length.
    expect(record?.geometry.SIG).toBe(140)
  })

  it('omits the point angle where the vendor left the cell empty, and says so', () => {
    // One of FB01's 2,670 variants publishes no point angle. `SIG` is a mapped
    // column here rather than a fact, so before it moved to
    // `RECORD_GEOMETRY.drill.sometimes` that one blank cell threw — and
    // `toRecords` maps a family's rows together, so it took the other 2,669
    // drills with it.
    const said: string[] = []
    const [blank] = toRecords(
      'emuge_drills.csv',
      scrapeOf([{ ...drillRow(), 'point angle': '' }]),
      {
        warn: (m) => said.push(m),
      },
    )

    expect(blank?.geometry.SIG).toBeUndefined()
    expect(blank?.geometry.DC).toBe(3)
    expect(said.join('\n')).toContain(DRILL_VARIANT.code)
    expect(said.join('\n')).toContain('no point angle')
  })

  it('omits the point angle where the row carries no such key, and keeps the family', () => {
    // Part `000000000010727800` is the one whose *detail* record is nearly
    // empty: its variant states every dimension, and the detail publishes no
    // `point angle` property at all — so the row has no such **key**, where
    // the case above has the key and an empty value.
    //
    // `cell` answers `undefined` for both an absent key and an unmapped
    // column, and `angle` read that as the column map having changed: a
    // `VendorResponseError`, which is exactly the refusal `toRecords` does
    // *not* skip. One incomplete part therefore cost all 2,670 drills, and the
    // scrape receipt blamed a column map that was perfectly correct.
    //
    // Two rows, because the header is the union of them: the complete one is
    // what makes `point angle` a column the family maps and the scrape writes,
    // which is the state `checkColumnsExist` sees in a real run.
    const bare = variantRow(
      DRILL_GROUP,
      { ...DRILL_VARIANT, code: '000000000010727800', articleCode: 'TA219744.0301' },
      {
        ...DRILL_DETAIL,
        code: '000000000010727800',
        technicalDetails: DRILL_DETAIL.technicalDetails.filter(
          (each) => each.property !== 'point angle',
        ),
      },
      'millimeters',
    )

    const said: string[] = []
    const records = toRecords('emuge_drills.csv', scrapeOf([drillRow(), bare]), {
      warn: (m) => said.push(m),
    })

    expect(records).toHaveLength(2)
    expect(records[0]?.geometry.SIG).toBe(140)
    expect(records[1]?.geometry.SIG).toBeUndefined()
    // The dimensions the variant did publish still arrive.
    expect(records[1]?.geometry.DC).toBe(3)
    expect(said.join('\n')).toContain('no point angle')
  })

  it('takes the flute count from the family fact, which the vendor states nowhere', () => {
    expect(record?.geometry.NOF).toBe(2)
  })

  it('is millimetres throughout', () => {
    expect(record?.unit).toBe('millimeters')
    expect(record?.geometry.DC).toBe(3)
    expect(record?.geometry.SFDM).toBe(6)
    expect(record?.geometry.OAL).toBe(66)
    expect(record?.geometry.LCF).toBe(28)
  })

  it('reads the drilling coolant vocabulary, which is not the milling one', () => {
    expect(record?.coolantThrough).toBe(true)
  })

  it('carries the ferrous claim its family states', () => {
    expect(record?.nonFerrous).toBe(false)
    expect(record?.materialGroups).toEqual(['P', 'M', 'K', 'N'])
  })
})

describe('a tap', () => {
  const [record] = toRecords('emuge_taps.csv', scrapeOf([tapRow()]))

  it('is millimetres even on an inch thread, because that is what was published', () => {
    // A `#4-40 UNC` tap. The vendor states 2.845 mm and 0.635 mm; neither is a
    // conversion this package made.
    expect(record?.unit).toBe('millimeters')
    expect(record?.geometry.DC).toBe(2.845)
    expect(record?.geometry.TP).toBe(0.635)
    expect(record?.geometry.SFDM).toBe(3.581)
  })

  it('reads the thread pitch from a column with no unit suffix', () => {
    // `records.DIMENSIONAL_COLUMNS` excludes `TP` from unit pairing, so the
    // column is `pitch` and not `pitch_mm`.
    expect(Object.keys(tapRow())).toContain('pitch')
    expect(Object.keys(tapRow())).not.toContain('pitch_mm')
  })

  it('carries no flute count, because the vendor states none anywhere', () => {
    expect(record?.geometry.NOF).toBeUndefined()
  })

  it('reads HSSE-PM as high-speed steel', () => {
    expect(record?.substrate).toBe('hss')
    expect(record?.coating).toBe('GLT-1')
    expect(record?.coolantThrough).toBe(false)
  })

  it('keeps the thread designation on the row for a consumer that needs it', () => {
    expect(tapRow()['dimensionFeatureValue']).toBe('Nr.4-40 UNC-2BX')
    expect(tapRow()['thread symbol']).toBe('UNC')
    expect(tapRow()['threads per inch']).toBe('40')
  })

  it('cuts its thread, which is what category FG01 is', () => {
    expect(record?.threadMethod).toBe('cutting')
  })
})

describe('a cold-forming tap', () => {
  const [record] = toRecords('emuge_form_taps.csv', scrapeOf([formTapRow()]))

  it('forms its thread, which is what category FG02 is', () => {
    expect(record?.threadMethod).toBe('forming')
  })

  it('is the same record shape as a cutting tap in every other respect', () => {
    // The point of the fixture, and the argument for the field. This is the
    // `Nr.4-40 UNC-2BX` former sold beside the `Nr.4-40 UNC-2BX` cutting tap
    // above, and its geometry is that tap's geometry to the last digit. A
    // consumer told to drill for one of these and handed the other drills the
    // wrong hole, and nothing else on either record would have said so.
    const [cutting] = toRecords('emuge_taps.csv', scrapeOf([tapRow()]))

    expect(record?.kind).toBe('tap')
    expect(record?.unit).toBe('millimeters')
    expect(record?.geometry).toEqual(cutting?.geometry)
    expect(record?.substrate).toBe(cutting?.substrate)
    expect(record?.threadMethod).not.toBe(cutting?.threadMethod)
  })

  it('keeps the vendor’s geometry code, because FG01’s names are not FG02’s', () => {
    // `Z` is `Rekord B-Z Taps` in the cutting catalog and InnoForm here, so
    // `PRODUCT_LINES` has no FG02 table and the code passes through as the
    // vendor's own — the documented answer for a code with no article page.
    const [cutting] = toRecords('emuge_taps.csv', scrapeOf([tapRow()]))

    expect(record?.productLine).toBe('Z')
    expect(cutting?.productLine).toBe('Rekord B-Z Taps')
  })

  it('states a lead taper where a cutting tap states a chamfer', () => {
    // The per-part evidence behind the two family facts. Both properties reach
    // the CSV; neither is mapped, and `tests/emuge-corpus.test.ts` is what
    // holds a real scrape to the same split.
    expect(formTapRow()['lead taper form']).toBe('Form C (Semi-Bottoming)')
    expect(formTapRow()['chamfer form']).toBeUndefined()
    expect(tapRow()['chamfer form']).toBe('Form B (Plug)')
    expect(tapRow()['lead taper form']).toBeUndefined()
  })
})

/* -------------------------------------------------------------- product line */

describe('the product line', () => {
  // Three categories, three columns, and each column is a facet that
  // partitions its category exactly — which is what makes this a read rather
  // than a choice between the 43 overlapping product-family pages the vendor's
  // marketing publishes. See `PRODUCT_LINE_COLUMNS`.
  it('is read verbatim from the milling column, which already names the line', () => {
    const [record] = toRecords('emuge_end_mills_inch.csv', millScrape(millRow(false)))
    expect(record?.productLine).toBe('FRANKEN TOP-Cut VAR')
  })

  // A geometry code names nothing EMUGE sells, so drilling and tapping map it
  // onto the vendor's own article-page title. Both sides are the vendor's.
  it('maps a drill geometry code onto the vendor’s own name for it', () => {
    const [record] = toRecords('emuge_drills.csv', scrapeOf([drillRow()]))
    expect(record?.productLine).toBe('MultiDRILL')
  })

  it('maps a tap geometry code the same way', () => {
    const [record] = toRecords('emuge_taps.csv', scrapeOf([tapRow()]))
    expect(record?.productLine).toBe('Rekord B-Z Taps')
  })

  it('names the column each category states its line in', () => {
    expect(PRODUCT_LINE_COLUMNS['FF01']).toBe('product line')
    expect(PRODUCT_LINE_COLUMNS['FB01']).toBe('Geometry')
    expect(PRODUCT_LINE_COLUMNS['FG01']).toBe('Geometry')
  })

  // Milling passes through because its facet is already the marketing name.
  // A table for it would be this package restating the vendor.
  it('keeps no name table for milling', () => {
    expect(PRODUCT_LINES['FF01']).toBeUndefined()
  })

  // `SPEED`, `FK`, `GAL`, `GG` and `TILEG` are real tap lines with no article
  // page on the US storefront. The vendor's own code is the honest answer, and
  // an unmapped code must never refuse a row the way an unmapped cutting
  // material does — see `productLine`.
  it('keeps a code the vendor publishes no article page for', () => {
    const group = {
      ...TAP_GROUP,
      technicalDetails: TAP_GROUP.technicalDetails.map((p) =>
        p.property === 'Geometry' ? { property: 'Geometry', value: 'SPEED' } : p,
      ),
    }
    const row = variantRow(group, TAP_VARIANT, TAP_DETAIL, 'millimeters')
    const [record] = toRecords('emuge_taps.csv', scrapeOf([row]))
    expect(record?.productLine).toBe('SPEED')
  })

  // The vendor's silence, and never `''` — `toolRecord` refuses that outright.
  it('is null where the vendor leaves the column empty', () => {
    const group = {
      ...TAP_GROUP,
      technicalDetails: TAP_GROUP.technicalDetails.map((p) =>
        p.property === 'Geometry' ? { property: 'Geometry', value: '' } : p,
      ),
    }
    const row = variantRow(group, TAP_VARIANT, TAP_DETAIL, 'millimeters')
    const [record] = toRecords('emuge_taps.csv', scrapeOf([row]))
    expect(record?.productLine).toBeNull()
  })

  // Every name on the right-hand side is a title EMUGE publishes; nothing here
  // is this package's wording. A blank one would be a name nobody stated.
  it('maps every code onto a non-empty vendor name', () => {
    for (const [category, names] of Object.entries(PRODUCT_LINES)) {
      expect(PRODUCT_LINE_COLUMNS[category]).toBeDefined()
      for (const [code, name] of Object.entries(names)) {
        expect(code, `${category} ${code}`).not.toBe('')
        expect(name, `${category} ${code}`).not.toBe('')
      }
    }
  })
})

describe('a part the vendor left incomplete', () => {
  // `000000000010270982` — a necked torus end mill whose inch variants publish
  // `length of shank connection l₄` and no `overall length l₁` at all, where
  // their metric twins in the same group publish both. Roughly 175 of FF01's
  // 7,021 variants are in that position, and because `toRecords` maps a
  // family's rows together they used to end the conversion for all of them.
  const noOal = (): ScrapedRow => {
    const variant = millVariant(false)
    return variantRow(
      MILL_GROUP,
      {
        ...variant,
        code: '000000000010270982',
        mainDrawing: {
          technicalDetails: variant.mainDrawing.technicalDetails.filter(
            (p) => p.property !== 'overall length l₁',
          ),
        },
      },
      millDetail('000000000010270982', '4'),
      'inches',
    )
  }

  it('is skipped with a warning rather than ending the family', () => {
    const warnings: string[] = []
    const records = toRecords('emuge_end_mills_inch.csv', millScrape(noOal(), millRow(false)), {
      warn: (m) => warnings.push(m),
    })

    // `millScrape` appends a necked part, so the good rows are that one and
    // the plain one; only the incomplete part is missing.
    expect(records.map((r) => r.materialNumber)).not.toContain('000000000010270982')
    expect(records).toHaveLength(2)
    expect(warnings.join('\n')).toMatch(/000000000010270982.*publishes no OAL/)
  })

  // The contract is untouched: an end mill still always has an `OAL`, and the
  // part without one is no record rather than a record with a hole.
  it('leaves OAL required for every record that is written', () => {
    const [record] = toRecords('emuge_end_mills_inch.csv', millScrape(millRow(false)), {
      warn: () => {},
    })

    expect(record?.geometry.OAL).toBeGreaterThan(0)
    expect(RECORD_GEOMETRY.endmill.always).toContain('OAL')
    expect(RECORD_GEOMETRY.endmill.sometimes).not.toContain('OAL')
  })
})

describe('what a mapper refuses', () => {
  it('refuses a cutting material it has no word for, naming the table to add to', () => {
    const row = { ...drillRow(), 'Cutting material': 'unobtainium' }

    expect(() => toRecords('emuge_drills.csv', scrapeOf([row]))).toThrow(/SUBSTRATES/)
  })

  it('refuses a coolant value outside the category’s own facet vocabulary', () => {
    const row = { ...drillRow(), 'Coolant supply': 'sometimes' }

    expect(() => toRecords('emuge_drills.csv', scrapeOf([row]))).toThrow(/COOLANT_COLUMNS/)
  })

  it('records false and warns where no coolant column is filled at all', () => {
    // A different thing from the case above: the vendor's facet does not cover
    // the whole of milling — 6,862 of FF01's 7,021 variants — so 159 parts have
    // no `internal coolant supply` value. This refused until 2026-09-01, and
    // because `toRecords` maps its rows, one such part took the whole family's
    // conversion with it rather than one row.
    const row = { ...drillRow() }
    delete row['Coolant supply']

    const said: string[] = []
    const [record] = toRecords('emuge_drills.csv', scrapeOf([row]), {
      warn: (m) => said.push(m),
    })

    expect(record?.coolantThrough).toBe(false)
    expect(said.join('\n')).toContain(DRILL_VARIANT.code)
    expect(said.join('\n')).toContain('recorded as false')
  })

  it('refuses a point angle that is a length, which an empty cell is not', () => {
    // The two halves of the same column. A blank is the vendor publishing
    // nothing and is omitted; a length where an angle belongs is the property
    // having moved under this adapter, and is worth losing the row over.
    const row = { ...drillRow(), 'point angle': '3 mm' }

    expect(() => toRecords('emuge_drills.csv', scrapeOf([row]))).toThrow(VendorResponseError)
    expect(() => toRecords('emuge_drills.csv', scrapeOf([row]))).toThrow(/not an angle/)
  })

  it('refuses a point angle stated as a range, which has no single reading', () => {
    const row = { ...drillRow(), 'point angle': '130-140 deg' }

    expect(() => toRecords('emuge_drills.csv', scrapeOf([row]))).toThrow(/not an angle/)
  })

  // The one thing in this block that is *not* refused, and the contrast is the
  // point: a blank required cell is one part the vendor left incomplete, where
  // every other case here is the vendor's vocabulary or this adapter's map
  // having moved. `toRecords` skips the first and still fails on the rest.
  it('skips rather than refuses a row whose dimension the vendor left blank', () => {
    const warnings: string[] = []
    const row = { ...drillRow(), 'Overall length l₁_mm': '' }

    const records = toRecords('emuge_drills.csv', scrapeOf([row]), {
      warn: (m) => warnings.push(m),
    })

    expect(records).toEqual([])
    expect(warnings.join('\n')).toMatch(/publishes no OAL/)
  })

  it('says it has no evidence where no detail record answered', () => {
    // `variantRow` leaves the key off entirely, which is what keeps "we do not
    // know" apart from "rated for nothing".
    const row = variantRow(MILL_GROUP, millVariant(false), undefined, 'inches')
    const withParts = {
      ...row,
      'Cutting material': 'carbide',
      'internal coolant supply': 'Without internal cooling',
    }
    const [record] = toRecords('emuge_end_mills_inch.csv', millScrape(withParts))

    expect(record?.materialGroups).toBeNull()
    expect(record?.materialGroupsSource).toBe(UNSPECIFIED)
  })
})
