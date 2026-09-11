/**
 * The bulk STEP mirror: one row's CAD URL -> one file on disk, and the count of
 * how many rows have one at all.
 *
 * It lives in `node/` rather than beside the Kennametal CAD lookup because it
 * is vendor-neutral — it reads `conventions.CAD_COLUMN`, which three vendors
 * fill in — and because writing files is the half of this package a backend
 * embedding it never imports.
 *
 * **"Vendor-neutral" was half true until 2026-09-02**, which is what the
 * MariTool case below is here to keep honest. Reading the column really was
 * neutral; naming the file was not, because it read `ISO Catalog Number` — a
 * column MariTool does not publish. The mirror ran, reported zero files, and
 * warned 357 times.
 */

import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CAD_COLUMN, CAD_DXF_COLUMN } from '../src/conventions.js'
import { cadCoverage, mirrorFamilySteps } from '../src/node/cad-mirror.js'
import { stub } from './stubs.js'

/** A fetcher that answers three bytes to anything, and counts what was asked. */
function bytes(): { fetcher: ReturnType<typeof stub>; urls: string[] } {
  const urls: string[] = []
  const fetcher = stub({
    bytes: (url: string) => {
      urls.push(url)
      return Promise.resolve(new Uint8Array([1, 2, 3]))
    },
  })
  return { fetcher, urls }
}

describe('the STEP mirror', () => {
  it('writes one flat file per row even when the catalog number has a slash', async () => {
    // REGO-FIX's catalog number is the vendor's title — `BT 30 / PG 25 x 075`
    // — and the separator in it was honoured as one, so the file landed inside
    // a `BT 30 ` directory rather than flat in outDir as promised.
    const out = mkdtempSync(join(tmpdir(), 'mirror-'))
    const { fetcher } = bytes()
    const rows = [
      {
        [CAD_COLUMN]: 'https://example.invalid/a.stp',
        'ISO Catalog Number': 'BT 30 / PG 25 x 075',
      },
    ]

    const written = await mirrorFamilySteps(fetcher, rows, 'regofix', out, 0, () => {})

    expect(existsSync(join(out, 'BT 30 - PG 25 x 075.stp'))).toBe(true)
    expect(existsSync(join(out, 'BT 30 '))).toBe(false)
    // The row still reports the vendor's own number, not the sanitised one.
    expect(written[0]?.catalogNumber).toBe('BT 30 / PG 25 x 075')
  })

  it('names a MariTool file after the one number that vendor publishes', async () => {
    // The case the hardcoded column got wrong. MariTool's identity deviation is
    // `Material Number` alone — it publishes no catalog designation anywhere —
    // so a mirror keyed on `ISO Catalog Number` skipped every row it was given.
    const out = mkdtempSync(join(tmpdir(), 'mirror-'))
    const { fetcher, urls } = bytes()
    const warnings: string[] = []
    const rows = [
      {
        [CAD_COLUMN]: 'https://cdn.invalid/aa_CAT40-ER16-3.0-REV1.stp',
        'Material Number': 'CAT40-ER16-3.0',
      },
    ]

    const written = await mirrorFamilySteps(fetcher, rows, 'maritool', out, 0, (m) =>
      warnings.push(m),
    )

    expect(warnings).toEqual([])
    expect(urls).toHaveLength(1)
    expect(written.map((f) => f.catalogNumber)).toEqual(['CAT40-ER16-3.0'])
    // Named for the part, not for the CDN's hashed object name: the filename is
    // what a human reads, and it is what Phase 4's profile join is keyed on.
    expect(existsSync(join(out, 'CAT40-ER16-3.0.stp'))).toBe(true)
  })

  it('skips a row with a model and no number to name it, naming the column', async () => {
    const out = mkdtempSync(join(tmpdir(), 'mirror-'))
    const { fetcher, urls } = bytes()
    const warnings: string[] = []

    const written = await mirrorFamilySteps(
      fetcher,
      [{ [CAD_COLUMN]: 'https://example.invalid/a.stp' }],
      'maritool',
      out,
      0,
      (m) => warnings.push(m),
    )

    expect(written).toEqual([])
    expect(urls).toEqual([])
    // The message names the column it looked in, so a vendor whose identity
    // deviation is missing says which one to add rather than "no catalog number".
    expect(warnings[0]).toContain('no Material Number to name it')
  })

  it('asks for nothing on a row the vendor publishes no model for', async () => {
    const out = mkdtempSync(join(tmpdir(), 'mirror-'))
    const { fetcher, urls } = bytes()

    const written = await mirrorFamilySteps(
      fetcher,
      [{ [CAD_COLUMN]: '', 'Material Number': 'HSK63A-SF.500-3.0' }],
      'maritool',
      out,
      0,
      () => {},
    )

    expect(written).toEqual([])
    expect(urls).toEqual([])
  })
})

describe('counting what a mirror would get', () => {
  it('counts the two columns separately, because they are two different things', () => {
    // `conventions.CAD_DXF_COLUMN` says why: a DXF is a drawing whose datum,
    // projection and layer semantics are the vendor's business. It is counted so
    // the gap is visible, and it is not a fallback for a missing STEP.
    const found = cadCoverage([
      { [CAD_COLUMN]: 'https://cdn.invalid/a.stp', [CAD_DXF_COLUMN]: 'https://cdn.invalid/a.dxf' },
      { [CAD_COLUMN]: '', [CAD_DXF_COLUMN]: 'https://cdn.invalid/b.dxf' },
      { [CAD_COLUMN]: '   ', [CAD_DXF_COLUMN]: '' },
      { 'Material Number': 'x' },
    ])

    // The fourth row carries no CAD column at all, which is a different answer
    // from the two blank cells above it — see the case below.
    expect(found).toEqual({ rows: 4, step: 1, unspecified: 1, dxf: 2 })
  })

  it('counts a row nobody looked a model up for apart from one with none', () => {
    // The operational half of `holding.cadModel`'s three states. Kennametal
    // publishes no CAD link on a family page, so a family the `cad` pass has not
    // run over carries no column and every row of it is unspecified — and this
    // reported `0 STEP` for that until 2026-09-10, which reads as "the vendor
    // publishes no models" and is a different thing entirely.
    const unswept = cadCoverage([{ 'Material Number': 'a' }, { 'Material Number': 'b' }])
    const swept = cadCoverage([{ [CAD_COLUMN]: '' }, { [CAD_COLUMN]: '' }])

    expect(unswept).toEqual({ rows: 2, step: 0, unspecified: 2, dxf: 0 })
    expect(swept).toEqual({ rows: 2, step: 0, unspecified: 0, dxf: 0 })
  })

  it('reads an empty family as no rows rather than as a fault', () => {
    expect(cadCoverage([])).toEqual({ rows: 0, step: 0, unspecified: 0, dxf: 0 })
  })

  it('agrees with what the mirror actually downloads', async () => {
    // The claim the report rests on. Two answers to "does this row have a model"
    // is one too many, so the count and the download read the same column the
    // same way — and this is what says they still do.
    const out = mkdtempSync(join(tmpdir(), 'mirror-'))
    const { fetcher, urls } = bytes()
    const rows = [
      { [CAD_COLUMN]: 'https://cdn.invalid/a.stp', 'Material Number': 'A' },
      { [CAD_COLUMN]: '', 'Material Number': 'B' },
      { [CAD_COLUMN]: 'https://cdn.invalid/c.stp', 'Material Number': 'C' },
    ]

    const written = await mirrorFamilySteps(fetcher, rows, 'maritool', out, 0, () => {})

    expect(cadCoverage(rows).step).toBe(written.length)
    expect(urls).toHaveLength(cadCoverage(rows).step)
  })
})
