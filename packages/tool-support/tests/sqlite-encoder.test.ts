/**
 * The encoder is checked against SQLite itself.
 *
 * `packages/tool-support/src/export/mastercam/sqlite/` writes a database file
 * without a SQLite binding, because the package is allowed no dependency. That
 * is a good reason to hand-roll a file format and a terrible reason to trust
 * the result: the failure mode of a b-tree written slightly wrong is not a
 * thrown error, it is a file that opens, answers some queries and is missing
 * rows.
 *
 * So nothing here asserts against the encoder's own idea of what it wrote.
 * Every test encodes, writes the bytes to a file, opens it with `node:sqlite` —
 * a real SQLite, built into the runtime and outside this package's dependency
 * budget because it is a test — and asks SQLite what is in there. `PRAGMA
 * integrity_check` walks every page and every index entry, which is the whole
 * point of running it rather than a `SELECT`.
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import {
  DEFAULT_PAGE_SIZE,
  encodeDatabase,
  type Row,
  type TableSpec,
} from '../src/export/mastercam/sqlite/index.js'

const scratch = mkdtempSync(join(tmpdir(), 'toolpath-sqlite-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let written = 0

/** Encode, write, open. What comes back is SQLite's reading, not the encoder's. */
const roundTrip = (
  tables: readonly TableSpec[],
  rows: ReadonlyMap<string, readonly Row[]>,
  pageSize?: number,
): DatabaseSync => {
  written += 1
  const path = join(scratch, `case-${written}.db`)
  writeFileSync(
    path,
    encodeDatabase(pageSize === undefined ? { tables, rows } : { tables, rows, pageSize }),
  )
  const db = new DatabaseSync(path, { readOnly: true })
  expect(db.prepare('pragma integrity_check').get()).toEqual({ integrity_check: 'ok' })
  return db
}

const guid = (seed: number): Uint8Array => {
  const bytes = new Uint8Array(16)
  for (let at = 0; at < 16; at += 1) bytes[at] = (seed * 31 + at * 7) & 0xff
  // Keep the high bytes moving so keys are not accidentally ordered by the
  // insertion sequence — a sorted-input index would hide a comparator bug.
  bytes[0] = (seed * 91) & 0xff
  bytes[1] = (seed >> 8) & 0xff
  return bytes
}

const ITEM: TableSpec = {
  name: 'Item',
  sql: 'CREATE TABLE [Item]([ID] GUID PRIMARY KEY, [Name] VARCHAR, [Size] DOUBLE, [Count] INT)',
  columns: [
    { name: 'ID', type: 'GUID' },
    { name: 'Name', type: 'VARCHAR' },
    { name: 'Size', type: 'DOUBLE' },
    { name: 'Count', type: 'INT' },
  ],
  indexes: [{ name: 'sqlite_autoindex_Item_1', columns: ['ID'] }],
}

describe('a database SQLite agrees with', () => {
  it('round-trips values with the types their columns declare', () => {
    const rows: Row[] = [
      { ID: guid(1), Name: 'flat endmill', Size: 0.375, Count: 3 },
      // A whole number in a DOUBLE column is the case affinity exists for: it
      // has to read back as a real, the way every Mastercam library stores it.
      { ID: guid(2), Name: 'ball endmill', Size: 2, Count: 0 },
      { ID: guid(3), Name: '', Size: -1.5, Count: -42 },
      { ID: guid(4), Name: 'ünïcødé — 🔩', Size: 1e-9, Count: 1 },
    ]
    const db = roundTrip([ITEM], new Map([['Item', rows]]))

    expect(db.prepare('select count(*) c from Item').get()).toEqual({ c: 4 })
    expect(
      db.prepare('select typeof(Size) t, typeof(Count) u, typeof(ID) v from Item limit 1').get(),
    ).toEqual({ t: 'real', u: 'integer', v: 'blob' })

    const back = db.prepare('select * from Item order by Count').all()
    expect(back.map((row) => row['Name'])).toEqual([
      '',
      'ball endmill',
      'ünïcødé — 🔩',
      'flat endmill',
    ])
    expect(back.map((row) => row['Size'])).toEqual([-1.5, 2, 1e-9, 0.375])
    expect(Buffer.from(back[3]?.['ID'] as Uint8Array)).toEqual(Buffer.from(guid(1)))
  })

  it('writes NULL for a column the row leaves out', () => {
    const db = roundTrip([ITEM], new Map([['Item', [{ ID: guid(9) }]]]))
    expect(db.prepare('select Name, Size, Count from Item').get()).toEqual({
      Name: null,
      Size: null,
      Count: null,
    })
  })

  it('finds a row through its primary key index', () => {
    const rows = Array.from({ length: 500 }, (_, at) => ({
      ID: guid(at),
      Name: `tool ${at}`,
      Size: at / 8,
      Count: at,
    }))
    const db = roundTrip([ITEM], new Map([['Item', rows]]))
    expect(db.prepare('select count(*) c from Item').get()).toEqual({ c: 500 })

    // `= ?` on the primary key is an index seek, so a wrong key order or a
    // dropped divider surfaces here as a miss rather than as a bad count.
    const plan = db.prepare('explain query plan select Name from Item where ID = ?').all()
    expect(JSON.stringify(plan)).toContain('sqlite_autoindex_Item_1')
    for (const at of [0, 1, 249, 498, 499]) {
      expect(db.prepare('select Name from Item where ID = ?').get(guid(at))).toEqual({
        Name: `tool ${at}`,
      })
    }
  })

  it('keeps every row across a multi-level tree', () => {
    // Enough rows that both the table and the index need interior pages above
    // their leaves, and then another level above that.
    const rows = Array.from({ length: 20_000 }, (_, at) => ({
      ID: guid(at),
      Name: `tool ${at}`,
      Size: at,
      Count: at,
    }))
    const db = roundTrip([ITEM], new Map([['Item', rows]]))
    expect(db.prepare('select count(*) c, sum(Count) s from Item').get()).toEqual({
      c: 20_000,
      s: (19_999 * 20_000) / 2,
    })
    // Read through the index rather than the table, which is a different walk.
    expect(db.prepare('select count(*) c from (select ID from Item order by ID)').get()).toEqual({
      c: 20_000,
    })
  })

  it('carries a payload too large for its page', () => {
    const blobs: TableSpec = {
      name: 'Blobs',
      sql: 'CREATE TABLE [Blobs]([ID] GUID PRIMARY KEY, [Data] BLOB)',
      columns: [
        { name: 'ID', type: 'GUID' },
        { name: 'Data', type: 'BLOB' },
      ],
      indexes: [{ name: 'sqlite_autoindex_Blobs_1', columns: ['ID'] }],
    }
    // 1 KiB pages, so every one of these overflows: the 1024-byte case is the
    // one a Mastercam tool record actually hits, and the others bracket it.
    const sizes = [900, 1024, 1025, 5000, 60_000]
    const rows = sizes.map((size, at) => ({
      ID: guid(at),
      Data: Uint8Array.from({ length: size }, (_, index) => (index * 7 + at) & 0xff),
    }))
    const db = roundTrip([blobs], new Map([['Blobs', rows]]))

    for (const [at, size] of sizes.entries()) {
      const back = db.prepare('select Data from Blobs where ID = ?').get(guid(at))
      expect(Buffer.from(back?.['Data'] as Uint8Array)).toEqual(
        Buffer.from(rows[at]?.Data as Uint8Array),
      )
      expect((back?.['Data'] as Uint8Array).length).toBe(size)
    }
  })

  it('carries an index key too large for its cell', () => {
    const wide: TableSpec = {
      name: 'Wide',
      sql: 'CREATE TABLE [Wide]([Key] VARCHAR PRIMARY KEY, [N] INT)',
      columns: [
        { name: 'Key', type: 'VARCHAR' },
        { name: 'N', type: 'INT' },
      ],
      indexes: [{ name: 'sqlite_autoindex_Wide_1', columns: ['Key'] }],
    }
    // Well past indexMaxLocal at a 1 KiB page, so every index entry overflows
    // and the chain has to be written exactly once.
    const keys = Array.from(
      { length: 200 },
      (_, at) => `${String(at).padStart(4, '0')}-${'k'.repeat(3000)}`,
    )
    const rows = keys.map((key, at) => ({ Key: key, N: at }))
    const db = roundTrip([wide], new Map([['Wide', rows]]))
    expect(db.prepare('select count(*) c from Wide').get()).toEqual({ c: 200 })
    expect(db.prepare('select N from Wide where Key = ?').get(keys[137] as string)).toEqual({
      N: 137,
    })
    expect(db.prepare('select N from Wide order by Key limit 1').get()).toEqual({ N: 0 })
  })

  it('orders a composite key by each column in turn', () => {
    const segments: TableSpec = {
      name: 'Seg',
      sql: 'CREATE TABLE [Seg]([ItemID] GUID, [Segment] INT, [x] DOUBLE, PRIMARY KEY([ItemID],[Segment]))',
      columns: [
        { name: 'ItemID', type: 'GUID' },
        { name: 'Segment', type: 'INT' },
        { name: 'x', type: 'DOUBLE' },
      ],
      indexes: [{ name: 'sqlite_autoindex_Seg_1', columns: ['ItemID', 'Segment'] }],
    }
    const rows: Row[] = []
    for (let item = 0; item < 60; item += 1) {
      for (let segment = 0; segment < 40; segment += 1) {
        rows.push({ ItemID: guid(item), Segment: segment, x: item + segment / 100 })
      }
    }
    const db = roundTrip([segments], new Map([['Seg', rows]]))
    expect(db.prepare('select count(*) c from Seg').get()).toEqual({ c: 2400 })
    expect(
      db.prepare('select x from Seg where ItemID = ? and Segment = ?').get(guid(17), 23),
    ).toEqual({ x: 17.23 })
    // Ascending over the composite index: the divider entries have to land in
    // the right places for this to come back in order and complete.
    const ordered = db
      .prepare('select Segment from Seg where ItemID = ? order by Segment')
      .all(guid(17))
    expect(ordered.map((row) => row['Segment'])).toEqual(Array.from({ length: 40 }, (_, at) => at))
  })

  it('writes a table nobody put a row in', () => {
    const db = roundTrip([ITEM], new Map())
    expect(db.prepare('select count(*) c from Item').get()).toEqual({ c: 0 })
  })

  it.each([512, 1024, 4096, 65_536])('holds together at a %d-byte page', (pageSize) => {
    const rows = Array.from({ length: 2_000 }, (_, at) => ({
      ID: guid(at),
      Name: `tool ${at}`.repeat(at % 9),
      Size: at / 3,
      Count: at,
    }))
    const db = roundTrip([ITEM], new Map([['Item', rows]]), pageSize)
    expect(db.prepare('select count(*) c from Item').get()).toEqual({ c: 2_000 })
    expect(db.prepare('pragma page_size').get()).toEqual({ page_size: pageSize })
  })

  it('refuses rows for a table the schema does not define', () => {
    expect(() => encodeDatabase({ tables: [ITEM], rows: new Map([['Nope', []]]) })).toThrow(
      /does not define/,
    )
  })
})

describe('the pinned Mastercam schema', () => {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const digest = JSON.parse(
    readFileSync(join(repositoryRoot, 'mastercam', 'digest.json'), 'utf8'),
  ) as {
    tables: Record<
      string,
      {
        sql: string
        columns: { name: string; type: string }[]
        indexes: { name: string; columns: string[] }[]
      }
    >
  }
  const tables: TableSpec[] = Object.entries(digest.tables).map(([name, entry]) => ({
    name,
    sql: entry.sql,
    columns: entry.columns,
    indexes: entry.indexes,
  }))

  it('encodes to a database SQLite opens and reads back', () => {
    const db = roundTrip(tables, new Map())
    const names = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => row['name'])
    expect(names).toEqual(Object.keys(digest.tables).sort())

    // Every table has to be queryable, not merely listed: a root page pointing
    // at the wrong page answers the schema query and fails this one.
    for (const table of tables) {
      expect(db.prepare(`select count(*) c from [${table.name}]`).get()).toEqual({ c: 0 })
    }
  })

  it('reproduces the page size Mastercam writes', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(1024)
  })
})
