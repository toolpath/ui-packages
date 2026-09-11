/**
 * The material-group sweep: one facet query per group, inverted per material
 * number, and the column it writes.
 *
 * The corpus cases the Python carried — every family CSV carrying the column,
 * taps carrying none — read scraped CSVs and arrive with the corpus harness.
 */

import { describe, expect, it, vi } from 'vitest'

import { REQUEST_DELAY_MS, type ScrapeResult } from '../src/scrape.js'
import {
  MATERIALS_COLUMN,
  MATERIAL_GROUPS,
  addMaterialGroups,
  groupsByMaterial,
  materialClasses,
  materialsInGroup,
  parseMaterialGroups,
} from '../src/vendors/kennametal/materials.js'
import { asFetcher, recordPauses } from './stubs.js'

const NO_RESULTS = '<div class="no-results"></div>'

/** A variants table listing `materialNumbers` as its data rows. */
function table(materialNumbers: string[]): string {
  const rows = materialNumbers.map((m) => `<tr><td></td><td>${m}</td><td>X</td></tr>`).join('')
  return (
    '<table><tr><th class="collab-checkbox-header"></th>' +
    '<th>Material Number</th><th>ISO Catalog Number</th></tr>' +
    `${rows}</table>`
  )
}

/** A fetcher answering each facet group with the materials indexed for it. */
function serve(byGroup: Record<string, string[]>) {
  const queries: string[] = []
  const fetcher = asFetcher({
    text: vi.fn(async (url: string) => {
      const query = new URL(url).searchParams.get('query') ?? ''
      queries.push(query)
      const group = query.split(':').at(-1) ?? ''
      const found = byGroup[group]
      return found ? table(found) : NO_RESULTS
    }),
  })
  return { fetcher, queries }
}

describe('one group at a time', () => {
  it('appends the facet name to the active-only query', async () => {
    // A misspelled facet *name* is ignored by the endpoint rather than
    // rejected, which would report every group as matching every tool — so the
    // name is a constant and the query it builds is worth pinning.
    const { fetcher, queries } = serve({})

    await materialsInGroup(fetcher, '103354322', 'S3', 'widia')

    expect(queries).toEqual([':relevance:obsoleteFacet:false:workpieceMaterialDetail:S3'])
  })

  it.each([
    [[], []],
    [['1'], ['1']],
    [
      ['1', '2'],
      ['1', '2'],
    ],
    [
      Array.from({ length: 9 }, (_, i) => String(i)),
      Array.from({ length: 9 }, (_, i) => String(i)),
    ],
  ])('returns the material numbers indexed for it (%j)', async (served, expected) => {
    const { fetcher } = serve({ P3: served })

    const found = await materialsInGroup(fetcher, '1', 'P3')

    expect([...found].sort()).toEqual([...expected].sort())
  })

  it('reads a group the family is not rated for as empty, not an error', async () => {
    // The common case in a 32-value sweep. MaxiMet matches nothing under any
    // of the 24 non-N groups, and a throw there would mean no family could be
    // swept at all.
    const { fetcher } = serve({ N1: ['1'] })

    expect(await materialsInGroup(fetcher, '1', 'P0')).toEqual(new Set())
  })
})

describe('the sweep', () => {
  it('returns groups in vendor order, not discovery order', async () => {
    // P before M before K is the vendor's own panel order, and the written
    // column has to be byte-stable across re-runs.
    const { fetcher } = serve({ H1: ['7'], P2: ['7'], N4: ['7'], K1: ['7'] })

    const found = await groupsByMaterial(fetcher, '1', { delayMs: 0 })

    expect(found.get('7')).toEqual(['P2', 'K1', 'N4', 'H1'])
  })

  it('gives each material only its own groups', async () => {
    // The sweep is per material number rather than per family. Every family
    // scraped so far answers uniformly, so a family-wide list would pass every
    // test written against today's data and be wrong the first time a vendor
    // splits a line by size.
    const { fetcher } = serve({ P0: ['1', '2'], N1: ['2'], S4: ['1'] })

    const found = await groupsByMaterial(fetcher, '1', { delayMs: 0 })

    expect(found.get('1')).toEqual(['P0', 'S4'])
    expect(found.get('2')).toEqual(['P0', 'N1'])
  })

  it('sweeps every group the vocabulary knows', async () => {
    const { fetcher, queries } = serve({})

    await groupsByMaterial(fetcher, '1', { delayMs: 0 })

    expect(queries).toHaveLength(MATERIAL_GROUPS.length)
  })

  it('waits between the group queries, and not before the first', async () => {
    // The one test here that leaves `delayMs` at its default. A sweep is one
    // facet query per group against a vendor that fronts its search, and at
    // zero `pause` never reaches a timer — so this is what says the sweep is
    // still paced.
    const { fetcher } = serve({})
    const { waits, restore } = recordPauses()

    try {
      await groupsByMaterial(fetcher, '1')
    } finally {
      restore()
    }

    expect(waits).toHaveLength(MATERIAL_GROUPS.length - 1)
    expect(new Set(waits)).toEqual(new Set([REQUEST_DELAY_MS]))
  })
})

describe('the column', () => {
  /** A family scrape of `count` rows, material numbers `1`..`count`. */
  function family(count: number): ScrapeResult {
    return {
      header: ['Material Number', 'Grade'],
      rows: Array.from({ length: count }, (_, i) => ({
        'Material Number': String(i + 1),
        Grade: 'KCU20',
      })),
      source: 'https://example.test',
      familyCode: '1',
    }
  }

  it.each([0, 1, 2, 5])('gives every row a cell at %i rows', (count) => {
    const found = new Map(Array.from({ length: count }, (_, i) => [String(i + 1), ['P0']]))

    const { scrape, matched } = addMaterialGroups(family(count), found)

    expect(matched).toBe(count)
    for (const row of scrape.rows) expect(row[MATERIALS_COLUMN]).toBe('P0')
  })

  it('keeps every row for a family the vendor indexes for nothing', () => {
    // Zero is a legitimate result — all three tap families sweep to nothing —
    // so the rows survive and the count reports the truth.
    const { scrape, matched } = addMaterialGroups(family(3), new Map())

    expect(matched).toBe(0)
    expect(scrape.rows).toHaveLength(3)
    expect(scrape.rows.map((r) => r[MATERIALS_COLUMN])).toEqual(['', '', ''])
  })

  it('rebuilds the column on a re-run instead of duplicating it', () => {
    const found = new Map([['1', ['P0']]])

    const once = addMaterialGroups(family(1), found)
    const twice = addMaterialGroups(once.scrape, found)

    expect(twice.scrape.header).toEqual(once.scrape.header)
    expect(twice.scrape.header.filter((c) => c === MATERIALS_COLUMN)).toHaveLength(1)
  })
})

describe('reading the column back', () => {
  it.each([
    ['', []],
    ['P0', ['P0']],
    ['N4 P2 K1', ['P2', 'K1', 'N4']],
  ])('restores vendor order from %j', (cell, expected) => {
    expect(parseMaterialGroups(cell)).toEqual(expected)
  })

  it.each([
    ['', []],
    ['P0 P1 P2', ['P']],
    ['P0 N4 S1', ['P', 'N', 'S']],
    ['C4 H1 K2', ['K', 'H', 'C']],
  ])('collapses %j to ISO classes', (cell, expected) => {
    // The subgroup is scraped and then deliberately dropped: P0 through P6 is
    // a hardness band within steel, and the question a catalog answers is
    // "does this end mill cut steel".
    expect(materialClasses(cell)).toEqual(expected)
  })

  it('does not let an unknown code smuggle in a class', () => {
    // The column is generated, so anything outside the vocabulary came from a
    // hand-edit, and a made-up group would reach a filter panel as a value no
    // control could offer.
    expect(parseMaterialGroups('Z9')).toEqual([])
    expect(materialClasses('Z9')).toEqual([])
  })

  it('drops a code the vendor does not publish', () => {
    expect(parseMaterialGroups('P0 P9')).toEqual(['P0'])
  })

  it('treats a missing cell as blank', () => {
    expect(parseMaterialGroups(undefined)).toEqual([])
    expect(materialClasses(undefined)).toEqual([])
  })
})
