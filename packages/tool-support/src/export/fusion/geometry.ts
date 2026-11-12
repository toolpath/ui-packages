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
 *     A tool is right-handed, a thread mill has one tooth, a thread form is 60°, a
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

import { DEFAULT_CLAMPING, type ClampingRule } from '../../clamping.js'
import { coneRemainder } from '../../cones.js'
import { isTapKind, type ToolKind } from '../../kinds.js'
import type { Cone, CuttingTool } from '../../model.js'
import { EPSILON, sameDiameter, sliceAt, stackHeight } from '../../stack.js'
import { DEFAULT_STICKOUT_POLICY, setupStickout, type StickoutPolicy } from '../../stickout.js'
import { dimensionsOf } from '../../tool.js'
import { convertLength, MM_PER_INCH, type UnitSystem } from '../../units.js'
import { isoGeometry, type CamIdentity } from '../catalog.js'
import type { ExportNote } from '../report.js'
import type { FusionSegment } from './holder.js'
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
 * single-point thread mill, `thread-tip-type: point` its sharp tooth,
 * `thread-profile-angle: 60` is the ISO metric and unified form, `HAND: true`
 * is right-handed, `CSP: false` is no through-coolant. Each fills only where
 * the record states none.
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
  readonly tool: CuttingTool
  /** The guid the notes name it by, and the unit its record is written in. */
  readonly identity: CamIdentity
  readonly rules: FusionTypeRules
  /** How far the tool stands out of its holder, in millimetres, where an assembly has decided. */
  readonly stickout: number | null
  /** The holder's gauge length in millimetres, where a holder is attached. */
  readonly holderGauge: number | null
  readonly fill: FillMode
  readonly clamping?: ClampingRule
  readonly policy?: StickoutPolicy
}

export interface GeometryResult {
  readonly geometry: Readonly<Record<string, FusionValue>>
  /** The tool's `shaft.segments`, nose first, in the record's unit. */
  readonly segments: readonly FusionSegment[]
  /** Required keys still absent. Non-empty means Fusion will refuse the record. */
  readonly missing: readonly string[]
  readonly notes: readonly ExportNote[]
}

/** `value`, stated in millimetres, as `unit` states it. */
const inUnit = (key: string, value: number, unit: UnitSystem): number =>
  FUSION_GEOMETRY_KINDS[key] === 'length'
    ? exported(convertLength(value, 'millimeters', unit))
    : value

/** A stack, stated in millimetres, as Fusion's segments in `unit`, nose first. */
export const fusionSegments = (
  layers: ReadonlyArray<Cone>,
  unit: UnitSystem,
): Array<FusionSegment> => {
  const length = (value: number) => exported(convertLength(value, 'millimeters', unit))
  return layers.map((layer) => ({
    height: length(layer.thickness),
    'lower-diameter': length(layer.bottomDiameter),
    'upper-diameter': length(layer.topDiameter),
  }))
}

/** The shoulder's keys, which the shaft writer sets. */
const SHOULDER: ReadonlySet<string> = new Set(['shoulder-length', 'shoulder-diameter'])

/** The included angle Fusion's reader cones a type at, read off what is written. */
const CONE_ANGLE: Partial<Record<ToolKind, (geometry: Record<string, FusionValue>) => unknown>> = {
  ChamferEndmill: (geometry) => (typeof geometry.TA === 'number' ? 2 * geometry.TA : undefined),
  Countersink: (geometry) => geometry.SIG,
}

/** How fast a layer widens, diameter per height. */
const slope = (layer: Cone): number => (layer.topDiameter - layer.bottomDiameter) / layer.thickness

/** Whether `layer` starts as the cone `remainder` does: from its bottom diameter, at its slope. */
const onCone = (layer: Cone, remainder: Cone): boolean =>
  layer.thickness > 0 &&
  sameDiameter(layer.bottomDiameter, remainder.bottomDiameter) &&
  Math.abs(slope(layer) - slope(remainder)) <= EPSILON

/**
 * The stack less the height the reader stacks back as the cone's rest, off the
 * bottom of its first layer where that layer is the cone: the layer is cut in
 * proportion, as {@link sliceAt} cuts. `exact` is false where the rest stands
 * taller than that layer, which is then dropped whole, and the shaft cannot
 * come back as it went. Undefined where the stack does not start with the cone.
 */
const stripCone = (
  shaft: ReadonlyArray<Cone>,
  remainder: Cone,
): { readonly rest: Array<Cone>; readonly exact: boolean } | undefined => {
  const first = shaft[0]
  if (first === undefined || !onCone(first, remainder)) {
    return undefined
  }
  const left = first.thickness - remainder.thickness
  if (left < -EPSILON) {
    return { rest: shaft.slice(1), exact: false }
  }
  const top =
    left <= EPSILON
      ? []
      : [
          {
            thickness: left,
            bottomDiameter: first.bottomDiameter + slope(first) * remainder.thickness,
            topDiameter: first.topDiameter,
          },
        ]
  return { rest: [...top, ...shaft.slice(1)], exact: true }
}

/** What the shaft writes: its segments, and the shoulder that adds nothing to them. */
interface ShaftWrite {
  readonly segments: Array<FusionSegment>
  /** In the record's unit. */
  readonly shoulderLength: number | undefined
  readonly shoulderDiameter: number | undefined
  readonly notes: Array<Pick<ExportNote, 'kind' | 'message'>>
}

/**
 * The tool's `shaft` as Fusion's `shaft.segments`, so that reading the record
 * back (`readFusionEntry`) gives the same stack and stickout.
 *
 * **The exporter writes the shaft as segments; the shoulder and shank scalars
 * are set so they add nothing on re-read.** Fusion's reader adds its scalars
 * to its segments: the rest of a chamfer mill's or countersink's cutting cone
 * above the flutes, a shoulder up to `shoulder-length`, the segments, then
 * shank at `SFDM` (else `DC`) on to `LB` and `OAL`. So, read off `geometry` as
 * written:
 *
 * - the cone's rest is the reader's, at the `LB` written, and that height is
 *   stripped from the bottom of the stack (written whole, with a note, where
 *   the stack does not start with the cone; dropped whole, with a note, where
 *   the rest stands taller than the stack's first layer);
 * - `shoulder-length` is the flutes and that rest, never more once rounded, so
 *   the shoulder adds no height; `shoulder-diameter` is the first segment's
 *   lower diameter, which a shoulder of no height does not draw;
 * - the segments are the rest of the stack up to `LB`, the body below the
 *   holder, less a top layer of shank the reader refills from `SFDM` to `OAL`.
 *
 * Above `LB` Fusion carries only that shank: a shaft whose part above the
 * stickout is anything else is cut there, with a note.
 */
const fusionShaft = (
  tool: CuttingTool,
  geometry: Record<string, FusionValue>,
  stickout: number | null,
  unit: UnitSystem,
): ShaftWrite => {
  const notes: Array<Pick<ExportNote, 'kind' | 'message'>> = []
  // Lengths as the reader takes them back: the written number, scaled to millimetres.
  const scale = unit === 'inches' ? MM_PER_INCH : 1
  const read = (key: string): number | undefined => {
    const value = geometry[key]
    return typeof value === 'number' ? value * scale : undefined
  }
  const lb = read('LB') ?? 0
  const flutes = read('LCF') ?? 0
  const diameter = read('DC')
  const angle = CONE_ANGLE[tool.kind]?.(geometry)
  const remainder =
    typeof angle !== 'number' || diameter === undefined
      ? undefined
      : coneRemainder(
          {
            diameter,
            fluteLength: flutes,
            tipDiameter: read('tip-diameter') ?? 0,
            tipAngleDeg: angle,
          },
          lb,
        )

  const shaft = tool.shaft ?? []
  const stripped = remainder === undefined ? undefined : stripCone(shaft, remainder)
  if (remainder !== undefined && stripped === undefined) {
    notes.push({
      kind: 'filled',
      message:
        'Fusion stacks the rest of the cutting cone above the flutes and this shaft does not ' +
        'start with it, so the shaft is written whole above that cone',
    })
  }
  if (stripped?.exact === false) {
    notes.push({
      kind: 'filled',
      message:
        'Fusion stacks the rest of the cutting cone above the flutes to LB, taller than this ' +
        'shaft states it, so the cone is written to LB',
    })
  }
  const rest = stripped?.rest ?? shaft
  const base =
    dimensionsOf(tool).fluteLength + (stripped === undefined ? 0 : (remainder?.thickness ?? 0))
  const end = base + stackHeight(rest)

  // The reader refills from the segments' top to `max(LB, OAL)` at `SFDM`, else `DC`.
  const top = rest.at(-1)
  const fill = read('SFDM') ?? diameter
  const refilled =
    top !== undefined &&
    fill !== undefined &&
    sameDiameter(top.bottomDiameter, fill) &&
    sameDiameter(top.topDiameter, fill) &&
    end - top.thickness <= lb + EPSILON &&
    Math.abs(end - Math.max(lb, read('OAL') ?? 0)) <= EPSILON
  const layers = refilled
    ? rest.slice(0, -1)
    : sliceAt(rest, stickout === null ? Infinity : stickout - base)
  if (!refilled && stickout !== null && end > lb + EPSILON) {
    notes.push({
      kind: 'dropped',
      message:
        'above the stickout the shaft is not one plain shank, and Fusion carries only its ' +
        'shank (SFDM) on to OAL there',
    })
  }

  // The flutes and the cone's rest, as the reader adds them, never rounded past it.
  const covered = remainder === undefined ? flutes : flutes + remainder.thickness
  let shoulderLength = exported(convertLength(covered, 'millimeters', unit))
  if (shoulderLength * scale > covered) {
    shoulderLength = exported(shoulderLength - 1e-6)
  }
  const segments = fusionSegments(layers, unit)
  return {
    segments,
    shoulderLength: read('LCF') === undefined ? undefined : shoulderLength,
    shoulderDiameter: segments[0]?.['lower-diameter'],
    notes,
  }
}

/**
 * The geometry block, and an account of everything that had to be supplied or
 * could not be.
 */
export const fusionGeometry = (request: GeometryRequest): GeometryResult => {
  const { tool, rules, holderGauge, fill } = request
  const { guid: subject, unit } = request.identity
  const stated = isoGeometry(tool)
  const notes: ExportNote[] = []
  const geometry: Record<string, FusionValue> = {}

  const note = (kind: ExportNote['kind'], field: string, message: string): void => {
    notes.push({ subject, kind, field: `geometry.${field}`, message })
  }

  // What the vendor stated, restricted to what this type models. A scraped
  // corner radius on a drill is dropped rather than written into a field
  // Fusion's drill does not have — it would not be shown to anyone.
  // The shoulder is the shaft writer's, below, not the record's first relief.
  const allowed = new Set(rules.geometryAllowed)
  for (const [key, value] of Object.entries(stated)) {
    if (value === undefined || !Number.isFinite(value) || SHOULDER.has(key)) continue
    if (allowed.has(key)) {
      geometry[key] = inUnit(key, value, unit)
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
  const thread = tool.type === 'solid' ? tool.thread : undefined
  if (thread?.tip !== undefined && allowed.has('thread-tip-type')) {
    geometry['thread-tip-type'] = thread.tip.form
  }
  // Toolpath's own key for a tap's lead, which Fusion's tap leaves open and the
  // kernel reads.
  if (thread?.partialThreads !== undefined && isTapKind(tool.kind)) {
    geometry.partialThreadCount = thread.partialThreads
  }

  // How far the tool stands out of the holder: Autodesk's `LB`, a catalog's
  // `LBH`, and an assembly's `stickout` — one quantity under three names, and
  // the one this package exists because four places disagreed about.
  let below = request.stickout
  if (below === null && fill === 'derived') {
    below = setupStickout(
      tool,
      request.clamping ?? DEFAULT_CLAMPING,
      request.policy ?? DEFAULT_STICKOUT_POLICY,
    )
    note(
      'filled',
      'LB',
      'nobody set a stickout, so this is the length the default policy would set the tool up at',
    )
  }
  if (below !== null && allowed.has('LB')) {
    geometry.LB = inUnit('LB', below, unit)
  }

  if (allowed.has('assemblyGaugeLength') && below !== null) {
    if (holderGauge !== null) {
      geometry.assemblyGaugeLength = inUnit('assemblyGaugeLength', holderGauge + below, unit)
    } else if (fill !== 'none') {
      // No holder means no gauge plane to measure from, and Fusion requires the
      // number anyway. The stickout alone is the assembly measured as if the
      // holder were nothing, which is what a bare tool is.
      geometry.assemblyGaugeLength = inUnit('assemblyGaugeLength', below, unit)
      note(
        'filled',
        'assemblyGaugeLength',
        'the tool has no holder, so its assembly gauge length is its stickout alone',
      )
    }
  }

  const shaft = fusionShaft(tool, geometry, below, unit)
  if (shaft.shoulderLength !== undefined && allowed.has('shoulder-length')) {
    geometry['shoulder-length'] = shaft.shoulderLength
  }
  if (shaft.shoulderDiameter !== undefined && allowed.has('shoulder-diameter')) {
    geometry['shoulder-diameter'] = shaft.shoulderDiameter
  }
  for (const { kind, message } of shaft.notes) {
    notes.push({ subject, kind, field: 'shaft.segments', message })
  }

  if (fill === 'derived') {
    // A plain shank read a second way, which invents no dimension: a tool
    // whose shaft writes no segment below its shank has a shoulder diameter
    // equal to its shank.
    const { SFDM } = stated
    if (geometry['shoulder-diameter'] === undefined && allowed.has('shoulder-diameter')) {
      if (SFDM !== undefined) {
        geometry['shoulder-diameter'] = inUnit('shoulder-diameter', SFDM, unit)
        note('filled', 'shoulder-diameter', 'no relief is stated, so the shoulder is the shank')
      }
    }
    // Fusion's spot drill requires a tip diameter, and one that states none
    // comes to a point.
    if (
      geometry['tip-diameter'] === undefined &&
      tool.kind === 'SpotDrill' &&
      allowed.has('tip-diameter')
    ) {
      geometry['tip-diameter'] = 0
      note(
        'filled',
        'tip-diameter',
        'no tip diameter is stated, so the spot drill comes to a point',
      )
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

  return { geometry, segments: shaft.segments, missing, notes }
}
