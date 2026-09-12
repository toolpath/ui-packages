/**
 * Prove the checked-in Fusion schema digest is internally consistent — the
 * offline, hermetic half of watching Autodesk's document, and the one that
 * joins `pnpm check`.
 *
 * It answers three questions and deliberately not a fourth:
 *
 *   * is `digest.json` parseable and shaped the way this repository's
 *     derivation writes it;
 *   * does `schema.sha256` agree with the hash recorded inside the digest —
 *     two files that can only be written together by `fusion:adopt`, so a
 *     hand edit to either shows up here;
 *   * is the digest byte-identical to `serialize()`ing what was parsed, which
 *     catches a hand edit that reordered keys or changed the indentation and
 *     would otherwise make a later adopt produce a spurious diff.
 *
 * It does **not** ask whether Autodesk has since published something new. That
 * needs the network, and a gate that calls a third party fails when the third
 * party is down rather than when this repository is wrong. `pnpm
 * fusion:check-upstream` asks it, on a schedule.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'
import { DIGEST_VERSION, SOURCE_URL, serialize, sha256Of } from './fusion-schema.mjs'

const fusionRoot = join(repositoryRoot, 'fusion')
const [digestBytes, checksumFile] = await Promise.all([
  readFile(join(fusionRoot, 'digest.json')),
  readFile(join(fusionRoot, 'schema.sha256'), 'utf8'),
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
const recordedChecksum = checksums.get('ToolLibrary.schema.json')
const recordedDigestChecksum = checksums.get('digest.json')

if (digest.source?.url !== SOURCE_URL) {
  throw new Error(
    `fusion/digest.json was derived from ${digest.source?.url} but this repository ` +
      `reads ${SOURCE_URL} — re-run pnpm fusion:adopt`,
  )
}
if (digest.source?.digestVersion !== DIGEST_VERSION) {
  throw new Error(
    `fusion/digest.json is at digest version ${digest.source?.digestVersion} and ` +
      `scripts/fusion-schema.mjs writes ${DIGEST_VERSION} — re-run pnpm fusion:adopt`,
  )
}
if (recordedChecksum !== digest.source?.sha256) {
  throw new Error(
    'fusion/schema.sha256 does not match the upstream hash recorded in fusion/digest.json — ' +
      'one of the two was edited by hand; re-run pnpm fusion:adopt',
  )
}
// The check that catches a changed *rule*. Re-deriving the file from its own
// parsed contents cannot: an edit that drops a required key round-trips
// perfectly. Only a hash of the bytes notices.
const digestChecksum = sha256Of(digestBytes)
if (recordedDigestChecksum !== digestChecksum) {
  throw new Error(
    `fusion/digest.json hashes to ${digestChecksum.slice(0, 12)} and fusion/schema.sha256 ` +
      `records ${String(recordedDigestChecksum).slice(0, 12)} — the digest was edited by hand ` +
      `rather than derived; re-run pnpm fusion:adopt`,
  )
}
if (serialize(digest) !== digestFile) {
  throw new Error(
    'fusion/digest.json is not in the form pnpm fusion:adopt writes — ' +
      'it has been hand-edited or reformatted; re-run pnpm fusion:adopt',
  )
}

const types = Object.keys(digest.types ?? {})
if (types.length === 0) {
  // Guards every rule above: an empty digest would satisfy all of them and
  // leave the test that reads it asserting nothing.
  throw new Error('fusion/digest.json names no tool types')
}
for (const [name, entry] of Object.entries(digest.types)) {
  const shapes = entry.variants ?? [entry]
  for (const shape of shapes) {
    for (const key of ['recordRequired', 'recordAllowed', 'geometryRequired', 'geometryAllowed']) {
      if (!Array.isArray(shape[key])) {
        throw new Error(`fusion/digest.json type ${JSON.stringify(name)} has no ${key}`)
      }
    }
    for (const [required, allowed, what] of [
      [shape.recordRequired, shape.recordAllowed, 'record key'],
      [shape.geometryRequired, shape.geometryAllowed, 'geometry key'],
    ]) {
      const unknown = required.filter((key) => !allowed.includes(key))
      if (unknown.length > 0) {
        throw new Error(
          `fusion/digest.json type ${JSON.stringify(name)} requires a ${what} it does not ` +
            `permit: ${unknown.join(', ')}`,
        )
      }
    }
    // Every entry in `data` requires a guid, and a profile that lost it lost
    // the library-level constraints on the way down — which would mean the
    // reduction merged the wrong things.
    if (!shape.recordRequired.includes('guid')) {
      throw new Error(
        `fusion/digest.json type ${JSON.stringify(name)} does not require a guid — ` +
          `the entry-level constraints did not reach it`,
      )
    }
  }
}

process.stdout.write(
  `Verified Autodesk tool-library schema digest ${digest.source.sha256.slice(0, 12)} ` +
    `(${types.length} types, retrieved ${digest.source.retrievedAt})\n`,
)
