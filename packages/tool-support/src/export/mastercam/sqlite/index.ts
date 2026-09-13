/**
 * A minimal SQLite file writer.
 *
 * Not a database: there is no query, no update and no delete. It encodes a
 * schema and its rows into the bytes of a `.sqlite` file, once, which is all a
 * `.TOOLDB` export needs and all that can be done without a dependency.
 *
 * It lives under `export/mastercam` rather than beside the domain because it is
 * not domain code — nothing here knows what a tool is. If a second format ever
 * needs SQLite it should move up a level, not be written again.
 */

export { DEFAULT_PAGE_SIZE, encodeDatabase } from './database.js'
export type { Row, TableSpec } from './database.js'
