/**
 * The vendor CAD lookup: payload -> URL, and rows -> annotated rows.
 *
 * The corpus cases the Python carried — every scraped URL naming the row it
 * sits on, every holder having a model — read scraped CSVs and arrive with the
 * corpus harness. What is here is the parsing and the annotation step, which
 * run against literals.
 *
 * The bulk STEP mirror is deliberately not tested here because it is
 * deliberately not in this module: it writes files, it is a maintainer's batch
 * job, and it lives behind the CLI in `node/`.
 */

import { describe, expect, it, vi } from 'vitest'

import { CAD_COLUMN } from '../src/conventions.js'
import { HttpError } from '../src/fetch.js'
import type { ScrapeResult } from '../src/scrape.js'
import {
  LIGHTWEIGHT_STEP,
  annotateCadUrls,
  lightweightStepUrl,
  type CadPayload,
} from '../src/vendors/kennametal/cad.js'
import { asFetcher, stub } from './stubs.js'

const LWM = 'https://cdn.example.test/kmt/1258023-lwm.stp'
const GTM = 'https://cdn.example.test/kmt/1258023-gtm.stp'

/** A fetcher answering the CAD endpoint from a material -> payload map. */
function cadApi(payloads: Record<string, unknown>) {
  const asked: string[] = []
  const fetcher = asFetcher({
    json: vi.fn(async (url: string) => {
      const id = new URL(url).searchParams.get('id') ?? ''
      asked.push(id)
      return payloads[id] ?? { cadAvailable: false }
    }),
  })
  return { fetcher, asked }
}

/** A holder scrape of `count` rows, material numbers `1`..`count`. */
function holders(count: number): ScrapeResult {
  return {
    header: ['Material Number', 'ISO Catalog Number'],
    rows: Array.from({ length: count }, (_, i) => ({
      'Material Number': String(i + 1),
      'ISO Catalog Number': `BT30ER1606${i}M`,
    })),
    source: 'https://example.test',
    familyCode: '1',
  }
}

describe('reading a CAD payload', () => {
  it('takes the lightweight STEP', () => {
    // Not the full graphical model sitting beside it in the same payload.
    expect(
      lightweightStepUrl({
        cadAvailable: true,
        staticURLs: { [LIGHTWEIGHT_STEP]: LWM, 'stp-gtm': GTM },
      }),
    ).toBe(LWM)
  })

  it.each([
    [{ cadAvailable: false, staticURLs: { [LIGHTWEIGHT_STEP]: LWM } }, 'not available'],
    [{ cadAvailable: true, staticURLs: {} }, 'no static URLs'],
    [{ cadAvailable: true }, 'no staticURLs key at all'],
    [{ cadAvailable: true, staticURLs: { 'stp-gtm': GTM } }, 'only the heavy model'],
    [{ cadAvailable: true, staticURLs: { [LIGHTWEIGHT_STEP]: '' } }, 'an empty URL'],
    [{ cadAvailable: true, staticURLs: { [LIGHTWEIGHT_STEP]: 42 } }, 'a non-string'],
  ] as [CadPayload, string][])('reads a payload with %#: %s as null', (payload) => {
    // Null is a real state — the vendor's own UI has a "request a model" case
    // — and a consumer renders it as an absence rather than a dead link.
    expect(lightweightStepUrl(payload)).toBeNull()
  })
})

describe('annotating a scrape', () => {
  it.each([0, 1, 2, 12])('gives every row a column at %i rows', async (count) => {
    const payloads = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        String(i + 1),
        { cadAvailable: true, staticURLs: { [LIGHTWEIGHT_STEP]: LWM } },
      ]),
    )
    const { fetcher } = cadApi(payloads)

    const { scrape, found } = await annotateCadUrls(fetcher, holders(count), 0)

    expect(found).toBe(count)
    expect(scrape.rows).toHaveLength(count)
    for (const row of scrape.rows) expect(row[CAD_COLUMN]).toBe(LWM)
    if (count > 0) expect(scrape.header).toContain(CAD_COLUMN)
  })

  it('keeps a row with no model in place, with an empty cell', async () => {
    // Dropping the row would delete a holder that really exists, and counting
    // it would report a model this package cannot offer.
    const { fetcher } = cadApi({
      '1': { cadAvailable: true, staticURLs: { [LIGHTWEIGHT_STEP]: LWM } },
      '2': { cadAvailable: false },
    })

    const { scrape, found } = await annotateCadUrls(fetcher, holders(2), 0)

    expect(found).toBe(1)
    expect(scrape.rows.map((r) => r[CAD_COLUMN])).toEqual([LWM, ''])
    expect(scrape.rows).toHaveLength(2)
  })

  it('rebuilds the column on a re-run instead of duplicating it', async () => {
    const { fetcher } = cadApi({
      '1': { cadAvailable: true, staticURLs: { [LIGHTWEIGHT_STEP]: LWM } },
    })

    const once = await annotateCadUrls(fetcher, holders(1), 0)
    const twice = await annotateCadUrls(fetcher, once.scrape, 0)

    expect(twice.scrape.header).toEqual(once.scrape.header)
    expect(twice.scrape.header.filter((c) => c === CAD_COLUMN)).toHaveLength(1)
  })

  it('asks for each row’s own material number', async () => {
    const { fetcher, asked } = cadApi({})

    await annotateCadUrls(fetcher, holders(3), 0)

    expect(asked).toEqual(['1', '2', '3'])
  })

  it('reads a 404 as "the vendor publishes none" and keeps going', async () => {
    // A row that finds no model keeps an empty cell and is never dropped. A
    // 404 used to throw out of the loop and abandon the file part-annotated,
    // past the CLI's catch and onto a stack trace.
    const fetcher = stub({
      json: (url: string) =>
        url.includes('id=1')
          ? Promise.reject(new HttpError(url, 404))
          : Promise.resolve({ cadAvailable: true, staticURLs: { [LIGHTWEIGHT_STEP]: LWM } }),
    })

    const { scrape, found } = await annotateCadUrls(fetcher, holders(2), 0)

    expect(found).toBe(1)
    expect(scrape.rows).toHaveLength(2)
    expect(scrape.rows[0]?.[CAD_COLUMN]).toBe('')
    expect(scrape.rows[1]?.[CAD_COLUMN]).toBe(LWM)
  })

  it('still stops the run on any other status', async () => {
    // A 500 is a failed request, not a vendor saying it has no model.
    const fetcher = stub({ json: (url: string) => Promise.reject(new HttpError(url, 500)) })

    await expect(annotateCadUrls(fetcher, holders(2), 0)).rejects.toThrow(HttpError)
  })

  it('does nothing at all to an empty scrape', async () => {
    const { fetcher, asked } = cadApi({})

    const { scrape, found } = await annotateCadUrls(fetcher, holders(0), 0)

    expect(found).toBe(0)
    expect(asked).toEqual([])
    // No column is added: there is no row to carry one, and adding a header
    // for zero rows would claim a lookup that never ran.
    expect(scrape.header).not.toContain(CAD_COLUMN)
  })
})
