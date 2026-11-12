import {
  conesToProfile,
  dimensionsOf,
  shaftParts,
  sliceAt,
  type Cone,
  type CuttingTool,
  type Extension,
  type Holder,
  type ToolKind,
} from '@toolpath/tool-support'

import { drawnExtension, staged, type Drawable, type Provenance } from './types.js'

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
 * **Every kind has a tip.** A kind with a shape of its own is drawn as its
 * numbers say; a kind no generator was written for borrows the nearest one
 * ({@link TIPS}) and its tip is marked `assumed`, so a renderer, or a
 * simulation that must not cut with a guess, can tell the two apart. What
 * cannot be drawn at all — a point angle that describes no cone — is not:
 * {@link assemblyOutline} returns `null` and the caller says so in words.
 */

export type OutlinePart =
  | 'tip'
  | 'flutes'
  | 'neck'
  | 'shank'
  | 'extension'
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

/** Where a tool's field came from: what its record says, else the vendor's. */
const stated = (tool: CuttingTool, field: string): Provenance =>
  tool.provenance?.[field] ?? 'vendor-stated'

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
 * `tipAngleDeg` is the full included angle, so the half-angle off the axis is
 * half that, and the cone reaches full radius at `r / tan(angle / 2)`. Where the vendor
 * publishes no angle the tool is still drawn — a drill with no point angle at
 * 118°, a chamfer mill at 90° — and the segment is marked `assumed` so the
 * renderer can say which number is nobody's.
 */
const cone = (tool: CuttingTool, r: number, whenUnstated: number): Tip | null => {
  const angle = tool.type === 'solid' ? tool.tipAngleDeg : undefined
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
    provenance: angle === undefined ? 'assumed' : stated(tool, 'tipAngleDeg'),
    top,
  }
}

/** The tip generators: what the end of a tool is shaped like. */
type TipShape = 'square' | 'ball' | 'corner' | 'disc' | 'point' | 'chamfer'

/**
 * Each kind's tip, and whether the generator is its own.
 *
 * A ball is a half circle, a corner a radius on a flat, a point a cone at the
 * drill's angle (118° where none is stated), a chamfer a cone at its own (90°).
 * A disc is the one tip rounded at both ends of its flutes. A face mill is
 * square: its inserts cut a flat bottom, as an end mill's flutes do. A tap is square —
 * deliberately: the vendors publish no chamfer lead, and the length over which
 * a plug tap tapers would have to be invented to draw it.
 *
 * **`borrowed` is a shape nobody wrote for the kind**, the nearest that was:
 * a thread mill, a boring bar, a counterbore and a reamer end square; a tapered mill and a circle-segment taper on a corner; a lollipop and
 * the other circle segments on a ball; a dovetail on a disc; a corner rounding
 * mill square at its full diameter. Its tip is `assumed`, whatever its numbers'
 * own provenance.
 */
export const TIPS: Readonly<
  Record<ToolKind, { readonly shape: TipShape; readonly borrowed?: true }>
> = {
  FlatEndmill: { shape: 'square' },
  RadiusEndmill: { shape: 'corner' },
  BallEndmill: { shape: 'ball' },
  FaceEndmill: { shape: 'square' },
  ChamferEndmill: { shape: 'chamfer' },
  Countersink: { shape: 'chamfer' },
  CornerRoundingMill: { shape: 'square', borrowed: true },
  DrillBit: { shape: 'point' },
  ThreadMill: { shape: 'square', borrowed: true },
  CuttingTap: { shape: 'square' },
  FormingTap: { shape: 'square' },
  KeyseatCutter: { shape: 'disc' },
  DovetailCutter: { shape: 'disc', borrowed: true },
  TaperedEndmill: { shape: 'corner', borrowed: true },
  LollipopMill: { shape: 'ball', borrowed: true },
  CircleSegmentBarrel: { shape: 'ball', borrowed: true },
  CircleSegmentLens: { shape: 'ball', borrowed: true },
  CircleSegmentOval: { shape: 'ball', borrowed: true },
  CircleSegmentTaper: { shape: 'corner', borrowed: true },
  BoringBar: { shape: 'square', borrowed: true },
  Counterbore: { shape: 'square', borrowed: true },
  CenterDrill: { shape: 'point' },
  Reamer: { shape: 'square', borrowed: true },
  SpotDrill: { shape: 'point' },
}

/** The tip by its shape, from the tool's own numbers. */
const shaped = (tool: CuttingTool, shape: TipShape): Tip | null => {
  const { diameter, fluteLength, cornerRadius = 0 } = dimensionsOf(tool)
  const r = diameter / 2
  const square: Tip = {
    points: [
      { r: 0, z: 0 },
      { r, z: 0 },
    ],
    provenance: stated(tool, 'diameter'),
    top: 0,
  }
  // Clamped to the cutting radius and to half the flute length: a radius
  // larger than either describes no tool, and the polygon it builds crosses
  // itself.
  const corner = Math.min(cornerRadius, r, fluteLength / 2)
  const rounded = (): Tip => ({
    points: [
      { r: 0, z: 0 },
      { r: r - corner, z: 0 },
      ...arc({ r: r - corner, z: corner }, corner, -90, 0),
    ],
    provenance: stated(tool, 'cornerRadius'),
    top: corner,
  })
  switch (shape) {
    case 'square':
      return square
    case 'ball':
      return {
        points: arc({ r: 0, z: r }, r, -90, 0),
        provenance: stated(tool, 'diameter'),
        top: r,
      }
    case 'corner':
      return corner <= EPSILON ? square : rounded()
    case 'disc':
      /**
       * **A radius on both ends of the disc.** A keyseat or woodruff cutter
       * carries its corner radius at the top of the flute as well as at the
       * bottom — unlike a bull nose, which has one only at the tip.
       */
      return corner <= EPSILON
        ? square
        : { ...rounded(), crown: arc({ r: r - corner, z: fluteLength - corner }, corner, 0, 90) }
    case 'point':
      return cone(tool, r, 118)
    case 'chamfer':
      return cone(tool, r, 90)
  }
}

/** The tip of this tool, `assumed` where its kind borrows another's shape. */
const tip = (tool: CuttingTool): Tip | null => {
  const { shape, borrowed } = TIPS[tool.kind]
  const drawn = shaped(tool, shape)
  return drawn === null || borrowed !== true ? drawn : { ...drawn, provenance: 'assumed' }
}

/**
 * A polyline split at one height into the part below and the part above,
 * sharing the point where they meet: interpolated where the height falls
 * between two vertices, and a vertex already at that height where one sits on
 * it. Where the solid steps on the line, `step` says which part takes the
 * step face. `above` is empty where nothing stands above the height.
 */
const splitAt = (
  points: ReadonlyArray<OutlinePoint>,
  z: number,
  step: 'below' | 'above',
): [Array<OutlinePoint>, Array<OutlinePoint>] => {
  const at = points.findIndex((point) =>
    step === 'below' ? point.z > z + EPSILON : point.z >= z - EPSILON,
  )
  // Taking the step above, the first vertex on the line ends the part below.
  const onLine = at >= 0 && Math.abs(points[at]!.z - z) <= EPSILON
  const cut = step === 'above' && onLine ? at + 1 : at
  if (cut <= 0 || cut >= points.length) {
    return [[...points], []]
  }
  const below = points.slice(0, cut)
  const last = below[below.length - 1]!
  const first = points[cut]!
  const meet =
    Math.abs(last.z - z) <= EPSILON
      ? last
      : { r: last.r + ((z - last.z) / (first.z - last.z)) * (first.r - last.r), z }
  if (meet !== last) {
    below.push(meet)
  }
  return [below, [meet, ...points.slice(cut)]]
}

/**
 * A holder as segments, placed with its nose face at the stickout.
 *
 * The stack runs from the nose up, as the outline does, so it is drawn as its
 * layers state: the first layer is the `nose`, the rest `body` up to the
 * spindle face at the gauge length, and what stands above that face — the
 * connection, where a stack carries one — `flange`, which the sheet shades
 * darker. **Nothing is resampled, smoothed or reduced**: a measured holder's
 * vertices are the measurement, grooves and thread reliefs included.
 */
const holderSegments = (holder: Holder, stickout: number): Array<OutlineSegment> => {
  const [nose] = holder.layers
  if (nose === undefined) {
    return []
  }
  const provenance = holder.provenance?.['layers'] ?? 'vendor-stated'
  const points = conesToProfile(holder.layers, stickout).map(([z, r]) => ({ r, z }))
  // The nose is its own layer, and the step out to the body is the body's face.
  const [front, rest] = splitAt(points, stickout + nose.thickness, 'above')
  // The step on the spindle face is the holder's, below the connection.
  const [body, connection] =
    holder.gaugeLength === null ? [rest, []] : splitAt(rest, stickout + holder.gaugeLength, 'below')
  return (
    [
      ['nose', front],
      ['body', body],
      ['flange', connection],
    ] as const
  )
    .filter(([, run]) => run.length >= 2)
    .map(([part, run]) => ({ part, points: run, provenance }))
}

/**
 * A modular extension as one segment, from its head face up to the holder face.
 *
 * Its layers run from the head face, `stickout − extensionProtrusion` above the
 * tip, and are cut at the holder face, since what is above it is in the holder.
 * Only a {@link drawnExtension} is drawn. Where its layers came from is its own
 * `provenance.layers`, and where nobody says, `assumed`: never `vendor-stated`
 * for a number nobody stated.
 */
const extensionSegment = (
  extension: Extension,
  face: number,
  stickout: number,
): OutlineSegment | null => {
  const points = conesToProfile(extension.layers, face).map(([z, r]) => ({ r, z }))
  const [exposed] = splitAt(points, stickout, 'below')
  return exposed.length < 2
    ? null
    : {
        part: 'extension',
        points: exposed,
        provenance: extension.provenance?.['layers'] ?? 'assumed',
      }
}

/**
 * The tool above its flutes as segments, from the top of the flutes up: the
 * `layers` of its `shaft` in view, each from its bottom diameter to its top,
 * so a tapered layer is drawn as the cone it is.
 *
 * A layer is `neck` or `shank` as `shaftParts` reads it, as the clearance
 * sweep does: `neck` below the shank run and narrower than the shank —
 * clamping's neck, the one a collet must not close on — and `shank`
 * otherwise, a shoulder wider than the shank included. Neighbouring layers of
 * one part are one segment. `held` marks the shank as
 * cut at the stickout: its length there is the shop's `chosen` one.
 */
const shaftSegments = (
  tool: CuttingTool,
  layers: ReadonlyArray<Cone>,
  held: boolean,
): Array<OutlineSegment> => {
  const { fluteLength } = dimensionsOf(tool)
  const parts = shaftParts(tool, layers)
  const provenance = stated(tool, 'shaft')
  const runs: Array<{ part: 'neck' | 'shank'; layers: Array<Cone>; bottom: number }> = []
  let bottom = 0
  for (const [index, layer] of layers.entries()) {
    const top = bottom + layer.thickness
    const part = parts[index] ?? 'shank'
    const last = runs.at(-1)
    // A layer of no height is a step between two others, not a section.
    if (layer.thickness > 0) {
      if (last?.part === part) {
        last.layers.push(layer)
      } else {
        runs.push({ part, layers: [layer], bottom })
      }
    }
    bottom = top
  }
  return runs.map((run) => ({
    part: run.part,
    points: conesToProfile(run.layers, fluteLength + run.bottom).map(([z, r]) => ({ r, z })),
    provenance: run.part === 'shank' && held ? 'chosen' : provenance,
  }))
}

/**
 * The outline of a tool, or of an assembly at its stickout.
 *
 * Flutes to the flute length, then the tool's `shaft` above them, cut at the
 * stickout or at the head face of a modular extension (whole, for a tool drawn
 * with no holder), the extension up to the stickout, and the holder stack
 * above that. A tool that states no shaft is drawn to the top of its flutes.
 *
 * `null` only where there is no honest picture: a point angle that describes
 * no cone.
 */
export const assemblyOutline = (subject: Drawable): Outline | null => {
  const view = staged(subject)
  const { tool, holder, stickout, extension } = view
  const { diameter, fluteLength } = dimensionsOf(tool)
  const r = diameter / 2
  const segments: Array<OutlineSegment> = []

  const point = tip(tool)
  if (point === null) {
    return null
  }
  segments.push({ part: 'tip', points: point.points, provenance: point.provenance })

  const crown = point.crown ?? []
  const straightTop = crown[0]?.z ?? fluteLength
  segments.push({
    part: 'flutes',
    points: [
      { r, z: point.top },
      { r, z: straightTop },
    ],
    provenance: stated(tool, 'fluteLength'),
  })
  if (crown.length > 0) {
    // Its own segment, because its shape is the corner radius' and its
    // position is the flute length's — two numbers a vendor states separately
    // and may state with different confidence.
    segments.push({ part: 'flutes', points: crown, provenance: point.provenance })
  }

  // On an extension, the shaft runs into it at its head face. Held, it runs up
  // into the holder at the stickout; without a holder the whole tool is in
  // view, so the whole shaft is drawn.
  const face = drawnExtension(view)
  const modular =
    face === null || extension === undefined || stickout === null
      ? null
      : extensionSegment(extension, face, stickout)
  const inHolder = holder !== null && stickout !== null
  const shaftTop = modular !== null ? modular.points[0]!.z : inHolder ? stickout : null
  const layers = tool.shaft ?? []
  const shaft = shaftSegments(
    tool,
    shaftTop === null ? layers : sliceAt(layers, shaftTop - fluteLength),
    inHolder,
  )
  segments.push(...shaft)
  let top = shaft.at(-1)?.points.at(-1)?.z ?? fluteLength
  if (modular !== null) {
    segments.push(modular)
    top = modular.points.at(-1)?.z ?? top
  }

  const held = stickout === null || holder === null ? [] : holderSegments(holder, stickout)
  if (stickout !== null && holder !== null && held.length > 0) {
    // The seated collet, standing proud of the nose by its protrusion, at its
    // series diameter — a PG 6 collet is 6 mm across. A holder's stack is its
    // own solid, and the collet seated in its nut is not in it.
    const series = /(\d+(?:\.\d+)?)/.exec(holder.colletSeries ?? '')
    if (holder.colletProtrusion !== undefined && series) {
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
    segments.push(...held)
    top = held[held.length - 1]!.points.at(-1)?.z ?? top
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
