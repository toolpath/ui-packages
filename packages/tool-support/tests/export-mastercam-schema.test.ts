/**
 * The generated schema and the pinned digest are the same thing.
 *
 * `mastercam/digest.json` is what a maintainer reviews when Mastercam's schema
 * moves; `src/export/mastercam/schema.generated.ts` is what the exporter loads,
 * because the package imports no `fs` and cannot read the digest at runtime.
 * Two copies of a third-party document is exactly the arrangement this
 * repository is organised against, so this is the check that they cannot drift:
 * `pnpm mastercam:adopt` writes both, and a hand edit to either fails here.
 *
 * It is the same standing `tests/export-fusion-schema.test.ts` has against
 * `fusion/digest.json`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  MASTERCAM_SCHEMA_VERSION,
  MASTERCAM_SEED,
  MASTERCAM_TABLES,
  MASTERCAM_VERSION,
} from '../src/export/mastercam/schema.generated.js'
import { guidText, isGuid, guidBytes } from '../src/export/mastercam/guid.js'
import {
  MC_HOLEMAKING,
  MC_SUBTYPE,
  MC_TOOL_TYPE,
  MC_TOOL_TYPE_COERCED,
  seedGuid,
} from '../src/export/mastercam/schema.js'

interface Digest {
  readonly source: { readonly schemaVersion: number; readonly mastercam: string }
  readonly tables: Record<
    string,
    {
      readonly sql: string
      readonly columns: readonly { readonly name: string; readonly type: string }[]
      readonly indexes: readonly {
        readonly name: string
        readonly unique: boolean
        readonly columns: readonly string[]
      }[]
    }
  >
  readonly seed: Record<string, readonly Record<string, unknown>[]>
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const digest = JSON.parse(
  readFileSync(join(repositoryRoot, 'mastercam', 'digest.json'), 'utf8'),
) as Digest

describe('the generated schema matches the pinned digest', () => {
  it('has tables to check', () => {
    // Guards every rule below: an empty module would satisfy all of them.
    expect(MASTERCAM_TABLES.length).toBeGreaterThan(50)
  })

  it('names the same tables', () => {
    expect(MASTERCAM_TABLES.map((table) => table.name)).toEqual(Object.keys(digest.tables))
  })

  it('carries each table’s CREATE TABLE text, columns and indexes verbatim', () => {
    // The digest also records each column's `pk`, which does not travel: the
    // encoder takes an index's key columns from the index itself, so a second
    // spelling of the same fact would be a field nothing reads. `unique` does
    // travel — it gates the duplicate-key check. The projection is spelled out
    // here so that a field quietly appearing in the digest and not in the
    // module still fails.
    for (const table of MASTERCAM_TABLES) {
      const pinned = digest.tables[table.name]
      expect(pinned, table.name).toBeDefined()
      expect(table.sql, table.name).toBe(pinned?.sql)
      expect(table.columns, table.name).toEqual(
        pinned?.columns.map((column) => ({ name: column.name, type: column.type })),
      )
      expect(table.indexes, table.name).toEqual(
        pinned?.indexes.map((index) => ({
          name: index.name,
          unique: index.unique,
          columns: index.columns,
        })),
      )
    }
  })

  it('carries the same seed rows', () => {
    expect(Object.keys(MASTERCAM_SEED).sort()).toEqual(Object.keys(digest.seed).sort())
    for (const [table, rows] of Object.entries(MASTERCAM_SEED)) {
      expect(rows, table).toEqual(digest.seed[table])
    }
  })

  it('records the version the digest was adopted from', () => {
    expect(MASTERCAM_SCHEMA_VERSION).toBe(digest.source.schemaVersion)
    expect(MASTERCAM_VERSION.join('.')).toBe(digest.source.mastercam)
  })
})

describe('the tool-type table', () => {
  it('gives every mapped code a subtype table that exists', () => {
    const codes = [
      ...Object.values(MC_TOOL_TYPE),
      ...Object.values(MC_TOOL_TYPE_COERCED).map((entry) => entry.to),
    ]
    expect(codes.length).toBeGreaterThan(0)
    const names = new Set(MASTERCAM_TABLES.map((table) => table.name))
    for (const code of codes) {
      const subtype = MC_SUBTYPE[code]
      expect(subtype, `MCToolType ${code}`).toBeDefined()
      const table = {
        endmill: 'TlToolEndmill',
        drill: 'TlToolDrill',
        reamer: 'TlToolReamer',
        threading: 'TlToolThreading',
      }[subtype as 'endmill']
      expect(names.has(table), table).toBe(true)
    }
  })

  it('calls a drilling cycle for the tools that go down a hole', () => {
    // A tap or a reamer given milling defaults would open with a stepover
    // instead of a peck, which is a wrong default rather than a broken file.
    // **A thread mill is the exception that makes this a rule worth stating**:
    // its row lives in `TlToolThreading` beside a tap's, and it is milled —
    // it goes round the hole, not down it.
    for (const [code, subtype] of Object.entries(MC_SUBTYPE)) {
      const holemaking = MC_HOLEMAKING.has(Number(code))
      if (Number(code) === MC_TOOL_TYPE['thread mill']) {
        expect(subtype).toBe('threading')
        expect(holemaking, 'a thread mill is milled').toBe(false)
        continue
      }
      expect(holemaking, `MCToolType ${code}`).toBe(subtype !== 'endmill')
    }
  })

  it('coerces no form that already has a code of its own', () => {
    for (const form of Object.keys(MC_TOOL_TYPE_COERCED)) {
      expect(MC_TOOL_TYPE[form as keyof typeof MC_TOOL_TYPE], form).toBeUndefined()
    }
  })
})

describe('the seed rows the exporter names', () => {
  it('finds the grade and both materials by name', () => {
    expect(isGuid(seedGuid('TlToolGrade', 'Mastercam Default Grade'))).toBe(true)
    expect(isGuid(seedGuid('TlMaterial', 'Carbide'))).toBe(true)
    expect(isGuid(seedGuid('TlMaterial', 'HSS'))).toBe(true)
  })

  it('says so rather than returning nothing when a name is gone', () => {
    expect(() => seedGuid('TlMaterial', 'Unobtainium')).toThrow(/no TlMaterial row/)
  })

  it('round-trips every seed guid through Mastercam’s byte order', () => {
    for (const rows of Object.values(MASTERCAM_SEED)) {
      for (const row of rows) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string' && isGuid(value)) {
            expect(guidText(guidBytes(value))).toBe(value)
          }
        }
      }
    }
  })
})
