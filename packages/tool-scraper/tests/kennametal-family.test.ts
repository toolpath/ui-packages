/**
 * Tests for the family page — the one thing on Kennametal's platform that
 * states a product line.
 *
 * The markup below is trimmed from real pages fetched on 2026-09-01, one per
 * AEM host, and the two `h1` strings are byte-for-byte what those pages
 * served: `KenCut&trade; FF • …` and `VariMill&trade; Chip Splitters • …`. The
 * entity is the point of keeping them verbatim — a title that reached the CSV
 * as `KenCut&trade; FF` is exactly what `decodeEntities` is on for.
 */

import { describe, expect, it } from 'vitest'

import { VendorResponseError } from '../src/errors.js'
import {
  FAMILY_SLUG,
  fetchFamily,
  familyPageUrl,
  parseFamilyPage,
  productLineOf,
} from '../src/vendors/kennametal/family.js'
import { asFetcher, stub } from './stubs.js'

const KENCUT = `
<div class="product-title">
  <h1>KenCut&trade; FF &bull; HPFT &bull; Square End &bull; 6 Flutes &bull; Plain Shank &bull; Inch</h1>
</div>
<div class="product-subtitle"><h2>Solid Carbide End Mill for Finishing of Steels</h2></div>
<div class="product-info d-none" data-product-code="100003783"></div>
`

const VARIMILL = `
<h1>VariMill&trade; Chip Splitters &bull; Radiused &bull; 5 Flutes &bull; 3 x D &bull; Plain Shank &bull; Metric</h1>
<div class="product-info d-none" data-product-code="103354322"></div>
`

describe('familyPageUrl', () => {
  it('builds the page URL per brand, off the code alone', () => {
    expect(familyPageUrl('100003783')).toBe(
      `https://www.kennametal.com/us/en/products/fam.${FAMILY_SLUG}.100003783.html`,
    )
    expect(familyPageUrl('103354322', 'widia')).toBe(
      `https://www.widia.com/us/en/products/fam.${FAMILY_SLUG}.103354322.html`,
    )
  })

  // The vendor's own links carry a human-readable slug and AEM ignores it, but
  // the *segment* is load-bearing: `fam.<code>.html` 301s. Nothing in
  // `families/kennametal.ts` records a slug, so a placeholder is the only way
  // a family page is reachable from a family code.
  it('keeps a slug segment even though it names nothing', () => {
    expect(familyPageUrl('1')).toContain(`fam.${FAMILY_SLUG}.1.html`)
    expect(FAMILY_SLUG).not.toBe('')
  })
})

describe('parseFamilyPage', () => {
  it('reads the title with its entities decoded, and the page code', () => {
    expect(parseFamilyPage(KENCUT)).toEqual({
      title: 'KenCut™ FF • HPFT • Square End • 6 Flutes • Plain Shank • Inch',
      code: '100003783',
    })
    expect(parseFamilyPage(VARIMILL)).toEqual({
      title: 'VariMill™ Chip Splitters • Radiused • 5 Flutes • 3 x D • Plain Shank • Metric',
      code: '103354322',
    })
  })

  it('does not take the subtitle for the title', () => {
    expect(parseFamilyPage(KENCUT).title).not.toContain('Solid Carbide End Mill for Finishing')
  })

  it('collapses whitespace the way every other cell here is collapsed', () => {
    expect(parseFamilyPage('<h1>\n  GOdrill™   •  3 x D \n</h1>').title).toBe('GOdrill™ • 3 x D')
  })

  it('answers empty rather than throwing on a page with no heading', () => {
    expect(parseFamilyPage('<div>no heading here</div>')).toEqual({ title: '', code: null })
  })
})

describe('productLineOf', () => {
  it('is the leading segment of the vendor own punctuation', () => {
    expect(productLineOf('KenCut™ FF • HPFT • Square End • Inch')).toBe('KenCut™ FF')
    expect(productLineOf('HARVI™ I TE • Ball Nose • 4 Flutes')).toBe('HARVI™ I TE')
  })

  // A title is its own line when the vendor wrote no separator — there is
  // nothing to split and the whole string is the name.
  it('is the whole title when there is no separator', () => {
    expect(productLineOf('GOmill PRO')).toBe('GOmill PRO')
  })

  it('is empty for an empty title, so the caller can answer null', () => {
    expect(productLineOf('')).toBe('')
  })
})

describe('fetchFamily', () => {
  it('answers the title and its leading segment', async () => {
    const fetcher = asFetcher({ text: () => Promise.resolve(KENCUT) })
    await expect(fetchFamily(fetcher, '100003783')).resolves.toEqual({
      title: 'KenCut™ FF • HPFT • Square End • 6 Flutes • Plain Shank • Inch',
      productLine: 'KenCut™ FF',
    })
  })

  // The URL is built from a code alone, so a retired code answers *some* page
  // rather than a 404. Reading a title off it would name the wrong product
  // line for every row of a table — silently, and for the whole family.
  it('refuses a page that states a different family code', async () => {
    const fetcher = asFetcher({ text: () => Promise.resolve(VARIMILL) })
    await expect(fetchFamily(fetcher, '100003783')).rejects.toThrow(VendorResponseError)
    await expect(fetchFamily(fetcher, '100003783')).rejects.toThrow(/103354322/)
  })

  // A family the vendor publishes without a heading is still a table of real
  // parts. Null is the answer, never `''` — see `records.ToolRecord.productLine`.
  it('answers a null line for a page with no heading', async () => {
    const fetcher = asFetcher({ text: () => Promise.resolve('<div data-product-code="1"></div>') })
    await expect(fetchFamily(fetcher, '1')).resolves.toEqual({ title: '', productLine: null })
  })

  it('reads through the fetcher and nothing else', async () => {
    await expect(fetchFamily(stub(), '1')).rejects.toThrow(/unused/)
  })
})
