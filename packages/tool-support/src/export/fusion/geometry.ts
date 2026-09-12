/**
 * A tool's stated geometry, as Fusion's `geometry` block.
 *
 * Two conversions happen here and they are easy to get the wrong way round.
 * Every length in this domain is millimetres whatever the vendor published, and
 * a Fusion record states its numbers in **its own `unit`** — so an inch tool's
 * `DC` is written in inches. An angle and a count are the same number in both
 * systems, and converting one gives a 60-degree drill point of 2.36.
 * {@link FUSION_GEOMETRY_KINDS} is what decides which is which, and
 * `export-fusion-schema.test.ts` holds it against the geometry dictionary
 * wherever the two vocabularies overlap, so they cannot drift apart.
 *
 * ## What may be supplied, and what may not
 *
 * Fusion requires geometry a vendor does not always publish, so something has
 * to decide what to do about the gap. The line is **between a convention and a
 * measurement of this tool**:
 *
 *   * A convention is true of tools in general and says nothing about this one.
 *     A tool is right-handed, a thread has one start, a thread form is 60°, a
 *     drill tip is not offset. Filling those states what everyone already
 *     assumes, and {@link FILL_CONSTANTS} is the whole list.
 *   * A reading is this tool's own dimensions, read a second way. A plain
 *     shank's shoulder diameter *is* its shank diameter; a plain tool's usable
 *     length below the shank *is* its flute length; and how far a tool stands
 *     out of a holder is {@link setupStickout}, which is the package's one
 *     answer to that question.
 *   * A measurement is everything else, and it is never invented. `DC`, `OAL`,
 *     `LCF`, `SFDM`, `NOF`, `RE`, `SIG`, `TA`, `TP`, a tip diameter, a radius —
 *     absent means the vendor did not publish it, and a plausible number in its
 *     place is wrong in the way nobody checks. A bull nose end mill with no
 *     stated corner radius is not a flat end mill, and a tapered mill with no
 *     stated angle is not a straight one.
 *
 * So a tool missing a measurement Fusion requires is reported missing and, by
 * the caller's choice, skipped — not quietly turned into a different tool.
 */

import { convertLength } from '../../units.js'
import { DEFAULT_CLAMPING, type ClampingRule } from '../../clamping.js'
import { DEFAULT_STICKOUT_POLICY, setupStickout, type StickoutPolicy } from '../../stickout.js'
import type { CatalogTool } from '../catalog.js'
import type { ExportNote } from '../report.js'
import { FUSION_GEOMETRY_KINDS, type FusionTypeRules } from './schema.js'

/** A value as it appears in a Fusion geometry block. */
export type FusionValue = number | boolean | string

/**
 * How far the exporter goes to satisfy what Fusion requires and the vendor did
 * not publish.
 *
 * `derived` is the default because a document Fusion refuses to load is not an
 * export. A bare scraped tool has no holder, so it states neither how far it
 * stands out nor its assembly gauge length, and Fusion requires both — under
 * `none` every such tool is short two required keys.
 */
export type FillMode = 'none' | 'constants' | 'derived'

/**
 * The conventions, entire.
 *
 * Every one is a fact about tools in general rather than a measurement of the
 * tool in hand, which is the test for belonging here. `NT: 1` is a
 * single-start thread, `thread-profile-angle: 60` is the ISO metric and unified
 * form, `HAND: true` is right-handed, `CSP: false` is no through-coolant.
 */
export const FILL_CONSTANTS: Readonly<Record<string, FusionValue>> = {
  CSP: false,
  HAND: true,
  NT: 1,
  'thread-profile-angle': 60,
  'thread-tip-type': 'point',
  'tip-offset': 0,
}

/**
 * A converted length, with the binary noise taken back off.
 *
 * **This removes error rather than adding precision** — the rule
 * `@toolpath/tool-scraper`'s `round6` already states for the same conversion on
 * the way in. 38.1 mm is exactly 1.5 in, but `38.1 / 25.4` is
 * `1.5000000000000002`, and that is the number that would land in a tool
 * library a machinist reads. Six places is far coarser than the ~1e-14 the
 * error reaches at these magnitudes and far finer than the four decimals a
 * vendor prints, so nothing anybody stated is lost.
 */
export const exported = (value: number): number => Math.round(value * 1e6) / 1e6

export interface GeometryRequest {
  readonly tool: CatalogTool
  readonly rules: FusionTypeRules
  /**
   * How far the tool stands out of its holder, in millimetres, where something
   * has decided — an `Assembly.stickout`, or a catalog's own `LBH`.
   */
  readonly stickout: number | null
  /** The holder's gauge length in millimetres, where a holder is attached. */
  readonly holderGauge: number | null
  readonly fill: FillMode
  readonly clamping?: ClampingRule
  readonly policy?: StickoutPolicy
}

export interface GeometryResult {
  readonly geometry: Readonly<Record<string, FusionValue>>
  /** Required keys still absent. Non-empty means Fusion will refuse the record. */
  readonly missing: readonly string[]
  readonly notes: readonly ExportNote[]
}

/** `value`, stated in millimetres, as `unit` states it. */
const inUnit = (key: string, value: number, tool: CatalogTool): number =>
  FUSION_GEOMETRY_KINDS[key] === 'length'
    ? exported(convertLength(value, 'millimeters', tool.unit))
    : value

/**
 * The geometry block, and an account of everything that had to be supplied or
 * could not be.
 */
export const fusionGeometry = (request: GeometryRequest): GeometryResult => {
  const { tool, rules, holderGauge, fill } = request
  const subject = tool.guid
  const notes: ExportNote[] = []
  const geometry: Record<string, FusionValue> = {}

  const note = (kind: ExportNote['kind'], field: string, message: string): void => {
    notes.push({ subject, kind, field: `geometry.${field}`, message })
  }

  // What the vendor stated, restricted to what this type models. A scraped
  // corner radius on a drill is dropped rather than written into a field
  // Fusion's drill does not have — it would not be shown to anyone.
  const allowed = new Set(rules.geometryAllowed)
  for (const [key, value] of Object.entries(tool.geometry)) {
    if (value === undefined || !Number.isFinite(value)) continue
    if (allowed.has(key)) {
      geometry[key] = inUnit(key, value, tool)
    } else if (rules.geometryRequired.length > 0) {
      note('dropped', key, `a ${key} is stated, and this tool type does not model one`)
    }
  }

  if (tool.coolantThrough !== undefined && allowed.has('CSP')) {
    geometry.CSP = tool.coolantThrough
  }
  if (tool.hand !== undefined && allowed.has('HAND')) {
    geometry.HAND = tool.hand === 'right'
  }

  // How far the tool stands out of the holder: Autodesk's `LB`, this domain's
  // `LBH`, and `Assembly.stickout` — one quantity under three names, and the
  // one this package exists because four places disagreed about.
  const stated = request.stickout ?? tool.geometry.LBH ?? null
  let below = stated
  if (below === null && fill === 'derived') {
    below = setupStickout(
      { geometry: tool.geometry, unitSystem: tool.unit },
      request.clamping ?? DEFAULT_CLAMPING,
      request.policy ?? DEFAULT_STICKOUT_POLICY,
    )
    if (below !== null) {
      note(
        'filled',
        'LB',
        'nobody set a stickout, so this is the length the default policy would set the tool up at',
      )
    }
  }
  if (below !== null && allowed.has('LB')) {
    geometry.LB = inUnit('LB', below, tool)
  }

  if (allowed.has('assemblyGaugeLength') && below !== null) {
    if (holderGauge !== null) {
      geometry.assemblyGaugeLength = inUnit('assemblyGaugeLength', holderGauge + below, tool)
    } else if (fill !== 'none') {
      // No holder means no gauge plane to measure from, and Fusion requires the
      // number anyway. The stickout alone is the assembly measured as if the
      // holder were nothing, which is what a bare tool is.
      geometry.assemblyGaugeLength = inUnit('assemblyGaugeLength', below, tool)
      note(
        'filled',
        'assemblyGaugeLength',
        'the tool has no holder, so its assembly gauge length is its stickout alone',
      )
    }
  }

  if (fill === 'derived') {
    // A plain shank read a second way. Neither invents a dimension: a tool
    // whose shoulder is its shank has a shoulder diameter equal to its shank,
    // and one whose usable length ends with its flutes has a shoulder length
    // equal to its flute length. Both are how a tool with no stated relief is
    // actually shaped.
    const { SFDM, LCF } = tool.geometry
    if (geometry['shoulder-diameter'] === undefined && allowed.has('shoulder-diameter')) {
      if (SFDM !== undefined) {
        geometry['shoulder-diameter'] = inUnit('shoulder-diameter', SFDM, tool)
        note('filled', 'shoulder-diameter', 'no relief is stated, so the shoulder is the shank')
      }
    }
    if (geometry['shoulder-length'] === undefined && allowed.has('shoulder-length')) {
      if (LCF !== undefined) {
        geometry['shoulder-length'] = inUnit('shoulder-length', LCF, tool)
        note('filled', 'shoulder-length', 'no relief is stated, so the usable length is the flutes')
      }
    }
  }

  if (fill !== 'none') {
    for (const key of rules.geometryRequired) {
      if (geometry[key] !== undefined) continue
      const constant = FILL_CONSTANTS[key]
      if (constant === undefined) continue
      geometry[key] = constant
      note('filled', key, `not stated; ${JSON.stringify(constant)} is the ordinary case`)
    }
  }

  const missing = rules.geometryRequired.filter((key) => geometry[key] === undefined)
  for (const key of missing) {
    note(
      'skipped',
      key,
      `Fusion requires it for this tool type and the vendor states none — ` +
        `it is a measurement of this tool, not a convention, so it is not supplied`,
    )
  }

  return { geometry, missing, notes }
}
