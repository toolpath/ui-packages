/**
 * One Fusion library entry, read back as a {@link Tool} in millimetres.
 *
 * The inverse of `export/fusion/tool.ts`, and it leans on the same two tables:
 * a Fusion `type` is already a `ToolForm` — `forms.ts` took Fusion's own
 * vocabulary so the mapping is the identity — and `FUSION_GEOMETRY_KINDS`
 * says which geometry keys are lengths, which are the only numbers that move
 * between unit systems.
 *
 * ## What is kept, converted and dropped
 *
 *   * A length is converted from the record's own `unit` into millimetres, the
 *     unit every length in this domain is stored in.
 *   * An angle and a count are the same number in both systems and pass through.
 *   * A boolean or an enum (`CSP`, `HAND`, `thread-tip-type`) has no place in a
 *     numeric `Geometry` and is dropped without a note — nearly every
 *     record carries them, and a note per tool would bury the ones that matter.
 *   * A key `FUSION_GEOMETRY_KINDS` does not classify is dropped *with* a
 *     note: nobody knows whether it is a length, and a guessed conversion is a
 *     wrong number that looks right.
 *   * `LB` — how far the tool stands out of its holder — is stored as `LBH`, the
 *     dictionary's name for the same quantity. The exporter makes the opposite
 *     move, so a round trip lands back on the key it started from.
 *
 * Two readings are supplied where Fusion records commonly leave a gap, each
 * reported as `filled` and marked `derived` in the tool's provenance:
 *
 *   * a ball end mill with no corner radius, or a zero one, has `RE = DC / 2` —
 *     that is what makes it a ball;
 *   * a spot or center drill whose `DC` is zero or absent — the tip is a point —
 *     takes its body diameter, `SFDM`, as `DC`.
 *
 * A chamfer mill's `DC` is **not** swapped for its `SFDM`, as some library
 * browsers do for display: `fitTools` reads `DC` as the cutting diameter, and a
 * chamfer mill's cutting diameter is its tip.
 *
 * ## Known quirks of Fusion's JSON
 *
 *   * **Units are per tool.** One library can mix inch and metric records; each
 *     is converted by its own `unit`, and a record with no recognisable unit is
 *     refused rather than assumed metric.
 *   * `ToolLibrary.toJson()` floats may come back **rounded to three decimals**
 *     after a library is reopened, so an inch value read this way can sit a
 *     few microns from the number originally typed.
 *   * Tip keys (`tip-diameter`, `tip-length`, `tip-offset`) **may read 0** on a
 *     tool that has no meaningful tip; a zero there is carried, not interpreted.
 *   * `Tool.createFromJson()` **drops `product-id` and `vendor`**, so a record
 *     pushed back into Fusion through it loses both; the original JSON keeps
 *     them, which is why a caller holds the entry's `guid` and index rather
 *     than rebuilding a record from the {@link Tool}.
 */

import type { ExportNote } from '../../export/report.js'
import { exported } from '../../export/fusion/geometry.js'
import { fusionValueKind } from '../../export/fusion/schema.js'
import { isToolForm } from '../../forms.js'
import type { Provenance } from '../../provenance.js'
import type { Tool } from '../../tool.js'
import { convertLength, type UnitSystem } from '../../units.js'

/**
 * What a read could not carry across as-is.
 *
 * The exporter's {@link ExportNote}, under a name that reads right on the way
 * in: the four kinds are the same events in the other direction — `coerced`
 * where a Fusion type has no `ToolForm`, `filled` where a reading was
 * supplied, `dropped` where a key had no meaning here, `skipped` where a whole
 * entry was not read. `field` is in Fusion's own names (`geometry.RE`).
 */
export type ImportNote = ExportNote

/**
 * One Fusion tool, as this domain states it, plus the handle back to the entry
 * it came from.
 *
 * Identity and commerce sit beside the {@link Tool} rather than on it, the
 * split `tool.ts` argues for, and under `CatalogTool`'s field names.
 */
export interface FusionImport {
  /** Every length in millimetres, whatever the record's `unit`. */
  readonly tool: Tool
  /** The entry's guid, where it carries one — the handle a caller pushes back by. */
  readonly guid?: string
  /** The system the record stated its numbers in. Not the unit `tool` is in. */
  readonly unit: UnitSystem
  /** Fusion's `description` — the name the library shows. */
  readonly description?: string
  readonly vendor?: string
  /** Fusion's `product-id`: the number a machinist orders by. */
  readonly catalogNumber?: string
  /** Fusion's `post-process.number`: the tool's number in the shop's carousel. */
  readonly number?: number
  readonly notes: readonly ImportNote[]
}

/** The fallback for a note's `subject` when the record names itself nothing. */
const UNNAMED = '(unnamed Fusion tool)'

const UNITS: Readonly<Record<string, UnitSystem>> = {
  millimeters: 'millimeters',
  inches: 'inches',
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A finite number, or a numeric string — Fusion libraries carry both. */
const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** A non-empty string, or `undefined`. */
const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

/**
 * One entry, with `subject` for its notes where it carries no guid.
 *
 * Shared with the library reader, which names an anonymous entry by its index.
 */
export const readFusionTool = (json: unknown, fallbackSubject: string): FusionImport | null => {
  if (!isRecord(json)) return null
  const type = asText(json.type)
  if (type === undefined || type === 'holder') return null
  const unit = typeof json.unit === 'string' ? UNITS[json.unit] : undefined
  if (unit === undefined) return null

  const guid = asText(json.guid)
  const description = asText(json.description)
  const vendor = asText(json.vendor)
  const catalogNumber = asText(json['product-id'])
  const postProcess = isRecord(json['post-process']) ? json['post-process'] : {}
  const number = asNumber(postProcess.number) ?? undefined
  const subject = guid ?? catalogNumber ?? description ?? fallbackSubject

  const notes: ImportNote[] = []
  const note = (kind: ImportNote['kind'], field: string, message: string): void => {
    notes.push({ subject, kind, field, message })
  }

  let form: string = type
  if (type === 'other' || !isToolForm(type)) {
    form = 'other'
    note(
      'coerced',
      'type',
      `${JSON.stringify(type)} is not a tool form this package knows, so it is read as 'other'`,
    )
  }

  const geometry: Record<string, number> = {}
  const raw = isRecord(json.geometry) ? json.geometry : {}
  for (const [key, value] of Object.entries(raw)) {
    const kind = fusionValueKind(key)
    if (kind === 'boolean' || kind === 'enum') continue
    if (kind === null) {
      note(
        'dropped',
        `geometry.${key}`,
        `${key} is not a key whose unit is known, so it is not read`,
      )
      continue
    }
    const number = asNumber(value)
    if (number === null) {
      note('dropped', `geometry.${key}`, `${JSON.stringify(value)} is not a number`)
      continue
    }
    const stated = kind === 'length' ? exported(convertLength(number, unit, 'millimeters')) : number
    geometry[key === 'LB' ? 'LBH' : key] = stated
  }

  const provenance: Record<string, Provenance> = {}

  const { DC, SFDM, RE } = geometry
  if ((form === 'spot drill' || form === 'center drill') && (DC === undefined || DC <= 0)) {
    if (SFDM !== undefined && SFDM > 0) {
      geometry.DC = SFDM
      provenance.DC = 'derived'
      note('filled', 'geometry.DC', 'the tip is a point, so the body diameter SFDM is read as DC')
    }
  }
  if (form === 'ball end mill' && (RE === undefined || RE === 0)) {
    const diameter = geometry.DC
    if (diameter !== undefined && diameter > 0) {
      geometry.RE = diameter / 2
      provenance.RE = 'derived'
      note('filled', 'geometry.RE', 'a ball end mill’s corner radius is half its diameter')
    }
  }

  const label = catalogNumber ?? description
  const tool: Tool = {
    form,
    geometry,
    ...(label === undefined ? {} : { label }),
    ...(Object.keys(provenance).length === 0 ? {} : { provenance }),
  }

  return {
    tool,
    unit,
    notes,
    ...(guid === undefined ? {} : { guid }),
    ...(description === undefined ? {} : { description }),
    ...(vendor === undefined ? {} : { vendor }),
    ...(catalogNumber === undefined ? {} : { catalogNumber }),
    ...(number === undefined ? {} : { number }),
  }
}

/**
 * A Fusion tool entry as a {@link Tool} in millimetres, or `null` for a holder,
 * anything that is not a tool, and a record with no recognisable `unit`.
 */
export const fromFusionTool = (json: unknown): FusionImport | null => readFusionTool(json, UNNAMED)
