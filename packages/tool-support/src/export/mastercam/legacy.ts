/**
 * `TlTool.OpToolInfo` — the fixed 1024-byte record Mastercam has carried since
 * before the relational schema existed.
 *
 * Most of what it holds is also in columns, and where the two disagree **the
 * columns win**. That is not a guess: eight tools in the reference library
 * carry a blob saying tool number 0 and diameter 0.25 while their columns say
 * something else entirely, and Mastercam loads them without complaint. One tap
 * records 20 threads per inch in the blob and 1/56 in its column, and the
 * column is the one that is right.
 *
 * So this is written as faithfully as it can be and is not the thing a consumer
 * depends on. What that buys is a library that looks to Mastercam like one of
 * its own rather than one with an empty legacy record in every row.
 *
 * ## The layout was read off a real file
 *
 * Every offset below was recovered from the reference and cross-checked against
 * the column that mirrors it. Two fields resisted: a flag at `0x50` taking
 * 8, 16 or 64, and a short at `0x54` that is almost always 2. Neither tracks
 * anything else in the row — not the coolant, not the material, not the unit
 * system — so they are written as the value the reference uses most and
 * labelled unidentified rather than given an invented meaning.
 */

/** The record is a fixed size, and Mastercam pads the tail with this rather than zero. */
const SIZE = 1024
const PAD = 0xfe
const NAME_AT = 0x56

/** Room for the name, less its NUL terminator, in UTF-16 code units. */
const NAME_LIMIT = (SIZE - NAME_AT - 2) / 2

export interface LegacyToolRecord {
  readonly toolNumber: number
  readonly mcToolType: number
  /** The coarse radius class — see `MC_RADIUS_CLASS`. */
  readonly radiusClass: number
  /** Every length here is inches, which is the only unit this format stores. */
  readonly diameter: number
  readonly cornerRadius: number
  /** Threads per inch: the reciprocal of the pitch, which is how the blob spells it. */
  readonly threadsPerInch: number
  readonly taperAngle: number
  readonly diameterOffset: number
  readonly lengthOffset: number
  readonly feedRate: number
  readonly plungeRate: number
  readonly retractRate: number
  readonly spindleSpeed: number
  readonly fluteCount: number
  readonly name: string
}

/**
 * The record's bytes.
 *
 * Little-endian throughout, and the name is UTF-16LE — the encoding a Windows
 * program of that vintage wrote, not UTF-8.
 */
export const legacyToolRecord = (tool: LegacyToolRecord): Uint8Array => {
  const bytes = new Uint8Array(SIZE).fill(PAD)
  const view = new DataView(bytes.buffer)

  view.setInt32(0x00, tool.toolNumber, true)
  view.setInt16(0x04, tool.mcToolType, true)
  view.setInt16(0x06, tool.radiusClass, true)
  view.setFloat64(0x08, tool.diameter, true)
  view.setFloat64(0x10, tool.cornerRadius, true)
  view.setFloat64(0x18, tool.threadsPerInch, true)
  view.setFloat64(0x20, tool.taperAngle, true)
  view.setInt32(0x28, tool.diameterOffset, true)
  view.setInt32(0x2c, tool.lengthOffset, true)
  view.setFloat64(0x30, tool.feedRate, true)
  view.setFloat64(0x38, tool.plungeRate, true)
  view.setFloat64(0x40, tool.retractRate, true)
  view.setInt32(0x48, tool.spindleSpeed, true)
  view.setInt32(0x4c, 0, true)
  view.setInt16(0x50, 8, true) // unidentified; 8 is the reference's commonest
  view.setInt16(0x52, tool.fluteCount, true)
  view.setInt16(0x54, 2, true) // unidentified; 2 on all but four reference rows

  // Truncated by code point rather than by code unit, so a name cut at the
  // limit cannot end in half a surrogate pair — which would be a lone unpaired
  // unit in the file, not a character.
  let units = 0
  let at = NAME_AT
  for (const character of tool.name) {
    const encoded = character.length
    if (units + encoded > NAME_LIMIT) break
    for (let index = 0; index < encoded; index += 1) {
      view.setUint16(at, character.charCodeAt(index), true)
      at += 2
    }
    units += encoded
  }
  view.setUint16(at, 0, true)
  return bytes
}
