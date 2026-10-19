/**
 * Guids, in the byte order Mastercam stores them.
 *
 * A `.TOOLDB` keeps every identifier as a sixteen-byte blob in .NET's
 * `Guid.ToByteArray()` layout, which is **not** RFC 4122's. The first three
 * groups are little-endian and the last two are not, so reading the bytes as a
 * plain big-endian uuid produces a well-formed string naming a different guid —
 * a failure with no symptom until two libraries disagree about which tool is
 * which. The swap is the whole point of this module.
 *
 * ## Two kinds of identifier
 *
 * A tool's guid and a holder's guid are the **caller's**, carried through
 * unchanged. `catalog.ts` says why: an identifier invented at export time makes
 * every re-export look to the CAM system like a new tool, so a catalog exported
 * monthly accumulates twelve copies of itself instead of updating one.
 *
 * The format also demands guids for rows that exist only inside the file — a
 * locator, a connection, a set of operation parameters, an empty accessory
 * collection. Nobody outside the file refers to those, but they still have to
 * be stable, or the same catalog exported twice would produce two files that
 * differ in every row. {@link derivedGuid} makes them from the guid they hang
 * off, so stability comes from the caller's identifier rather than from a
 * counter.
 */

/** The all-zero guid, which Mastercam uses where a reference is absent. */
export const EMPTY_GUID: Uint8Array = new Uint8Array(16)

const HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Whether `text` is a guid in the form {@link guidBytes} accepts. */
export const isGuid = (text: string): boolean => HEX.test(text.toLowerCase())

/**
 * A guid's sixteen bytes, in the order Mastercam writes them.
 *
 * The first three groups are byte-reversed and the last two are not, which is
 * `Guid.ToByteArray()` exactly.
 */
export const guidBytes = (text: string): Uint8Array => {
  const lower = text.toLowerCase()
  if (!HEX.test(lower)) throw new Error(`Not a guid: ${text}`)
  const hex = lower.replace(/-/g, '')
  const bytes = new Uint8Array(16)
  for (let at = 0; at < 16; at += 1) {
    bytes[at] = Number.parseInt(hex.slice(at * 2, at * 2 + 2), 16)
  }
  const swap = (from: number, length: number) => bytes.subarray(from, from + length).reverse()
  swap(0, 4)
  swap(4, 2)
  swap(6, 2)
  return bytes
}

/** The inverse of {@link guidBytes}, for reading a library back. */
export const guidText = (bytes: Uint8Array): string => {
  if (bytes.length !== 16) throw new Error(`A guid is sixteen bytes, not ${bytes.length}`)
  const ordered = Uint8Array.from(bytes)
  const swap = (from: number, length: number) => ordered.subarray(from, from + length).reverse()
  swap(0, 4)
  swap(4, 2)
  swap(6, 2)
  const hex = [...ordered].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const MASK = (1n << 64n) - 1n

/** SplitMix64, the standard finaliser — chosen because it is specified, not invented here. */
const splitmix64 = (seed: bigint): bigint => {
  let z = (seed + 0x9e3779b97f4a7c15n) & MASK
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK
  return z ^ (z >> 31n)
}

/** FNV-1a over the tag, so two different roles off one parent diverge. */
const fnv1a = (text: string): bigint => {
  let hash = 0xcbf29ce484222325n
  for (const unit of new TextEncoder().encode(text)) {
    hash = ((hash ^ BigInt(unit)) * 0x100000001b3n) & MASK
  }
  return hash
}

const readU64 = (bytes: Uint8Array, at: number): bigint => {
  let value = 0n
  for (let index = 0; index < 8; index += 1) value = (value << 8n) | BigInt(bytes[at + index] ?? 0)
  return value
}

/**
 * A stable guid for a thing identified by its name rather than by a guid.
 *
 * A vendor is the case this exists for. Two tools from one brand must land on
 * **one** `TlManufacturer` row, so the identifier has to come from the name —
 * deriving it from each tool's own guid gives a brand as many rows as it has
 * tools, all identical but for the key nobody sees.
 *
 * Carries the same caveat as {@link derivedGuid} about its version nibble.
 */
export const namedGuid = (name: string): Uint8Array => {
  const salt = fnv1a(name)
  return stamp(splitmix64(salt), splitmix64(salt ^ 0xa5a5a5a5a5a5a5a5n))
}

/**
 * A stable guid for a row that exists only inside the file.
 *
 * Derived from the guid it belongs to and a tag naming its role, so the same
 * input always produces the same file and two roles off one parent never
 * collide.
 *
 * **It is stamped version 4 and it is not random.** Version 4 means randomly
 * generated, and this is a deterministic mix — the honest alternative is
 * version 5, which is SHA-1, which is `node:crypto`, which this package may not
 * import. Nothing outside the file reads these, and Mastercam checks the
 * variant bits rather than where the value came from, so the label is wrong in
 * a way nothing acts on. It is recorded here rather than glossed over.
 */
export const derivedGuid = (parent: string, tag: string): Uint8Array => {
  const source = guidBytes(parent)
  const salt = fnv1a(tag)
  const high = splitmix64(readU64(source, 0) ^ salt)
  const low = splitmix64(readU64(source, 8) + salt)

  return stamp(high, low)
}

/** Two 64-bit halves as guid bytes, with the version and variant nibbles set. */
const stamp = (high: bigint, low: bigint): Uint8Array => {
  const bytes = new Uint8Array(16)
  for (let at = 0; at < 8; at += 1) {
    bytes[at] = Number((high >> BigInt(56 - at * 8)) & 0xffn)
    bytes[at + 8] = Number((low >> BigInt(56 - at * 8)) & 0xffn)
  }
  // The version and variant nibbles sit where `Guid.ToByteArray()` puts them,
  // which is not where RFC 4122 puts them in the wire order.
  bytes[7] = ((bytes[7] as number) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80
  return bytes
}
