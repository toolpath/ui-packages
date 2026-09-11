import { hasNeck } from '@toolpath/tool-support'

import { isHolderProfile } from './types.js'
import type {
  Provenance,
  ViewerAssembly,
  ViewerHolder,
  ViewerHolderProfile,
  ViewerTool,
} from './types.js'

/**
 * An assembly as a drawing: its outline in the plane of its own axis.
 *
 * A tool, a collet and a holder are all bodies of revolution, so the whole
 * stack is one polyline of (radius, height) pairs, from the tip up. That is
 * what a catalog draws, what a lathe would turn, and everything a picture needs
 * — a renderer mirrors it about the axis and it is a silhouette.
 *
 * **Drawn from stated dimensions, and marked where they are not.** Every
 * segment says which part it is and where its numbers came from, so a renderer
 * can dash what was derived or assumed. What nobody states is not drawn: a
 * holder the catalog knows only as a nose diameter and a gauge length is a
 * cylinder of that size and nothing above it, rather than a body invented to
 * look like one.
 *
 * **And what cannot be drawn honestly is not drawn at all.** There is no
 * fallback cylinder for a form without a generator. A silent cylinder is how a
 * made-up shape ships: it renders, it looks plausible, and it is wrong — a
 * keyseat cutter drawn flat is a featureless sliver two pixels tall, and a
 * reader has no way to tell that from a measurement. {@link assemblyOutline}
 * returns `null` instead and the caller says so in words.
 */

export type OutlinePart =
  | 'tip'
  | 'flutes'
  | 'neck'
  | 'shank'
  | 'collet'
  | 'nose'
  | 'body'
  | 'flange'

/** Radius out from the axis and height above the tip, both in millimetres. */
export interface OutlinePoint {
  readonly r: number
  readonly z: number
}

export interface OutlineSegment {
  readonly part: OutlinePart
  /** From the lower end up; the last point of one segment is the first of the next. */
  readonly points: ReadonlyArray<OutlinePoint>
  /** Where the dimensions came from — `chosen` for the stickout, which is nobody's but the shop's. */
  readonly provenance: Provenance | 'chosen'
}

export interface Outline {
  readonly segments: ReadonlyArray<OutlineSegment>
  /** The tallest point drawn, above the tip. */
  readonly height: number
  /** The widest radius drawn. */
  readonly radius: number
}

/** Below this a radius is treated as absent rather than tiny. */
const EPSILON = 1e-6

const stated = (tool: ViewerTool, code: string): Provenance =>
  tool.provenance?.[code] ?? 'vendor-stated'

/** Points along a quarter arc from (r0, z0) to (r1, z1) bulging outward, for a ball or a corner. */
const arc = (
  centre: OutlinePoint,
  radius: number,
  fromDeg: number,
  toDeg: number,
  steps = 6,
): Array<OutlinePoint> =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = ((fromDeg + ((toDeg - fromDeg) * index) / steps) * Math.PI) / 180
    // Rounded so a quarter turn lands exactly on the axis rather than 1e-16 off
    // it: a drawing is compared, and a polygon point is written out.
    const exact = (value: number) => Math.round(value * 1e9) / 1e9
    return {
      r: exact(centre.r + radius * Math.cos(angle)),
      z: exact(centre.z + radius * Math.sin(angle)),
    }
  })

/**
 * The cutting end of the tool, by what the tool is.
 *
 * `points` runs from the axis out to the full cutting radius, and `top` is the
 * height it reaches — where the straight flute begins. `crown` is the far end
 * of that straight run, for the one form that is rounded at *both* ends of its
 * cutting disc.
 */
interface Tip {
  readonly points: ReadonlyArray<OutlinePoint>
  readonly provenance: Provenance
  readonly top: number
  /**
   * The top of the flute, given the flute length: the points from where the
   * straight side stops up to the top of the cutting disc. Absent on every
   * form that ends square, which is every form but the slot mill.
   */
  readonly crown?: ReadonlyArray<OutlinePoint>
}

/**
 * A cone at the vendor's point angle.
 *
 * `SIG` is the full included angle, so the half-angle off the axis is `SIG/2`
 * and the cone reaches full radius at `r / tan(SIG/2)`. Where the vendor
 * publishes no angle the tool is still drawn — a drill with no point angle at
 * 118°, a chamfer mill at 90° — and the segment is marked `assumed` so the
 * renderer can say which number is nobody's.
 */
const cone = (tool: ViewerTool, r: number, whenUnstated: number): Tip | null => {
  const angle = tool.geometry.SIG
  const half = ((angle ?? whenUnstated) / 2) * (Math.PI / 180)
  const top = r / Math.tan(half)
  // A point angle of zero, or of more than a half turn, describes no cone. A
  // polygon built from it self-crosses and renders as garbage.
  if (!Number.isFinite(top) || top < 0) {
    return null
  }
  return {
    points: [
      { r: 0, z: 0 },
      { r, z: top },
    ],
    provenance: angle === undefined ? 'assumed' : stated(tool, 'SIG'),
    top,
  }
}

/**
 * The tip, by what the tool is.
 *
 * A ball is a half circle, a bull nose a corner radius on a flat, a drill a
 * cone at its point angle, a chamfer mill a cone at its own. A slot mill is the
 * one disc rounded at both ends. A tap is square — deliberately: the vendors
 * publish no chamfer lead, and the length over which a plug tap tapers would
 * have to be invented to draw it. Both hands of tap, because the hand of the
 * thread is not visible in an elevation.
 *
 * **Anything else is `null`.** Four of the generators this was ported from
 * invent shape out of a hardcoded taper angle or a neck radius of `r * 0.4`,
 * and none of them came across. Where a vendor publishes nothing, this draws
 * nothing.
 */
const tip = (tool: ViewerTool, LCF: number): Tip | null => {
  const DC = tool.geometry.DC ?? 0
  const r = DC / 2
  const RE = tool.geometry.RE ?? 0
  const square: Tip = {
    points: [
      { r: 0, z: 0 },
      { r, z: 0 },
    ],
    provenance: stated(tool, 'DC'),
    top: 0,
  }
  switch (tool.form) {
    case 'flat end mill':
    case 'tap left hand':
    case 'tap right hand':
      return square
    case 'ball end mill':
      return { points: arc({ r: 0, z: r }, r, -90, 0), provenance: stated(tool, 'DC'), top: r }
    case 'bull nose end mill': {
      // Clamped to the cutting radius and to half the flute length: a radius
      // larger than either describes no tool, and the polygon it builds
      // crosses itself.
      const corner = Math.min(RE, r, LCF / 2)
      if (corner <= EPSILON) {
        return square
      }
      return {
        points: [
          { r: 0, z: 0 },
          { r: r - corner, z: 0 },
          ...arc({ r: r - corner, z: corner }, corner, -90, 0),
        ],
        provenance: stated(tool, 'RE'),
        top: corner,
      }
    }
    case 'slot mill': {
      /**
       * **A radius on both ends of the disc.** A keyseat or woodruff cutter
       * carries its corner radius at the top of the flute as well as at the
       * bottom — unlike a bull nose, which has one only at the tip. Drawn with
       * the bull nose's generator it is a flat sliver, which is what the form
       * looked like before it had a generator of its own.
       */
      const corner = Math.min(RE, r, LCF / 2)
      if (corner <= EPSILON) {
        return square
      }
      return {
        points: [
          { r: 0, z: 0 },
          { r: r - corner, z: 0 },
          ...arc({ r: r - corner, z: corner }, corner, -90, 0),
        ],
        provenance: stated(tool, 'RE'),
        top: corner,
        crown: arc({ r: r - corner, z: LCF - corner }, corner, 0, 90),
      }
    }
    case 'drill':
    case 'spot drill':
    case 'center drill':
      return cone(tool, r, 118)
    case 'chamfer mill':
    case 'counter sink':
      return cone(tool, r, 90)
    default:
      return null
  }
}

/**
 * A measured holder as segments, placed with its nose face at the stickout.
 *
 * Two frames meet here and they run opposite ways. A profile is stated on its
 * own datum with `z` increasing toward the cutting end; an outline is stated
 * with `z` increasing *up* from the tool tip. So the nose vertex — the last
 * one, the highest `z` either way the profile is datumed — lands at the
 * stickout and the stack is walked back from it:
 *
 * ```
 * z = stickout + (noseZ - zProfile)
 * ```
 *
 * **Nothing is resampled, smoothed or reduced.** The vertices are the
 * measurement, grooves and thread reliefs included, and the whole point of
 * carrying a profile is that they survive the trip.
 *
 * **The split is the gage line, and it is exact rather than a heuristic.**
 * Everything above the spindle face is the connection — the flange and the cone
 * that leads up to it — which the sheet draws in its own darker grey, and
 * `z = 0` on a `gage-line` profile *is* that face. Where the polyline crosses
 * it between two vertices the crossing point is interpolated and shared by both
 * segments, as every other pair of segments here shares its meeting point. A
 * `nose`-datumed profile has no spindle face to split on and stays one segment.
 */
const profileSegments = (holder: ViewerHolderProfile, stickout: number): Array<OutlineSegment> => {
  const nose = holder.points[holder.points.length - 1]
  if (holder.points.length < 2 || nose === undefined) {
    return []
  }
  const provenance = holder.provenance?.['points'] ?? 'vendor-stated'
  const gage = stickout + nose[0]
  const up = [...holder.points]
    .reverse()
    .map(([z, r]): OutlinePoint => ({ r, z: stickout + (nose[0] - z) }))

  const cut = holder.datum === 'gage-line' ? up.findIndex((point) => point.z > gage) : -1
  if (cut <= 0) {
    return [{ part: 'body', points: up, provenance }]
  }
  const below = up.slice(0, cut)
  const above = up.slice(cut)
  const last = below[below.length - 1]!
  const first = above[0]!
  const meet =
    last.z === gage
      ? last
      : {
          r: last.r + ((gage - last.z) / (first.z - last.z)) * (first.r - last.r),
          z: gage,
        }
  if (meet !== last) {
    below.push(meet)
  }
  above.unshift(meet)
  return [
    { part: 'body', points: below, provenance },
    { part: 'flange', points: above, provenance },
  ]
}

/**
 * A holder as the vendor's table states it: a nose, a body, and a flange.
 *
 * The stylised form — every diameter a number somebody published, nothing
 * between them invented. `top` is where the holder ends, which is what the
 * assembly's own height is measured to.
 */
const parametricSegments = (
  holder: ViewerHolder,
  stickout: number,
  DC: number,
): Array<OutlineSegment> => {
  if (holder.noseDiameter === null) {
    return []
  }
  const segments: Array<OutlineSegment> = []
  const rh = holder.noseDiameter / 2
  const holderStated = (code: string): Provenance => holder.provenance?.[code] ?? 'vendor-stated'
  let top = stickout

  // The nose, for its stated length; with none stated, for the gauge length
  // as before, so an older dataset draws what it always did.
  const noseLength = holder.noseLength ?? holder.gaugeLength ?? Math.max(20, DC * 3)
  segments.push({
    part: 'nose',
    points: [
      { r: rh, z: stickout },
      { r: rh, z: stickout + noseLength },
    ],
    provenance:
      holder.noseLength !== null
        ? holderStated('noseLength')
        : holder.gaugeLength === null
          ? 'assumed'
          : holderStated('noseDiameter'),
  })
  top = stickout + noseLength
  let radius = rh

  if (holder.bodyDiameter !== null && holder.bodyLength !== null) {
    const rb = holder.bodyDiameter / 2
    segments.push({
      part: 'body',
      points: [
        { r: rb, z: top },
        { r: rb, z: top + holder.bodyLength },
      ],
      provenance: holderStated('bodyDiameter'),
    })
    top += holder.bodyLength
    radius = rb
  }

  if (holder.projection !== null && holder.flangeDiameter !== null) {
    const flangeAt = stickout + holder.projection
    const rf = holder.flangeDiameter / 2
    if (flangeAt > top) {
      /**
       * **The last stated diameter, carried up to the flange.**
       *
       * This was a cone from the body out to the flange, and it was an
       * invention: on a PG 10 × 062 it flared ⌀18 to ⌀46 over 34 mm — more
       * than half the drawn holder, in a shape the vendor never published,
       * and the sweep treated it as solid. Tools were turned down for metal
       * that is not there (Paul, 2026-08-31).
       *
       * Justin Mimbs' reach-curve note models a holder as cylinders: each
       * layer at its widest, no credit for a taper, and the last diameter
       * carried upward. This is that carry — assumed, because the vendor
       * states nothing here, but assumed to be *no wider than what it
       * states* rather than assumed to flare.
       */
      segments.push({
        part: 'body',
        points: [
          { r: radius, z: top },
          { r: radius, z: flangeAt },
        ],
        provenance: 'assumed',
      })
    }
    // The flange: its diameter is the taper's, and it runs from the
    // projection up to the gauge line — both stated. Where the gauge length
    // is not, the 20 mm of a BT 30 V-flange stands in.
    const flangeTop =
      holder.gaugeLength !== null && holder.gaugeLength > holder.projection
        ? stickout + holder.gaugeLength
        : flangeAt + 20
    segments.push({
      part: 'flange',
      points: [
        { r: rf, z: flangeAt },
        { r: rf, z: flangeTop },
      ],
      provenance: holder.gaugeLength === null ? 'assumed' : holderStated('flangeDiameter'),
    })
    top = flangeTop
  }

  return segments
}

/**
 * The outline of one assembly at its stickout.
 *
 * Flutes to the flute length, a neck where a shoulder is stated, the shank up
 * to the stickout, and the holder nose above that for its gauge length.
 *
 * `null` where there is no honest picture: a form without a generator, or a
 * tool that states neither a cutting diameter nor a flute length.
 */
export const assemblyOutline = (assembly: ViewerAssembly): Outline | null => {
  const { tool, holder, stickout } = assembly
  const { DC, LCF, SFDM } = tool.geometry
  if (DC === undefined || LCF === undefined) {
    return null
  }
  const r = DC / 2
  const segments: Array<OutlineSegment> = []

  const point = tip(tool, LCF)
  if (point === null) {
    return null
  }
  segments.push({ part: 'tip', points: point.points, provenance: point.provenance })

  const crown = point.crown ?? []
  const straightTop = crown[0]?.z ?? LCF
  segments.push({
    part: 'flutes',
    points: [
      { r, z: point.top },
      { r, z: straightTop },
    ],
    provenance: stated(tool, 'LCF'),
  })
  if (crown.length > 0) {
    // Its own segment, because its shape is the corner radius' and its
    // position is the flute length's — two numbers a vendor states separately
    // and may state with different confidence.
    segments.push({ part: 'flutes', points: crown, provenance: point.provenance })
  }

  const neckDiameter = tool.geometry['shoulder-diameter']
  const shoulder = tool.geometry['shoulder-length']
  let top = LCF
  if (neckDiameter !== undefined && shoulder !== undefined && shoulder > LCF) {
    const rn = neckDiameter / 2
    segments.push({
      // A shoulder as wide as the cut is plain shank; only a narrower one is a neck.
      part: hasNeck(tool) ? 'neck' : 'shank',
      points: [
        { r: rn, z: LCF },
        { r: rn, z: shoulder },
      ],
      provenance: stated(tool, 'shoulder-length'),
    })
    top = shoulder
  }

  const shankTop = stickout ?? tool.geometry.OAL ?? top
  if (SFDM !== undefined && shankTop > top) {
    const rs = SFDM / 2
    segments.push({
      part: 'shank',
      points: [
        { r: rs, z: top },
        { r: rs, z: shankTop },
      ],
      provenance: stickout === null ? stated(tool, 'SFDM') : 'chosen',
    })
    top = shankTop
  }

  const holderSegments =
    stickout === null || holder === null
      ? []
      : isHolderProfile(holder)
        ? profileSegments(holder, stickout)
        : parametricSegments(holder, stickout, DC)
  if (stickout !== null && holder !== null && holderSegments.length > 0) {
    // The seated collet, standing proud of the nose by its protrusion, at its
    // series diameter — a PG 6 collet is 6 mm across. Common to both holder
    // forms: a measured envelope is the holder's own solid, and the collet
    // seated in its nut is no more present in that than in the vendor's table.
    const series = /(\d+(?:\.\d+)?)/.exec(holder.colletSeries ?? '')
    if (holder.colletProtrusion !== null && series) {
      const rc = Number(series[1]) / 2
      segments.push({
        part: 'collet',
        points: [
          { r: rc, z: stickout - holder.colletProtrusion },
          { r: rc, z: stickout },
        ],
        provenance: holder.provenance?.['colletProtrusion'] ?? 'vendor-stated',
      })
    }
    segments.push(...holderSegments)
    // Both forms end at their last vertex, so the assembly's height is that
    // point rather than a total either helper has to hand back separately.
    top = holderSegments[holderSegments.length - 1]!.points.at(-1)?.z ?? top
  }

  const radius = Math.max(...segments.flatMap((segment) => segment.points.map((point) => point.r)))
  return { segments, height: top, radius }
}

/** Where one edge of the silhouette sits at a height, or `null` if it is not there. */
const edgeRadius = (from: OutlinePoint, to: OutlinePoint, z: number): number | null => {
  const low = Math.min(from.z, to.z)
  const high = Math.max(from.z, to.z)
  if (z < low - EPSILON || z > high + EPSILON) {
    return null
  }
  // A step is two vertices at one height: the wider of them is the edge there.
  if (high - low <= EPSILON) {
    return Math.max(from.r, to.r)
  }
  return from.r + ((z - from.z) / (to.z - from.z)) * (to.r - from.r)
}

/**
 * The widest the drawing reaches at one height.
 *
 * **Where an extension line starts.** A dimension line runs outside the whole
 * view, which is what a sheet does, but the line that carries the eye to it
 * starts at the solid being measured — and {@link Outline.radius} is the widest
 * thing *anywhere* in the stack. With a holder those are twenty millimetres
 * apart: a ⌀46 flange over a ⌀3 shank, so every extension line began in empty
 * margin and pointed at nothing (Paul, 2026-09-02).
 *
 * Zero where nothing is drawn — past either end of the stack, and on the axis
 * at the point of a drill.
 */
export const radiusAt = (outline: Outline, z: number): number =>
  Math.max(
    0,
    ...outline.segments.flatMap((segment) =>
      segment.points
        .slice(1)
        .map((point, index) => edgeRadius(segment.points[index]!, point, z))
        .filter((radius): radius is number => radius !== null),
    ),
  )
