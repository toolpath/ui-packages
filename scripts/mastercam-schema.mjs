/**
 * Reducing a Mastercam tool database to the part this repository needs,
 * deterministically.
 *
 * `@toolpath/tool-support/export/mastercam` writes `.TOOLDB` files, which are
 * SQLite databases carrying Mastercam's own 79-table schema. To write one we
 * need two things that are not ours: the schema itself, and the reference rows
 * Mastercam ships inside every library — its twenty legacy tool types, its
 * operation types, its materials and its default grade, each with a fixed guid
 * that a tool row points at. Invent those and Mastercam opens a library whose
 * tools belong to nothing.
 *
 * So they are pinned, in the shape `fusion/` uses for Autodesk's schema and for
 * the same reason: a copy of a third-party document with nothing watching it is
 * the failure this repository is organised against.
 *
 * ## What is not vendored
 *
 * The reference database is somebody's shop library. It is not committed, and
 * the digest deliberately carries no part of it beyond the schema text and the
 * seed rows below — no tools, no holders, no assemblies, and of its
 * manufacturers only Mastercam itself. {@link SEED} is an allowlist of guids
 * rather than "whatever was in the table", which is what makes the derivation
 * independent of *which* library it was read from: two shops' files produce
 * byte-identical digests, so `mastercam:verify` does not churn when a
 * maintainer adopts from a different reference.
 *
 * The file's own hash is recorded for traceability. Its name is not — that
 * would put a customer in the tree.
 */

import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

/** Bumped when {@link derive} changes shape, so a stale digest is loud. */
export const DIGEST_VERSION = 1

/**
 * The rows Mastercam ships, by the guid it ships them under.
 *
 * These are constants of the format, not of a library: every `.TOOLDB` written
 * by Mastercam 2026 carries this same set under these same guids, and an
 * exported tool that names a grade or a material is naming one of them. The
 * content is read from the reference rather than written here, so a release
 * that renames one shows up as a diff on `pnpm mastercam:adopt` instead of
 * being silently overridden by this file.
 *
 * A guid listed here and missing from the reference fails the adopt. That is
 * the check: the roster cannot go stale quietly, because it is asserted against
 * a real database every time it moves.
 */
export const SEED = {
  TlToolGroup: ['04ccb858-e154-432d-ab5a-3f2967709509'],
  TlToolType: [
    '14677698-7230-4efd-9cd9-e22908e604a8',
    '234e3daf-2c37-4156-895d-cfd36b2ccbd8',
    '2ffbf697-4e0c-4d38-a0f3-15f70ec87d7f',
    '31a0e201-5681-4c1d-b968-e8c72c3ff9c8',
    '3bdfee85-a9f2-46d3-9cde-fd05afa07f39',
    '47cf2b08-e825-4d65-9d5a-d06621a2b905',
    '5085dc58-3d09-4aa0-a829-ad0fb8f59a66',
    '510b5c09-dc27-43ff-bd3f-4d63a4c65c0a',
    '57ec84cd-b5aa-4f74-b1a2-6c479e5662fc',
    '77636c16-1b47-4327-999a-d6ba2aaf5784',
    '776bc9ab-4812-4fe1-97f8-d6ff9bf69741',
    '781adb72-a2ee-4bd7-99d6-978fae9801f9',
    '8d4e7905-bf6c-438e-8cb9-d7fb40c97497',
    '98c2be7e-c806-4b6e-acaa-067e97d29086',
    'a29381b2-91e5-4d15-ba71-f80e17d5c4e5',
    'be99d343-550a-444f-b84e-774c629634e0',
    'c3c71c0c-3545-4a72-af76-d7272a5a7e17',
    'caf7acba-4bc0-4841-a2d8-17a9529ce42f',
    'e8c3a113-2748-43a8-9950-d90b8e864363',
    'e9d80248-76df-4ca9-b154-83f4eef1b1e7',
  ],
  TlOpGroup: ['497180c2-a6e4-11de-b80b-ffc956d89593', '5f97ab74-ba04-49ce-943c-47dc7ed9713a'],
  TlOpType: [
    '373cd3e8-766f-4e72-a306-e67e109ba201',
    '508c3916-a6e3-11de-bebd-bdc256d89593',
    '61cabbc3-6787-4882-9e3c-fd326d1d85ac',
    '842a4e88-a6e4-11de-89ca-90cb56d89593',
    '9b310f54-a6e4-11de-9e9d-54cd56d89593',
    'a92f88e2-a6e4-11de-bee6-9bcd56d89593',
    'b4ed2c34-a6e4-11de-a868-eacd56d89593',
    'bec896bc-a6e4-11de-894f-25ce56d89593',
    'c2697dfa-ec58-408e-a708-8753601c17c6',
    'e0d8a947-0905-43e9-8e01-80334ffb6a29',
  ],
  TlMaterial: ['7513e1e0-2e0c-407b-ad00-7e51ea9a429a', 'a2c64f46-6840-4969-8aee-da364cfe220c'],
  TlToolMaterial: ['7513e1e0-2e0c-407b-ad00-7e51ea9a429a', 'a2c64f46-6840-4969-8aee-da364cfe220c'],
  TlManufacturer: ['096cfa82-ac35-4c73-939b-851df5fb539f'],
  TlToolGrade: ['f9c5c3cc-570b-410d-a827-8dab6bbf50e1'],
}

/**
 * A Mastercam guid as text.
 *
 * The column holds sixteen bytes in .NET's `Guid.ToByteArray()` order, which is
 * not RFC 4122's: the first three groups are little-endian and the last two are
 * not. Reading it as a plain big-endian uuid produces a well-formed string that
 * names a different guid, so the swap is the whole point of this function.
 */
export const guidToString = (bytes) => {
  const hex = Buffer.from(bytes).toString('hex')
  const at = (start, length) => hex.slice(start * 2, (start + length) * 2)
  const swap = (start, length) => at(start, length).match(/../g).reverse().join('')
  return `${swap(0, 4)}-${swap(4, 2)}-${swap(6, 2)}-${at(8, 2)}-${at(10, 6)}`
}

/** The inverse of {@link guidToString}. */
export const guidToBytes = (text) => {
  const hex = text.replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`Not a guid: ${text}`)
  const group = (start, length) => hex.slice(start * 2, (start + length) * 2)
  const swap = (start, length) => group(start, length).match(/../g).reverse().join('')
  return Buffer.from(`${swap(0, 4)}${swap(4, 2)}${swap(6, 2)}${group(8, 8)}`, 'hex')
}

/** A seed row's column value, in the form the digest records it. */
const cell = (value) => {
  if (value === null) return null
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Uint8Array) {
    if (value.length === 16) return guidToString(value)
    throw new Error(`Seed row holds a ${value.length}-byte blob, which the digest cannot carry`)
  }
  return value
}

/**
 * Read a reference `.TOOLDB` into the digest this repository pins.
 *
 * Only the schema text and {@link SEED} come across. Everything else in the
 * file belongs to whoever's shop it came from.
 */
export const derive = (path, { sha256, retrievedAt }) => {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    // Columns and index keys come from SQLite's own reading of the schema
    // rather than from parsing the `CREATE TABLE` text. The encoder needs both
    // exactly right — a record is column-ordered and an index entry is
    // key-ordered — and a hand-rolled DDL parser is a second implementation of
    // something SQLite already did when it opened the file.
    const tables = {}
    for (const { name, sql } of db
      .prepare("select name, sql from sqlite_master where type = 'table' and sql is not null")
      .all()) {
      const columns = db
        .prepare(`pragma table_info([${name}])`)
        .all()
        .map((column) => ({ name: column.name, type: column.type, pk: Number(column.pk) }))
      const indexes = db
        .prepare(`pragma index_list([${name}])`)
        .all()
        .filter((index) => index.origin === 'pk' || index.origin === 'u')
        .map((index) => ({
          name: index.name,
          unique: Number(index.unique) === 1,
          columns: db
            .prepare(`pragma index_info([${index.name}])`)
            .all()
            .map((column) => column.name),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
      tables[name] = { sql, columns, indexes }
    }
    if (Object.keys(tables).length === 0) {
      throw new Error(`${path} holds no tables — it is not a Mastercam tool database`)
    }

    const seed = {}
    for (const [table, guids] of Object.entries(SEED)) {
      if (!(table in tables)) {
        throw new Error(`The reference database has no ${table} table`)
      }
      const rows = db.prepare(`select * from [${table}]`).all()
      const byGuid = new Map(rows.map((row) => [guidToString(row.ID), row]))
      seed[table] = guids.map((guid) => {
        const row = byGuid.get(guid)
        if (row === undefined) {
          throw new Error(
            `The reference database has no ${table} row ${guid}. Either it was not written by ` +
              `Mastercam, or a release changed the seed — check before editing SEED in ` +
              `scripts/mastercam-schema.mjs.`,
          )
        }
        return Object.fromEntries(
          Object.keys(row)
            .sort()
            .map((column) => [column, cell(row[column])]),
        )
      })
    }

    const header = db.prepare('select version, DataVersion from _Header').get()
    const log = db
      .prepare('select MCMajorVersion, MCMinorVersion from _UpdateLog order by [Update] desc')
      .all()
    return {
      source: {
        digestVersion: DIGEST_VERSION,
        schemaVersion: Number(header.version),
        dataVersion: Number(header.DataVersion),
        mastercam: `${log[0].MCMajorVersion}.${log[0].MCMinorVersion}`,
        sha256,
        retrievedAt,
      },
      tables,
      seed,
    }
  } finally {
    db.close()
  }
}

/**
 * The digest as it is written to disk.
 *
 * Keys sorted at every level, because the file is compared byte for byte
 * against a fresh derivation and V8's insertion order is not a contract.
 */
export const serialize = (digest) => `${JSON.stringify(digest, orderedKeys, 2)}\n`

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const orderedKeys = (_key, value) =>
  isObject(value)
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, value[key]]),
      )
    : value

export const sha256Of = (bytes) => createHash('sha256').update(bytes).digest('hex')
