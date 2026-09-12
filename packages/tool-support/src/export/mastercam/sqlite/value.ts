/**
 * The values a row can hold, and the order SQLite puts them in.
 *
 * A `.TOOLDB` is a SQLite database, so this module is not about tooling at all:
 * it is the bottom of the encoder, where a JavaScript value becomes the bytes
 * of a record field and two keys become comparable.
 *
 * Two rules here are easy to get wrong and expensive to get wrong, because
 * both produce a file that encodes cleanly and is then rejected as malformed:
 *
 *   * **affinity**, which decides whether `2` in a `DOUBLE` column is written
 *     as the integer 2 or the float 2.0 — SQLite converts on the way in, and a
 *     file that did not is a file whose `typeof` answers differ from every
 *     other library's; and
 *   * **key order**, which is what an index b-tree is sorted by. Get it wrong
 *     and SQLite's binary search walks off the key it was looking for.
 */

/** A value as it goes into a row. `bigint` is how an integer wider than 2^53 arrives. */
export type SqliteValue = null | number | bigint | string | Uint8Array

/**
 * SQLite's five column affinities.
 *
 * Derived from the declared type by the rules in the file format documentation —
 * substring tests, in a fixed order, on the upper-cased declaration. Mastercam
 * declares `GUID` and `BOOL`, neither of which matches any keyword, so both
 * land on `NUMERIC`, which is the affinity that leaves a blob a blob and an
 * integer an integer. That is why a `GUID` column round-trips.
 */
export type Affinity = 'INTEGER' | 'TEXT' | 'BLOB' | 'REAL' | 'NUMERIC'

/** The affinity SQLite gives a column declared as `declared`. */
export const affinityOf = (declared: string): Affinity => {
  const type = declared.toUpperCase()
  if (type.includes('INT')) return 'INTEGER'
  if (type.includes('CHAR') || type.includes('CLOB') || type.includes('TEXT')) return 'TEXT'
  if (type.includes('BLOB') || type === '') return 'BLOB'
  if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB')) return 'REAL'
  return 'NUMERIC'
}

/**
 * A value as the column's affinity stores it.
 *
 * Only the conversions this encoder can actually meet are made. SQLite also
 * converts text that looks numeric into a number under `NUMERIC` and `INTEGER`
 * affinity; nothing here writes a number as text in the first place, so
 * attempting it would be untested code standing between a caller and a
 * corrupted file.
 */
export const applyAffinity = (value: SqliteValue, affinity: Affinity): SqliteValue => {
  if (value === null || typeof value === 'string' || value instanceof Uint8Array) return value
  if (affinity === 'REAL') return Number(value)
  if (affinity === 'INTEGER' || affinity === 'NUMERIC') {
    // A float that is exactly an integer is stored as one under these two
    // affinities — the same narrowing SQLite does, and what keeps `IsMetric`
    // reading back as `integer` rather than `real`.
    if (typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value)) {
      return value
    }
    return value
  }
  return value
}

/** Where a value sits in SQLite's cross-type ordering: NULL < number < text < blob. */
const storageClass = (value: SqliteValue): number => {
  if (value === null) return 0
  if (typeof value === 'number' || typeof value === 'bigint') return 1
  if (typeof value === 'string') return 2
  return 3
}

const compareBytes = (left: Uint8Array, right: Uint8Array): number => {
  const shared = Math.min(left.length, right.length)
  for (let at = 0; at < shared; at += 1) {
    const a = left[at] as number
    const b = right[at] as number
    if (a !== b) return a < b ? -1 : 1
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1
}

/**
 * Two values in index order, under the BINARY collation.
 *
 * BINARY is the only collation Mastercam's schema declares, and it is `memcmp`
 * on the UTF-8 bytes — **not** a JavaScript string comparison, which orders by
 * UTF-16 code unit and disagrees above the BMP. Encoding to UTF-8 first is what
 * makes an emoji in a tool name sort where SQLite will look for it.
 */
const compareValues = (left: SqliteValue, right: SqliteValue): number => {
  const leftClass = storageClass(left)
  const rightClass = storageClass(right)
  if (leftClass !== rightClass) return leftClass < rightClass ? -1 : 1
  switch (leftClass) {
    case 0:
      return 0
    case 1: {
      const a = left as number | bigint
      const b = right as number | bigint
      if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0
      return Number(a) < Number(b) ? -1 : Number(a) > Number(b) ? 1 : 0
    }
    case 2:
      return compareBytes(utf8(left as string), utf8(right as string))
    default:
      return compareBytes(left as Uint8Array, right as Uint8Array)
  }
}

/** Index keys in order, comparing column by column. */
export const compareKeys = (
  left: readonly SqliteValue[],
  right: readonly SqliteValue[],
): number => {
  const shared = Math.min(left.length, right.length)
  for (let at = 0; at < shared; at += 1) {
    const order = compareValues(left[at] as SqliteValue, right[at] as SqliteValue)
    if (order !== 0) return order
  }
  return left.length - right.length
}

const encoder = new TextEncoder()

/** A string as UTF-8, which is the only encoding this writer emits. */
export const utf8 = (text: string): Uint8Array => encoder.encode(text)
