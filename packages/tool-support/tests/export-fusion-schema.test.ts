/**
 * The Fusion type table is a copy of Autodesk's rules, and this is what keeps
 * it honest.
 *
 * `src/export/fusion/schema.ts` states what each tool type requires and
 * permits, compressed into a shared core plus a per-type delta so a reader can
 * check it. `fusion/digest.json` is the same information reduced mechanically
 * from the 2.6 MB schema Autodesk publishes. This asserts they agree.
 *
 * **It is the last link in a chain that starts outside this repository.**
 * Autodesk moves the schema without announcement — it moved between February
 * and September 2026. `.github/workflows/fusion-schema.yml` notices weekly and
 * fails; `pnpm fusion:adopt -- --fetch` moves `fusion/digest.json`; and then
 * this fails, because the table the exporter actually reads no longer matches.
 * Without this test an adopt would be a quiet file change and the exporter
 * would go on writing yesterday's rules.
 *
 * The digest is read from the repository root rather than imported, because
 * `src/` may not reach outside the package — `boundary.test.ts` is the rule —
 * and a test may.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { TOOL_FORMS } from '../src/forms.js'
import {
  FUSION_GUID_PATTERN,
  FUSION_LIBRARY_VERSION,
  FUSION_MATERIALS,
  FUSION_SEGMENT_KEYS,
  FUSION_TYPES,
  FUSION_UNITS,
  fusionType,
} from '../src/export/fusion/schema.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

interface DigestEntry {
  readonly recordRequired: readonly string[]
  readonly recordAllowed: readonly string[]
  readonly geometryRequired: readonly string[]
  readonly geometryAllowed: readonly string[]
  readonly geometryClosed: boolean
  readonly variants?: readonly DigestEntry[]
}

const digest = JSON.parse(readFileSync(join(ROOT, 'fusion/digest.json'), 'utf8')) as {
  source: { sha256: string; url: string }
  library: { required: string[]; version: { minimum: number } }
  entry: { required: string[] }
  guidPattern: string
  segment: { required: string[]; allowed: string[]; additionalProperties: boolean }
  enums: { unit: string[]; material: string[] }
  types: Record<string, DigestEntry>
}

describe('the digest is the one this repository derived', () => {
  it('names the types the schema names', () => {
    // Guards every rule below: a digest that failed to derive would leave them
    // iterating nothing and reporting that as a pass — the failure mode
    // `boundary.test.ts` is written against.
    expect(Object.keys(digest.types).length).toBeGreaterThan(30)
    expect(digest.source.url).toContain('cam.autodesk.com')
    expect(digest.source.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('the type table matches Autodesk’s published schema', () => {
  const names = Object.keys(FUSION_TYPES).sort()

  it('writes every form the domain has a word for, and the holder', () => {
    // `forms.ts` claims its vocabulary is Fusion's own so that an exported tool
    // lands on the type it already has. This is that claim, measured: a form
    // added to the domain without a table entry fails here rather than
    // exporting as an invented type.
    expect(names).toEqual([...TOOL_FORMS.map((form) => form.value), 'holder'].sort())
  })

  it.each(names)('%s', (name) => {
    const entry = digest.types[name]
    if (entry === undefined) {
      throw new Error(`${name} is not a type in Autodesk's schema`)
    }
    expect(
      entry.variants,
      `${name} has alternative shapes in the schema, which this table cannot express`,
    ).toBeUndefined()

    const rules = fusionType(name)
    expect(rules).not.toBeNull()
    expect(rules?.recordRequired, `${name} record requirements`).toEqual(entry.recordRequired)
    expect(rules?.geometryRequired, `${name} geometry requirements`).toEqual(entry.geometryRequired)
    expect(rules?.geometryAllowed, `${name} permitted geometry`).toEqual(entry.geometryAllowed)
  })

  it('writes no geometry into a type whose geometry the schema closes', () => {
    // None of the exported types closes its geometry today. If one starts to,
    // the exporter's "write everything allowed" rule needs revisiting rather
    // than this expectation relaxing.
    for (const name of names) {
      expect(digest.types[name]?.geometryClosed, `${name} closed its geometry`).toBe(false)
    }
  })
})

describe('the constants beside the table match the schema', () => {
  it('states a library version the schema accepts', () => {
    expect(FUSION_LIBRARY_VERSION).toBeGreaterThanOrEqual(digest.library.version.minimum)
  })

  it('states the schema’s units and materials', () => {
    expect([...FUSION_UNITS]).toEqual(digest.enums.unit)
    expect([...FUSION_MATERIALS]).toEqual(digest.enums.material)
  })

  it('states the segment’s three keys, and that the schema permits no fourth', () => {
    expect([...FUSION_SEGMENT_KEYS]).toEqual(digest.segment.allowed)
    expect([...FUSION_SEGMENT_KEYS]).toEqual(digest.segment.required)
    // The one closed object in the format. A segment carrying anything else is
    // rejected outright, so the exporter cannot annotate one.
    expect(digest.segment.additionalProperties).toBe(false)
  })

  it('states the schema’s own guid pattern', () => {
    expect(FUSION_GUID_PATTERN.source).toBe(digest.guidPattern)
  })

  it('requires a guid on every entry, which is why the exporter mints none', () => {
    expect(digest.entry.required).toContain('guid')
  })
})
