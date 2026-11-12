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
 * ## The stack is the holder's cone stack
 *
 * A {@link Holder} already runs nose first, as Fusion's does, so each layer is
 * one segment, of the stack below the gauge line ({@link trimToGauge}): a
 * measured taper above it is inside the spindle. `gaugeLength` is the one the
 * holder states, else the height of the stack written ({@link camGaugeLength}),
 * so it is always written and the assembly's gauge length is measured from the
 * same place the Mastercam exporter measures it.
 */

import { trimToGauge } from '../../holder.js'
import type { Holder } from '../../model.js'
import { convertLength, type UnitSystem } from '../../units.js'
import { camGaugeLength, camIdentity } from '../catalog.js'
import type { ExportNote } from '../report.js'
import { exported, fusionSegments } from './geometry.js'

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

export interface HolderResult {
  /** `null` where the holder states no shape this format can draw, or no guid. */
  readonly holder: FusionHolder | null
  /** Nose to gauge line in millimetres, as written; null where nothing is. */
  readonly gaugeLength: number | null
  readonly notes: readonly ExportNote[]
}

/** A holder as Fusion holds one, and an account of what did not travel. */
export const fusionHolder = (holder: Holder): HolderResult => {
  const identity = camIdentity(holder)
  const subject = identity?.guid ?? holder.name ?? ''
  const notes: ExportNote[] = []
  const note = (kind: ExportNote['kind'], field: string, message: string): void => {
    notes.push({ subject, kind, field, message })
  }
  if (identity === null) {
    note('skipped', 'guid', 'the holder states no valid guid, and Fusion requires one')
    return { holder: null, gaugeLength: null, notes }
  }
  const { guid, unit } = identity
  const mm = (value: number) => exported(convertLength(value, 'millimeters', unit))

  // Fusion's stack is the holder below its gauge line, so a measured taper above it is cut.
  const segments = fusionSegments(trimToGauge(holder).layers, unit)
  if (segments.length === 0) {
    note('dropped', 'holder', 'the holder states no shape, so it has nothing to draw')
    return { holder: null, gaugeLength: null, notes }
  }

  if (holder.colletProtrusion !== undefined && holder.colletProtrusion > 0) {
    note(
      'dropped',
      'holder.segments',
      'a seated collet stands proud of the nose, and a Fusion holder has no collet to draw',
    )
  }

  const gaugeLength = camGaugeLength(holder)
  return {
    holder: {
      type: 'holder',
      unit,
      guid,
      gaugeLength: mm(gaugeLength),
      segments,
      ...(holder.description === undefined ? {} : { description: holder.description }),
      ...(holder.vendor === undefined ? {} : { vendor: holder.vendor }),
      ...(holder.productId === undefined ? {} : { 'product-id': holder.productId }),
      ...(holder.productLink === undefined ? {} : { 'product-link': holder.productLink }),
    },
    gaugeLength,
    notes,
  }
}
