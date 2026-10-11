/**
 * A whole Fusion library document — `{ version, data }` as
 * `ToolLibrary.toJson()` gives it — read into tools.
 *
 * Holders are left out without a note: they are entries in their own right in
 * Fusion, not tools that failed to read — but they are counted in `skipped`,
 * with the rest of what was left out. A type that does not mill or drill —
 * turning, laser, plasma, waterjet, a probe — is left out *with* one, as is any
 * other entry that is not a tool record this package can read. A library is never refused for
 * one bad entry, the rule the exporter keeps on the way out.
 */

import { NON_MILLING_TYPES, readFusionTool, type FusionImport, type ImportNote } from './tool.js'

/** One tool, and where it sits in the document's `data` array. */
export interface FusionLibraryEntry extends FusionImport {
  /**
   * Its position in `data[]` — with the guid, the handle a caller uses to push
   * the original JSON back into Fusion, which keeps what a {@link FusionImport}
   * does not carry.
   */
  readonly index: number
}

/**
 * How many `data[]` entries were not read, by why: a count a caller can show
 * ("12 tools, 3 holders and 1 probe skipped") without parsing notes.
 */
export interface FusionLibrarySkipped {
  /** Holder entries, which are not tools and get no note. */
  readonly holders: number
  /** Tools of a type that does not mill or drill — turning, probe, and the rest. */
  readonly nonMilling: number
  /** Entries that are not a tool record with a type and a unit this package reads. */
  readonly unreadable: number
}

export interface FusionLibraryImport {
  readonly tools: readonly FusionLibraryEntry[]
  /** Every tool's notes, and one per entry that was not read. */
  readonly notes: readonly ImportNote[]
  /**
   * The entries left out, counted. All zero for a document with no `data`
   * array, which is said in `notes` instead.
   */
  readonly skipped: FusionLibrarySkipped
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const fromFusionLibrary = (doc: unknown): FusionLibraryImport => {
  const data = isRecord(doc) ? doc.data : undefined
  if (!Array.isArray(data)) {
    return {
      tools: [],
      notes: [
        {
          subject: '(library)',
          kind: 'skipped',
          field: 'data',
          message: 'the document has no data array, so there is no tool to read',
        },
      ],
      skipped: { holders: 0, nonMilling: 0, unreadable: 0 },
    }
  }

  const tools: FusionLibraryEntry[] = []
  const notes: ImportNote[] = []
  const skipped = { holders: 0, nonMilling: 0, unreadable: 0 }
  data.forEach((entry: unknown, index) => {
    if (isRecord(entry) && entry.type === 'holder') {
      skipped.holders += 1
      return
    }
    const subject = `data[${index}]`
    if (isRecord(entry) && typeof entry.type === 'string' && NON_MILLING_TYPES.has(entry.type)) {
      notes.push({
        subject,
        kind: 'skipped',
        field: 'type',
        message: `a ${JSON.stringify(entry.type)} is not a milling or hole-making tool, so it is not read`,
      })
      skipped.nonMilling += 1
      return
    }
    const read = readFusionTool(entry, subject)
    if (read === null) {
      notes.push({
        subject,
        kind: 'skipped',
        message: 'not a tool record with a type and a unit this package can read',
      })
      skipped.unreadable += 1
      return
    }
    notes.push(...read.notes)
    tools.push({ ...read, index })
  })

  return { tools, notes, skipped }
}
