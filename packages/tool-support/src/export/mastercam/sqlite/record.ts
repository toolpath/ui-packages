/**
 * A row as SQLite's record format.
 *
 * The shape is a header followed by bodies: a varint giving the header's own
 * length *including that varint*, then one **serial type** varint per column,
 * then each column's bytes in the same order. The serial type carries both the
 * type and, for text and blobs, the length — which is why there is no separate
 * length field and why a record cannot be written without deciding every
 * column's type first.
 *
 * The self-including header length is the subtle part. Its value changes the
 * number of bytes it occupies, which changes its value: a header of 127 bytes
 * of serial types needs a 1-byte varint and totals 128, which needs a 2-byte
 * varint, which totals 129. {@link headerLength} solves that rather than
 * guessing, because the file it produces is only wrong at the one size where a
 * guess lands on the boundary.
 */

import { applyAffinity, utf8, type Affinity, type SqliteValue } from './value.js'

/** The bytes of a SQLite varint: big-endian, seven bits per byte, high bit continues. */
export const encodeVarint = (value: number | bigint): Uint8Array => {
  let remaining = BigInt(value)
  if (remaining < 0n) remaining += 1n << 64n
  if (remaining > 0xffffffffffffffffn) throw new Error(`Varint out of range: ${value}`)
  // Nine bytes is the maximum, and the ninth carries eight bits rather than
  // seven — the format's one irregularity, so that a full 64-bit value fits.
  if (remaining > 0x00ffffffffffffffn) {
    const bytes = new Uint8Array(9)
    bytes[8] = Number(remaining & 0xffn)
    remaining >>= 8n
    for (let at = 7; at >= 0; at -= 1) {
      bytes[at] = Number((remaining & 0x7fn) | 0x80n)
      remaining >>= 7n
    }
    return bytes
  }
  const parts: number[] = []
  do {
    parts.unshift(Number(remaining & 0x7fn))
    remaining >>= 7n
  } while (remaining > 0n)
  for (let at = 0; at < parts.length - 1; at += 1) parts[at] = (parts[at] as number) | 0x80
  return Uint8Array.from(parts)
}

/** How many bytes {@link encodeVarint} would produce, without producing them. */
export const varintSize = (value: number | bigint): number => {
  let remaining = BigInt(value)
  if (remaining < 0n) remaining += 1n << 64n
  if (remaining > 0x00ffffffffffffffn) return 9
  let size = 1
  while (remaining > 0x7fn) {
    remaining >>= 7n
    size += 1
  }
  return size
}

/** The smallest signed big-endian width SQLite has a serial type for. */
const integerWidth = (value: bigint): 1 | 2 | 3 | 4 | 6 | 8 => {
  const fits = (bits: bigint) => value >= -(1n << (bits - 1n)) && value < 1n << (bits - 1n)
  if (fits(8n)) return 1
  if (fits(16n)) return 2
  if (fits(24n)) return 3
  if (fits(32n)) return 4
  if (fits(48n)) return 6
  return 8
}

const SERIAL_FOR_WIDTH: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 6: 5, 8: 6 }

interface Field {
  readonly serial: number | bigint
  readonly body: Uint8Array
}

const EMPTY = new Uint8Array(0)

const bigEndian = (value: bigint, width: number): Uint8Array => {
  const bytes = new Uint8Array(width)
  let remaining = value < 0n ? value + (1n << BigInt(width * 8)) : value
  for (let at = width - 1; at >= 0; at -= 1) {
    bytes[at] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  return bytes
}

const float64 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setFloat64(0, value, false)
  return bytes
}

/** One column as its serial type and body. */
const field = (value: SqliteValue): Field => {
  if (value === null) return { serial: 0, body: EMPTY }
  if (value instanceof Uint8Array) return { serial: 12 + value.length * 2, body: value }
  if (typeof value === 'string') {
    const body = utf8(value)
    return { serial: 13 + body.length * 2, body }
  }
  if (typeof value === 'bigint') {
    const width = integerWidth(value)
    return { serial: SERIAL_FOR_WIDTH[width] as number, body: bigEndian(value, width) }
  }
  if (Number.isInteger(value) && Number.isSafeInteger(value)) {
    // Zero and one have their own serial types and occupy no body at all. Every
    // boolean column in Mastercam's schema is one of the two, so this is most
    // of the file.
    if (value === 0) return { serial: 8, body: EMPTY }
    if (value === 1) return { serial: 9, body: EMPTY }
    const width = integerWidth(BigInt(value))
    return { serial: SERIAL_FOR_WIDTH[width] as number, body: bigEndian(BigInt(value), width) }
  }
  return { serial: 7, body: float64(value) }
}

/**
 * The header length that describes itself.
 *
 * Solved rather than computed: start from the length of the serial types alone
 * and grow until the varint that states the total is the same size as the one
 * already counted. Two iterations at most, and the loop is what stops the
 * 127-to-128 boundary being a silently malformed record.
 */
const headerLength = (serialBytes: number): number => {
  let size = varintSize(serialBytes + 1)
  for (;;) {
    const next = varintSize(serialBytes + size)
    if (next === size) return serialBytes + size
    size = next
  }
}

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  let total = 0
  for (const part of parts) total += part.length
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * A row as a record, with each value narrowed by its column's affinity first.
 *
 * `affinities` is positional and must describe every value — it comes from the
 * pinned schema rather than from the caller, so a row written against the wrong
 * table is a length mismatch here and not a type surprise in Mastercam.
 */
export const encodeRecord = (
  values: readonly SqliteValue[],
  affinities: readonly Affinity[],
): Uint8Array => {
  if (values.length !== affinities.length) {
    throw new Error(`Row has ${values.length} values for ${affinities.length} columns`)
  }
  const fields = values.map((value, at) => field(applyAffinity(value, affinities[at] as Affinity)))
  const serials = fields.map((entry) => encodeVarint(entry.serial))
  let serialBytes = 0
  for (const serial of serials) serialBytes += serial.length
  const header = headerLength(serialBytes)
  return concat([encodeVarint(header), ...serials, ...fields.map((entry) => entry.body)])
}
