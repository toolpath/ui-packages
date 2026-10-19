/**
 * The library document, and writing it out.
 *
 * ## Why this does not use `JSON.stringify`
 *
 * `JSON.stringify(25.0)` is `"25"`. JavaScript has one number type and the
 * serializer writes the shortest form that round-trips, so a dimension that
 * happens to land on a whole number loses its decimal point. Everything
 * dimensional is therefore written with a decimal place and counts and flags
 * are not, using {@link FUSION_GEOMETRY_KINDS} and {@link FUSION_PRESET_KINDS}
 * to tell them apart — plus the holder's segments, whose three keys are
 * dimensions that belong to no geometry table.
 *
 * **The reason is that it is known-safe, not that integers are known-fatal.**
 * The rule arrived from a reference implementation reporting that a library
 * carrying `LB: 25` would not load while the same library with `LB: 25.0` did.
 * Measured against 100 tools scanned back out of real Fusion libraries, that
 * is not a general law: those libraries carry bare integers in `DC`, `LB`,
 * `LCF`, `OAL`, `RE`, `TP`, `shoulder-length` and `tip-diameter`, in holder
 * segment heights and diameters, and across 361 presets in `n`, `v_c`, `v_f`,
 * `f_z`, `stepdown` and `v_f_plunge` — with `ramp-angle` never anything but an
 * integer. Fusion evidently reads them.
 *
 * So what the rule buys is not crash avoidance in general. It is that `25.0` is
 * accepted everywhere `25` is, one rule over the whole document is simpler than
 * two, and whatever the reported failure actually was, this side of it cannot
 * be the cause. Worth keeping, not worth believing more than that.
 *
 * ## Stable key order
 *
 * Keys are written in the order the record declares them, and records in the
 * order they were given. A catalog exported twice therefore produces the same
 * bytes, so a diff between two exports shows what changed about the tools
 * rather than what changed about the serializer.
 */

import type { ExportNote, ExportResult } from '../report.js'
import { FUSION_GEOMETRY_KINDS, FUSION_LIBRARY_VERSION, isPresetFloat } from './schema.js'
import { fusionTool, type FusionTool, type ToolRequest } from './tool.js'
import { fusionHolder, type CatalogHolder, type FusionHolder } from './holder.js'

export interface FusionLibrary {
  readonly version: number
  readonly data: readonly (FusionTool | FusionHolder)[]
}

/**
 * Every tool, and every holder shipped on its own.
 *
 * A holder attached to a tool travels inside that tool's record; `holders` is
 * for a crib shipped as entries in its own right.
 */
export interface LibraryRequest {
  readonly tools?: readonly ToolRequest[]
  readonly holders?: readonly CatalogHolder[]
}

/**
 * The document, and an account of everything that did not travel.
 *
 * A tool that cannot be written is left out and said so. A batch is never
 * refused for one bad record: a catalog of four thousand tools always contains
 * a handful the format cannot hold, and failing the lot for them would make
 * this useless on real data.
 */
export const fusionLibrary = (request: LibraryRequest): ExportResult<FusionLibrary> => {
  const data: (FusionTool | FusionHolder)[] = []
  const notes: ExportNote[] = []

  for (const entry of request.tools ?? []) {
    const written = fusionTool(entry)
    notes.push(...written.notes)
    if (written.tool !== null) data.push(written.tool)
  }

  for (const entry of request.holders ?? []) {
    const written = fusionHolder(entry)
    notes.push(...written.notes)
    if (written.holder !== null) data.push(written.holder)
  }

  return { document: { version: FUSION_LIBRARY_VERSION, data }, notes }
}

/** A segment's three keys are all dimensions, whatever a geometry key is called. */
const SEGMENT_KINDS: ReadonlySet<string> = new Set([
  'height',
  'lower-diameter',
  'upper-diameter',
  'gaugeLength',
])

/**
 * Whether a number under this key must keep a decimal point.
 *
 * A count and an offset are integers and Fusion wants them that way; every
 * dimension and every angle is a float. An unknown key is written as JavaScript
 * would — this is not the place to invent a rule for a field nobody has
 * classified.
 */
const isFloat = (key: string): boolean => {
  if (SEGMENT_KINDS.has(key)) return true
  const kind = FUSION_GEOMETRY_KINDS[key]
  if (kind !== undefined) return kind === 'length' || kind === 'angle'
  return isPresetFloat(key)
}

/** `value` with a decimal point, whatever it lands on. */
const asFloat = (value: number): string =>
  Number.isInteger(value) ? `${value}.0` : JSON.stringify(value)

const indentOf = (depth: number): string => '  '.repeat(depth)

const write = (value: unknown, key: string, depth: number): string => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && isFloat(key) ? asFloat(value) : JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((item) => `${indentOf(depth + 1)}${write(item, key, depth + 1)}`)
    return `[\n${items.join(',\n')}\n${indentOf(depth)}]`
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    if (entries.length === 0) return '{}'
    const lines = entries.map(
      ([name, item]) =>
        `${indentOf(depth + 1)}${JSON.stringify(name)}: ${write(item, name, depth + 1)}`,
    )
    return `{\n${lines.join(',\n')}\n${indentOf(depth)}}`
  }
  return JSON.stringify(value)
}

/**
 * The document as the text of a `.tools` file.
 *
 * Writing it somewhere is the caller's — this package imports no `fs`, which is
 * half of what lets a browser, a server route and a Node script share it.
 */
export const fusionLibraryJson = (document: FusionLibrary): string =>
  `${write(document, 'document', 0)}\n`

/**
 * The characters Fusion, a path separator or a Windows filename will not take.
 *
 * A set and a code-point test rather than a character class, deliberately: the
 * barred range includes the control characters, and writing those as escapes in
 * a regex literal is fragile — a formatter that normalises `\u0000` to the byte
 * it denotes leaves an invisible NUL sitting in the source, where the next tool
 * to touch the file may quietly drop it.
 */
const BARRED: ReadonlySet<string> = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

/** The last control character, above which everything is printable. */
const LAST_CONTROL = 0x1f

/**
 * A name Fusion will take for a library.
 *
 * Fusion shows a library's leaf name as its label in the picker, so the scrub
 * has to be stable: the same name always gives the same label. Everything
 * barred collapses to `_` rather than to nothing, because a nameless library is
 * worse than a bluntly named one, and a name that is entirely punctuation still
 * has to come out as something.
 */
export const sanitizeName = (name: string): string => {
  let cleaned = ''
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0
    cleaned += BARRED.has(character) || code <= LAST_CONTROL ? '_' : character
  }
  const trimmed = cleaned.trim().replace(/^\.+|\.+$/g, '')
  return trimmed === '' ? '_' : trimmed.slice(0, 120)
}
