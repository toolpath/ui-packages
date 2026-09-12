/**
 * A holder as Fusion's stepped segment stack.
 *
 * ## Which way the stack runs
 *
 * Autodesk states it on the segment array itself: *"Segments are ordered
 * starting from the cutter end and ending at the machine tool."* So
 * `segments[0]` sits at the nose, `height` accumulates toward the spindle,
 * `lower-diameter` is the face nearer the cutter and `upper-diameter` the face
 * nearer the machine. `gaugeLength` is *"height below gauge line"* — nose to
 * gauge line — so a holder trimmed at its gauge line has segment heights
 * summing to exactly that.
 *
 * A segment carries those three keys and nothing else: it is the one object in
 * the whole format with `additionalProperties: false`, so there is nowhere to
 * annotate one.
 *
 * ## Why the measured arm is the easy one
 *
 * A CAT40 model is measured whole, and half of what comes back is the 7:24 cone
 * and the retention knob — inside the spindle, and not what the operator
 * mounts. Fusion wants the part below the gauge line, so the cut has to be made
 * somewhere.
 *
 * The reference implementation finds it by *inference*: match a segment whose
 * taper ratio is 7:24 within ±0.5 %, check its diameter range contains one of
 * three spec gauge diameters, and solve linearly for the crossing. That fails
 * silently on a Capto, an HSK or a straight shank, and it can only report a
 * *size class* — geometry cannot tell a BT40 from a CAT40.
 *
 * **Nothing here has to infer it, because {@link ProfileDatum} is carried.** A
 * `gage-line` profile already knows where its own gauge plane is, and
 * {@link belowGageLine} already makes that cut and interpolates the crossing —
 * the same function a renderer splits the silhouette with, so the export and
 * the drawing meet the gage line in the same place. Carrying the datum per
 * profile rather than per document is what makes this possible, and
 * `profile.ts` says why.
 *
 * A `nose`-datumed profile has no gauge plane solved. Its segments are written
 * and **`gaugeLength` is omitted**, which is the reference's own documented
 * behaviour and the right one: leaving the key off puts Fusion into manual
 * mode, and writing a zero would look like a measurement.
 */

import { convertLength, type UnitSystem } from '../../units.js'
import { isHolderProfile, type Holder } from '../../holding.js'
import { belowGageLine, type HolderProfile } from '../../profile.js'
import type { ExportNote } from '../report.js'
import { exported } from './geometry.js'

/** One step of the stack. Three keys, and the format permits no fourth. */
export interface FusionSegment {
  readonly height: number
  readonly 'lower-diameter': number
  readonly 'upper-diameter': number
}

export interface FusionHolder {
  readonly type: 'holder'
  readonly unit: UnitSystem
  readonly guid: string
  readonly gaugeLength?: number
  readonly segments: readonly FusionSegment[]
  readonly description?: string
  readonly vendor?: string
  readonly 'product-id'?: string
  readonly 'product-link'?: string
}

/**
 * A holder as a catalog holds it: the geometry, plus who made it.
 *
 * `guid` is required for the reason it is on {@link CatalogTool} — Autodesk
 * requires one on an embedded holder as much as on a standalone entry.
 */
export interface CatalogHolder {
  readonly guid: string
  readonly holder: Holder | HolderProfile
  readonly unit: UnitSystem
  readonly description?: string
  readonly vendor?: string
  readonly catalogNumber?: string
  readonly productLink?: string
}

export interface HolderResult {
  /** `null` where the holder states no shape this format can draw. */
  readonly holder: FusionHolder | null
  /** Nose to gauge line in millimetres, where it is known. */
  readonly gaugeLength: number | null
  readonly notes: readonly ExportNote[]
}

/** A step from `[z, r]` pairs, both millimetres, `z` ascending toward the spindle. */
const segmentOf = (
  low: readonly [number, number],
  high: readonly [number, number],
  unit: UnitSystem,
): FusionSegment | null => {
  const height = high[0] - low[0]
  // A zero-height step is where the solid steps sideways: two vertices share a
  // z. It is a real feature of the silhouette and not a segment — Fusion draws
  // the jump between two adjacent segments' diameters on its own.
  if (!(height > 0)) return null
  const mm = (value: number) => exported(convertLength(value, 'millimeters', unit))
  return {
    height: mm(height),
    'lower-diameter': mm(2 * low[1]),
    'upper-diameter': mm(2 * high[1]),
  }
}

/**
 * A measured silhouette as segments, nose first.
 *
 * The profile runs `z` ascending *toward the cutting end* from a gage line at
 * `z = 0`; Fusion runs its stack the other way, from the nose toward the
 * machine. So the list is walked backwards and every `z` is measured back from
 * the far end — which is the holder's gauge length when the datum solved one.
 */
const fromProfile = (profile: HolderProfile, unit: UnitSystem): FusionSegment[] => {
  const points = belowGageLine(profile)
  const last = points[points.length - 1]
  if (last === undefined) return []
  const far = last[0]

  const segments: FusionSegment[] = []
  for (let index = points.length - 1; index > 0; index -= 1) {
    const nearer = points[index]
    const further = points[index - 1]
    if (nearer === undefined || further === undefined) continue
    // Nearer the cutter is further from the gage line, so its distance from the
    // nose is the smaller of the two.
    const segment = segmentOf([far - nearer[0], nearer[1]], [far - further[0], further[1]], unit)
    if (segment !== null) segments.push(segment)
  }
  return segments
}

/**
 * A published holder as segments, nose first.
 *
 * The layer model `holderSilhouette` already states — the nose, the body behind
 * it where the vendor states one, the flange at its projection — read from the
 * nose rather than from the tool tip. A vendor that publishes no nose diameter
 * has published no shape, and nothing is drawn for it.
 */
const fromPublished = (holder: Holder, unit: UnitSystem): FusionSegment[] => {
  const { noseDiameter, noseLength, bodyDiameter, bodyLength, flangeDiameter, projection } = holder
  if (noseDiameter === null) return []

  const mm = (value: number) => exported(convertLength(value, 'millimeters', unit))
  const step = (height: number, diameter: number): FusionSegment | null =>
    height > 0
      ? { height: mm(height), 'lower-diameter': mm(diameter), 'upper-diameter': mm(diameter) }
      : null

  const segments: FusionSegment[] = []
  const nose = step(noseLength ?? 0, noseDiameter)
  if (nose !== null) segments.push(nose)

  if (bodyDiameter !== null) {
    const body = step(bodyLength ?? 0, bodyDiameter)
    if (body !== null) segments.push(body)
  }

  // The flange stands at the holder's projection, so what is left between the
  // steps already placed and that plane is where it starts.
  if (flangeDiameter !== null && projection !== null) {
    const placed = (noseLength ?? 0) + (bodyDiameter !== null ? (bodyLength ?? 0) : 0)
    const flange = step(projection - placed, flangeDiameter)
    if (flange !== null) segments.push(flange)
  }
  return segments
}

/**
 * A holder as Fusion holds one, and an account of what did not travel.
 *
 * `gaugeLength` is written only where it is known: the last vertex's `z` on a
 * `gage-line` profile, the vendor's own figure on a published holder, and
 * nothing at all on a `nose`-datumed profile.
 */
export const fusionHolder = (entry: CatalogHolder): HolderResult => {
  const { holder, unit, guid } = entry
  const notes: ExportNote[] = []
  const note = (kind: ExportNote['kind'], field: string, message: string): void => {
    notes.push({ subject: guid, kind, field, message })
  }

  const measured = isHolderProfile(holder)
  const segments = measured ? fromProfile(holder, unit) : fromPublished(holder, unit)

  if (segments.length === 0) {
    note(
      'dropped',
      'holder',
      measured
        ? 'the measured profile has no segment above its gage line'
        : 'the vendor states no nose diameter, so the holder has no shape to draw',
    )
    return { holder: null, gaugeLength: null, notes }
  }

  let gaugeLength: number | null = null
  if (measured) {
    if (holder.datum === 'gage-line') {
      const points = belowGageLine(holder)
      gaugeLength = points[points.length - 1]?.[0] ?? null
    } else {
      note(
        'dropped',
        'holder.gaugeLength',
        'the profile is measured from the nose, so no gauge plane is solved — ' +
          'Fusion is left to ask for the gauge length rather than shown a guess',
      )
    }
  } else {
    gaugeLength = holder.gaugeLength
    if (gaugeLength === null) {
      note('dropped', 'holder.gaugeLength', 'the vendor publishes no gauge length')
    }
  }

  if (holder.colletProtrusion !== null && holder.colletProtrusion > 0) {
    note(
      'dropped',
      'holder.segments',
      'a seated collet stands proud of the nose, and a Fusion holder has no collet to draw',
    )
  }

  return {
    holder: {
      type: 'holder',
      unit,
      guid,
      ...(gaugeLength === null
        ? {}
        : { gaugeLength: exported(convertLength(gaugeLength, 'millimeters', unit)) }),
      segments,
      ...(entry.description === undefined ? {} : { description: entry.description }),
      ...(entry.vendor === undefined ? {} : { vendor: entry.vendor }),
      ...(entry.catalogNumber === undefined ? {} : { 'product-id': entry.catalogNumber }),
      ...(entry.productLink === undefined ? {} : { 'product-link': entry.productLink }),
    },
    gaugeLength,
    notes,
  }
}
