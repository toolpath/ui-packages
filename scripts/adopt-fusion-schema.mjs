/**
 * Move `fusion/` forward onto a new publication of Autodesk's tool-library
 * schema — the counterpart of `adopt-openapi.mjs`, and the only supported way
 * to change `fusion/digest.json`.
 *
 * Usage:
 *
 *     pnpm fusion:adopt -- --fetch
 *     pnpm fusion:adopt -- /path/to/ToolLibrary.schema.json
 *
 * `--fetch` reads the live document; a path reads one already on disk, for a
 * maintainer who has it or a network that will not allow the call. Either way
 * the digest is *derived*, never hand-edited: the table in
 * `packages/tool-support/src/export/fusion/schema.ts` is checked against this
 * file by `pnpm test`, so a hand edit here would silently move the thing the
 * test is meant to be measuring against.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { repositoryRoot } from './lib.mjs'
import { SOURCE_URL, derive, serialize, sha256Of } from './fusion-schema.mjs'

const args = process.argv.slice(2).filter((argument) => argument !== '--')
if (args.length !== 1) {
  throw new Error(
    'Usage: pnpm fusion:adopt -- --fetch | pnpm fusion:adopt -- /path/to/ToolLibrary.schema.json',
  )
}
const [source] = args

let bytes
if (source === '--fetch') {
  process.stdout.write(`Fetching ${SOURCE_URL}\n`)
  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`${SOURCE_URL} answered ${response.status} ${response.statusText}`)
  }
  bytes = Buffer.from(await response.arrayBuffer())
} else {
  bytes = await readFile(resolve(source))
}

const schema = JSON.parse(bytes.toString('utf8'))
const sha256 = sha256Of(bytes)

// The retrieved date and not a timestamp: a second adopt on the same document
// on the same day should produce the same bytes, so a no-op adopt is an empty
// diff rather than a churned one.
const retrievedAt = new Date().toISOString().slice(0, 10)
const digest = derive(schema, { sha256, retrievedAt })

// Two checksums, because they answer two different questions. The first is
// "the document we read is this document" — it moves when Autodesk publishes.
// The second is "the digest is the one this script wrote", and it is what
// makes a hand edit to digest.json fail `fusion:verify`: re-deriving the file
// from its own parsed contents cannot notice a changed rule, but a hash of
// its bytes can. Same standing `openapi/openapi.sha256` has.
const fusionRoot = join(repositoryRoot, 'fusion')
const serialized = serialize(digest)
await Promise.all([
  writeFile(join(fusionRoot, 'digest.json'), serialized, 'utf8'),
  writeFile(
    join(fusionRoot, 'schema.sha256'),
    `${sha256}  ToolLibrary.schema.json\n${sha256Of(Buffer.from(serialized, 'utf8'))}  digest.json\n`,
    'utf8',
  ),
])

const variants = Object.values(digest.types).filter((entry) => 'variants' in entry).length
process.stdout.write(
  `Adopted Autodesk tool-library schema ${sha256.slice(0, 12)} — ` +
    `${Object.keys(digest.types).length} types (${variants} with alternatives), ` +
    `library version minimum ${digest.library.version.minimum}\n`,
)
