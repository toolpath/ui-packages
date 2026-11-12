/**
 * A tool as a CAM format sees it: its type in the format's words, and its
 * geometry as ISO 13399 codes.
 *
 * The record (`model.ts`) names its fields and its kinds; the formats this
 * package writes speak Autodesk's type names and ISO codes, and Mastercam's
 * table is keyed by the same type names. So this is the one table between the
 * two vocabularies, at the edge where they meet, and nothing past it in the
 * exporters reads a kind or a named field for geometry.
 *
 * A record with no `guid` cannot be exported: Fusion rejects an entry without
 * one, and one minted at export time would make every re-export look like a
 * new tool. A record with no `unitSystem` is written in millimetres, the unit
 * it is stored in.
 */

import type { Geometry } from '../geometry.js'
import type { ToolKind } from '../kinds.js'
import { trimToGauge } from '../holder.js'
import type { Catalog, Cone, CuttingTool, Holder } from '../model.js'
import { cuttingDiameter } from '../diameter.js'
import { optional } from '../optional.js'
import {
  EPSILON,
  sameDiameter,
  shankOf,
  stackHeight,
  statedOverallLength,
  statedShank,
} from '../stack.js'
import { dimensionsOf } from '../tool.js'
import type { UnitSystem } from '../units.js'
import type { FusionType } from './fusion/schema.js'
import { isGuid } from './mastercam/guid.js'

/** A tool type a format can write: Autodesk's own names, which Mastercam's table is keyed by. */
export type CamType = Exclude<FusionType, 'holder'>

/** Each kind's type; a tap's hand is its thread's, below. */
export const CAM_TYPES: Readonly<Record<ToolKind, CamType>> = {
  FlatEndmill: 'flat end mill',
  RadiusEndmill: 'bull nose end mill',
  BallEndmill: 'ball end mill',
  FaceEndmill: 'face mill',
  ChamferEndmill: 'chamfer mill',
  Countersink: 'counter sink',
  CornerRoundingMill: 'radius mill',
  DrillBit: 'drill',
  ThreadMill: 'thread mill',
  CuttingTap: 'tap right hand',
  FormingTap: 'tap right hand',
  KeyseatCutter: 'slot mill',
  DovetailCutter: 'dovetail mill',
  TaperedEndmill: 'tapered mill',
  LollipopMill: 'lollipop mill',
  CircleSegmentBarrel: 'circle segment barrel',
  CircleSegmentLens: 'circle segment lens',
  CircleSegmentOval: 'circle segment oval',
  CircleSegmentTaper: 'circle segment taper',
  BoringBar: 'boring bar',
  Counterbore: 'counter bore',
  CenterDrill: 'center drill',
  Reamer: 'reamer',
  SpotDrill: 'spot drill',
}

/** A tool's type in a CAM format's words: a left-hand tap is `tap left hand`. */
export const camType = (tool: CuttingTool): CamType => {
  const type = CAM_TYPES[tool.kind]
  const left = tool.type === 'solid' && tool.thread?.handedness === 'left'
  return type === 'tap right hand' && left ? 'tap left hand' : type
}

/** Kinds whose point is stated as its included angle, `SIG`. */
const POINTED: ReadonlySet<ToolKind> = new Set<ToolKind>([
  'DrillBit',
  'SpotDrill',
  'CenterDrill',
  'Countersink',
  'Reamer',
])

/**
 * A flank's angle to the axis, `TA`: the stated one, else half the included
 * angle for a chamfer mill or a tapered mill, whose cone is the flank; a face
 * mill's is the complement of its lead.
 */
const taperOf = (tool: CuttingTool): number | undefined => {
  if (tool.type === 'insert') {
    const lead = tool.insert.leadAngleDeg
    return lead === undefined ? undefined : 90 - lead
  }
  const halved = tool.kind === 'ChamferEndmill' || tool.kind === 'TaperedEndmill'
  return (
    tool.taperAngleDeg ??
    (halved && tool.tipAngleDeg !== undefined ? tool.tipAngleDeg / 2 : undefined)
  )
}

/**
 * The shoulder a CAM format states, read off the shaft: the first run of
 * straight layers at one diameter other than the shank's, narrower or wider —
 * its top from the tip, and its diameter. Undefined where the shaft has none.
 * A sliver a float's rounding leaves, such as a cone's remainder at the top of
 * flutes that reach it, starts none.
 */
const shoulderOf = (
  tool: CuttingTool,
): { readonly length: number; readonly diameter: number } | undefined => {
  const shank = shankOf(tool)
  const shaft = tool.shaft ?? []
  const straight = (layer: Cone | undefined, diameter: number): boolean =>
    layer !== undefined &&
    sameDiameter(layer.bottomDiameter, diameter) &&
    sameDiameter(layer.topDiameter, diameter)
  const start = shaft.findIndex(
    (layer) =>
      shank !== null &&
      layer.thickness > EPSILON &&
      straight(layer, layer.bottomDiameter) &&
      !sameDiameter(layer.bottomDiameter, shank),
  )
  const first = shaft[start]
  if (first === undefined) {
    return undefined
  }
  let end = start + 1
  while (straight(shaft[end], first.bottomDiameter)) {
    end++
  }
  return {
    length: dimensionsOf(tool).fluteLength + stackHeight(shaft.slice(0, end)),
    diameter: first.bottomDiameter,
  }
}

/**
 * A tool's geometry as ISO 13399 codes, in millimetres: only what the record
 * states or follows from it, under the code a format reads it from.
 *
 * A corner rounding mill's `DC` is the diameter below its round and `RE` the
 * round, as Fusion states one; a face mill's `DCX` is the diameter its inserts
 * cut; `SFDM` is the top of the shaft and `OAL` the flutes and the shaft,
 * each only where it is stated ({@link statedShank}, {@link statedOverallLength}),
 * so a format fills an assumed one as though unstated; a section between the flutes and the shank is `shoulder-length` from the tip
 * and `shoulder-diameter`; a thread mill's teeth are `NT`, a single-point
 * mill's range `TPN` to `TPX`, and its tip's size `thread-tip-width` or
 * `thread-tip-radius`. Nothing the record does not state is supplied.
 */
export const isoGeometry = (tool: CuttingTool): Geometry => {
  const { diameter, fluteLength, cornerRadius } = dimensionsOf(tool)
  const shoulder = shoulderOf(tool)
  const solid = tool.type === 'solid' ? tool : undefined
  const rounding = solid?.roundingRadius
  const thread = solid?.thread
  const tip = thread?.tip
  // A mill of several teeth is ground to its one pitch, `TP`; only a single
  // point states a range.
  const range = thread?.pitchMin !== undefined && !((thread.teeth ?? 1) > 1)
  return {
    DC: rounding === undefined ? diameter : diameter - 2 * rounding,
    LCF: fluteLength,
    ...optional('DCX', tool.type === 'insert' ? cuttingDiameter(tool) : undefined),
    ...optional('OAL', statedOverallLength(tool) ?? undefined),
    ...optional('SFDM', statedShank(tool) ?? undefined),
    ...optional('RE', rounding ?? cornerRadius),
    ...optional('NOF', tool.type === 'solid' ? tool.fluteCount : tool.body.pockets),
    ...optional('SIG', POINTED.has(tool.kind) ? solid?.tipAngleDeg : undefined),
    ...optional('TA', taperOf(tool)),
    ...optional('tip-diameter', solid?.tipDiameter),
    ...optional('tip-length', solid?.tipLength),
    ...optional('upper-radius', tool.type === 'insert' ? tool.insert.upperRadius : undefined),
    ...optional('TP', thread?.pitch),
    ...optional('NT', thread?.teeth),
    ...optional('TPN', range ? thread.pitchMin : undefined),
    ...optional('TPX', range ? thread.pitch : undefined),
    ...optional('thread-tip-width', tip?.form === 'flat' ? tip.width : undefined),
    ...optional('thread-tip-radius', tip?.form === 'round' ? tip.radius : undefined),
    ...optional(
      'thread-profile-angle',
      tool.kind === 'ThreadMill' ? thread?.profileDeg : undefined,
    ),
    ...optional('shoulder-length', shoulder?.length),
    ...optional('shoulder-diameter', shoulder?.diameter),
  }
}

/**
 * The gauge length a format is told a holder has, mm: the one it states, else
 * the height of the stack written below its gauge line. Every exporter writes
 * it this way, so two formats never disagree about one holder.
 */
export const camGaugeLength = (holder: Holder): number =>
  holder.gaugeLength ?? stackHeight(trimToGauge(holder).layers)

/** What an exporter needs of a record before it can write one: its guid, and the unit to write in. */
export interface CamIdentity {
  readonly guid: string
  readonly unit: UnitSystem
}

/**
 * A record's guid and unit, or `null` where it states no guid, or one that is
 * not a guid, and so cannot be written: every row a format writes is keyed by
 * it, and a malformed one is refused as a missing one is, never thrown on.
 */
export const camIdentity = (record: Pick<Catalog, 'guid' | 'unitSystem'>): CamIdentity | null =>
  record.guid === undefined || !isGuid(record.guid)
    ? null
    : { guid: record.guid, unit: record.unitSystem ?? 'millimeters' }
