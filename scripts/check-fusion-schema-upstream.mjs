/**
 * Ask Autodesk whether the tool-library schema has moved.
 *
 * The one check in this repository that talks to a third party, which is why
 * it is **not** in `pnpm check`: a gate that calls `cam.autodesk.com` goes red
 * when Autodesk is down rather than when this repository is wrong. It runs on
 * a schedule instead, and its failure is the trigger for an adopt.
 *
 * ## How a change upstream becomes a failing test
 *
 * This script only notices. What makes the change impossible to ignore is the
 * chain it starts:
 *
 *   1. this fails on the scheduled run;
 *   2. someone runs `pnpm fusion:adopt -- --fetch`, so `fusion/digest.json`
 *      moves in the diff;
 *   3. `packages/tool-support/tests/export-fusion-schema.test.ts` then fails,
 *      because the table the exporter actually reads no longer equals the
 *      digest;
 *   4. the table is reconciled — or, where the change missed every type this
 *      repository exports, the test goes green on the adopt alone and the
 *      diff records that it did.
 *
 * Step 3 is the point. Without it an adopt would be a quiet file change.
 *
 * ## Two kinds of difference, reported apart
 *
 * A new hash with an identical digest is Autodesk reformatting, adding a
 * description or changing a type this reduction does not read — worth adopting
 * so the checksum stays honest, but nothing to reconcile. A changed digest is
 * a change to the rules. The exit code is the same; the message is not,
 * because the two cost very different amounts of attention.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'
import { SOURCE_URL, derive, serialize, sha256Of } from './fusion-schema.mjs'

const fusionRoot = join(repositoryRoot, 'fusion')
const digestFile = await readFile(join(fusionRoot, 'digest.json'), 'utf8')
const current = JSON.parse(digestFile)

process.stdout.write(`Fetching ${SOURCE_URL}\n`)
const response = await fetch(SOURCE_URL)
if (!response.ok) {
  throw new Error(`${SOURCE_URL} answered ${response.status} ${response.statusText}`)
}
const bytes = Buffer.from(await response.arrayBuffer())
const sha256 = sha256Of(bytes)

if (sha256 === current.source.sha256) {
  process.stdout.write(`Autodesk tool-library schema is unchanged (${sha256.slice(0, 12)})\n`)
  process.exit(0)
}

// Re-derive with the retained date and hash so the comparison is of the rules
// alone. Those two fields differ by construction and would mask the answer.
const fresh = derive(JSON.parse(bytes.toString('utf8')), {
  sha256: current.source.sha256,
  retrievedAt: current.source.retrievedAt,
})

const rulesChanged = serialize(fresh) !== digestFile
const detail = rulesChanged
  ? 'The rules this repository reads have changed. Adopting will move fusion/digest.json, ' +
    'and export-fusion-schema.test.ts will fail until the table in ' +
    'packages/tool-support/src/export/fusion/schema.ts is reconciled.'
  : 'The document changed but no rule this repository reads did — adopting updates the ' +
    'checksum and leaves the digest identical.'

process.stderr.write(
  `Autodesk has published a new tool-library schema.\n` +
    `  retained: ${current.source.sha256} (${current.source.retrievedAt})\n` +
    `  upstream: ${sha256}\n` +
    `${detail}\n` +
    `Run: pnpm fusion:adopt -- --fetch\n`,
)
process.exit(1)
