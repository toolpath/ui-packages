/**
 * Move `mastercam/` forward onto a new Mastercam schema — the counterpart of
 * `adopt-fusion-schema.mjs`, and the only supported way to change
 * `mastercam/digest.json`.
 *
 * Usage:
 *
 *     pnpm mastercam:adopt -- /path/to/reference.TOOLDB
 *
 * There is no `--fetch`. Autodesk publishes its schema at a URL; Mastercam
 * ships its own inside every tool database it writes, so adopting means handing
 * this script a library written by the Mastercam release being adopted. Any
 * library will do — the derivation reads only the schema text and the seed rows
 * Mastercam ships, so two shops' files produce the same digest.
 *
 * The reference itself is not copied into the tree, and neither is its name.
 * See `mastercam-schema.mjs` for what does and does not come across.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { repositoryRoot, run } from './lib.mjs'
import { derive, serialize, sha256Of } from './mastercam-schema.mjs'

const args = process.argv.slice(2).filter((argument) => argument !== '--')
if (args.length !== 1) {
  throw new Error('Usage: pnpm mastercam:adopt -- /path/to/reference.TOOLDB')
}
const reference = resolve(args[0])
const sha256 = sha256Of(await readFile(reference))

// The retrieved date and not a timestamp: a second adopt of the same schema on
// the same day should produce the same bytes, so a no-op adopt is an empty diff
// rather than a churned one.
const retrievedAt = new Date().toISOString().slice(0, 10)
const digest = derive(reference, { sha256, retrievedAt })

// Two checksums, because they answer two different questions. The first is
// "the database we read is this database" — traceability for the file a
// maintainer happened to adopt from. The second is "the digest is the one this
// script wrote", and it is what makes a hand edit to digest.json fail
// `mastercam:verify`: re-deriving the file from its own parsed contents cannot
// notice a changed rule, but a hash of its bytes can. Same standing
// `fusion/schema.sha256` has.
const mastercamRoot = join(repositoryRoot, 'mastercam')
const serialized = serialize(digest)
await Promise.all([
  writeFile(join(mastercamRoot, 'digest.json'), serialized, 'utf8'),
  writeFile(
    join(mastercamRoot, 'schema.sha256'),
    `${sha256}  reference.TOOLDB\n${sha256Of(Buffer.from(serialized, 'utf8'))}  digest.json\n`,
    'utf8',
  ),
])

// The exporter cannot read the digest at runtime — the package imports no
// `fs` — so the same content is written into its source tree as well. Both
// come from this one derivation, which is what keeps them from drifting.
await run(
  'node',
  [join(repositoryRoot, 'scripts', 'generate-mastercam-schema.mjs')],
  repositoryRoot,
  {
    quiet: true,
  },
)

const seedRows = Object.values(digest.seed).reduce((total, rows) => total + rows.length, 0)
process.stdout.write(
  `Adopted Mastercam schema version ${digest.source.schemaVersion} ` +
    `(Mastercam ${digest.source.mastercam}) from reference ${sha256.slice(0, 12)} — ` +
    `${Object.keys(digest.tables).length} tables, ${seedRows} seed rows\n`,
)
