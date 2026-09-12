/**
 * Turn `mastercam/digest.json` into the TypeScript the exporter reads at
 * runtime.
 *
 * The digest is the pinned artifact and the thing a human reviews. It cannot
 * also be what `@toolpath/tool-support` loads: the package imports no `fs`, so
 * a JSON file on disk is not reachable from it, and the schema has to be in the
 * bundle. This writes that copy.
 *
 * It is generated rather than hand-maintained because it is 79 `CREATE TABLE`
 * statements and 39 seed rows — a copy that size, kept by hand, is a copy that
 * drifts. `tests/export-mastercam-schema.test.ts` holds the two together.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './lib.mjs'

const GENERATED = join(
  repositoryRoot,
  'packages/tool-support/src/export/mastercam/schema.generated.ts',
)

const literal = (value) => JSON.stringify(value)

/** The module, as a string, deterministic for a given digest. */
export const render = (digest) => {
  const tables = Object.entries(digest.tables).map(
    ([name, entry]) => `  {
    name: ${literal(name)},
    sql: ${literal(entry.sql)},
    columns: [
${entry.columns.map((column) => `      { name: ${literal(column.name)}, type: ${literal(column.type)} },`).join('\n')}
    ],
    indexes: [
${entry.indexes
  .map(
    (index) =>
      `      { name: ${literal(index.name)}, columns: [${index.columns.map(literal).join(', ')}] },`,
  )
  .join('\n')}
    ],
  },`,
  )

  const seed = Object.entries(digest.seed).map(
    ([table, rows]) => `  ${literal(table)}: [
${rows.map((row) => `    ${literal(row)},`).join('\n')}
  ],`,
  )

  return `/**
 * Mastercam's schema, as the exporter reads it.
 *
 * **Generated. Do not edit.** \`pnpm mastercam:adopt\` writes this from
 * \`mastercam/digest.json\`, and \`tests/export-mastercam-schema.test.ts\` fails
 * when the two disagree — so a hand edit here survives until the next test run.
 *
 * Mastercam ${digest.source.mastercam}, schema version ${digest.source.schemaVersion}.
 */

import type { Row, TableSpec } from './sqlite/index.js'

/** Every table a \`.TOOLDB\` declares, in the order \`sqlite_master\` records them. */
export const MASTERCAM_TABLES: readonly TableSpec[] = [
${tables.join('\n')}
]

/** The schema version this exporter writes, recorded in \`_Header\`. */
export const MASTERCAM_SCHEMA_VERSION = ${digest.source.schemaVersion}

/** The Mastercam release the schema was adopted from, as \`_UpdateLog\` states it. */
export const MASTERCAM_VERSION: readonly [major: number, minor: number] = [${digest.source.mastercam
    .split('.')
    .map(Number)
    .join(', ')}]

/**
 * The rows Mastercam ships in every library, under the guids it ships them
 * under.
 *
 * A tool that names a grade or a material names one of these. Minting our own
 * would produce a library whose tools belong to nothing.
 */
export const MASTERCAM_SEED: Readonly<Record<string, readonly Row[]>> = {
${seed.join('\n')}
}
`
}

const digest = JSON.parse(await readFile(join(repositoryRoot, 'mastercam', 'digest.json'), 'utf8'))
await writeFile(GENERATED, render(digest), 'utf8')
process.stdout.write(
  `Generated schema.generated.ts — ${Object.keys(digest.tables).length} tables, ` +
    `${Object.values(digest.seed).reduce((total, rows) => total + rows.length, 0)} seed rows\n`,
)
