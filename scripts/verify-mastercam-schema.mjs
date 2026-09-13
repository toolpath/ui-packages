/**
 * Prove the checked-in Mastercam schema digest is internally consistent — the
 * offline, hermetic half of pinning a document this repository does not own,
 * and the one that joins `pnpm check`.
 *
 * It answers four questions:
 *
 *   * is `digest.json` parseable and shaped the way `mastercam-schema.mjs`
 *     writes it;
 *   * does `schema.sha256` agree with the reference hash recorded inside the
 *     digest — two files that can only be written together by
 *     `mastercam:adopt`, so a hand edit to either shows up here;
 *   * is the digest byte-identical to `serialize()`ing what was parsed, which
 *     catches an edit that reordered keys or changed the indentation and would
 *     otherwise make a later adopt produce a spurious diff;
 *   * does the digest still carry every seed guid `SEED` names, and only
 *     those — so editing the roster without re-adopting fails rather than
 *     quietly describing rows the digest does not hold.
 *
 * There is no upstream check to pair with this one. Autodesk publishes its
 * schema at a URL that can be polled; Mastercam's arrives inside a file a
 * maintainer is handed, so there is nothing to ask on a schedule.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'
import { DIGEST_VERSION, SEED, serialize, sha256Of } from './mastercam-schema.mjs'

const mastercamRoot = join(repositoryRoot, 'mastercam')
const [digestBytes, checksumFile] = await Promise.all([
  readFile(join(mastercamRoot, 'digest.json')),
  readFile(join(mastercamRoot, 'schema.sha256'), 'utf8'),
])

const digestFile = digestBytes.toString('utf8')
const digest = JSON.parse(digestFile)

/** The checksum file is `shasum` format: one `<hash>  <name>` line per artifact. */
const checksums = new Map(
  checksumFile
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [hash, name] = line.trim().split(/\s+/)
      return [name, hash]
    }),
)

if (digest.source?.digestVersion !== DIGEST_VERSION) {
  throw new Error(
    `mastercam/digest.json is at digest version ${digest.source?.digestVersion} and ` +
      `scripts/mastercam-schema.mjs writes ${DIGEST_VERSION} — re-run pnpm mastercam:adopt`,
  )
}
if (checksums.get('reference.TOOLDB') !== digest.source?.sha256) {
  throw new Error(
    'mastercam/schema.sha256 does not match the reference hash recorded in ' +
      'mastercam/digest.json — one of the two was edited by hand; re-run pnpm mastercam:adopt',
  )
}
// The check that catches a changed *rule*. Re-deriving the file from its own
// parsed contents cannot: an edit that drops a table round-trips perfectly.
// Only a hash of the bytes notices.
const digestChecksum = sha256Of(digestBytes)
if (checksums.get('digest.json') !== digestChecksum) {
  throw new Error(
    `mastercam/digest.json hashes to ${digestChecksum.slice(0, 12)} and ` +
      `mastercam/schema.sha256 records ${String(checksums.get('digest.json')).slice(0, 12)} — ` +
      `the digest was edited by hand rather than derived; re-run pnpm mastercam:adopt`,
  )
}
if (serialize(digest) !== digestFile) {
  throw new Error(
    'mastercam/digest.json is not in the form pnpm mastercam:adopt writes — ' +
      'it has been hand-edited or reformatted; re-run pnpm mastercam:adopt',
  )
}

const tables = Object.entries(digest.tables ?? {})
if (tables.length === 0) {
  // Guards every rule below: an empty digest would satisfy all of them and
  // leave the exporter's schema test asserting nothing.
  throw new Error('mastercam/digest.json names no tables')
}
let indexCount = 0
for (const [name, entry] of tables) {
  if (typeof entry?.sql !== 'string' || !entry.sql.includes(`[${name}]`)) {
    throw new Error(`mastercam/digest.json table ${name} does not hold its own CREATE TABLE text`)
  }
  if (!Array.isArray(entry.columns) || entry.columns.length === 0) {
    throw new Error(`mastercam/digest.json table ${name} names no columns`)
  }
  const columns = new Set(entry.columns.map((column) => column.name))
  if (columns.size !== entry.columns.length) {
    throw new Error(`mastercam/digest.json table ${name} names a column twice`)
  }
  if (!Array.isArray(entry.indexes)) {
    throw new Error(`mastercam/digest.json table ${name} names no index list`)
  }
  for (const index of entry.indexes) {
    indexCount += 1
    // An index key naming a column the table does not have would encode
    // against nothing, and the failure would land as a malformed database
    // rather than as anything a reader could act on.
    const unknown = index.columns.filter((column) => !columns.has(column))
    if (unknown.length > 0) {
      throw new Error(
        `mastercam/digest.json index ${index.name} keys on ${unknown.join(', ')}, ` +
          `which ${name} does not have`,
      )
    }
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
for (const [table, guids] of Object.entries(SEED)) {
  if (!(table in digest.tables)) {
    throw new Error(`mastercam/digest.json seeds ${table}, which its schema does not define`)
  }
  const rows = digest.seed?.[table]
  if (!Array.isArray(rows)) {
    throw new Error(`mastercam/digest.json holds no seed rows for ${table}`)
  }
  const held = rows.map((row) => row.ID)
  for (const id of held) {
    if (!GUID.test(String(id))) {
      throw new Error(`mastercam/digest.json seed row in ${table} has a malformed guid: ${id}`)
    }
  }
  // Set equality in both directions: a guid added to SEED without re-adopting
  // describes a row that is not there, and one removed leaves a row nothing
  // accounts for.
  const expected = [...guids].sort().join(',')
  const actual = [...held].sort().join(',')
  if (expected !== actual) {
    throw new Error(
      `mastercam/digest.json seeds ${table} with rows that do not match SEED in ` +
        `scripts/mastercam-schema.mjs — re-run pnpm mastercam:adopt`,
    )
  }
}
const seeded = Object.keys(digest.seed ?? {})
const unexpected = seeded.filter((table) => !(table in SEED))
if (unexpected.length > 0) {
  throw new Error(
    `mastercam/digest.json seeds tables SEED does not name: ${unexpected.join(', ')} — ` +
      `re-run pnpm mastercam:adopt`,
  )
}

const seedRows = Object.values(digest.seed).reduce((total, rows) => total + rows.length, 0)
process.stdout.write(
  `Verified Mastercam schema version ${digest.source.schemaVersion} ` +
    `(Mastercam ${digest.source.mastercam}, reference ${digest.source.sha256.slice(0, 12)}) — ` +
    `${tables.length} tables, ${indexCount} indexes, ${seedRows} seed rows, ` +
    `adopted ${digest.source.retrievedAt}\n`,
)
