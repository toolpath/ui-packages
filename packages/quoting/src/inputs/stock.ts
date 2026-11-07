import { sameJson, type PlanDirection } from '@toolpath/plan'

import { formatLength, type Units } from '../units/units'

/** Engine 1.21 stock inputs. Every dimensional value is millimetres. */
export type StockPosition = 'modelCentered' | 'offsetFromTop' | 'offsetFromBottom'
export type AutomaticStock =
  | {
      mode: 'automaticFlatBar'
      oversizeX?: number
      oversizeY?: number
      oversizeZTop?: number
      oversizeZBottom?: number
      snapX?: number
      snapY?: number
      snapZ?: number
    }
  | {
      mode: 'automaticRoundStock'
      radialOversize?: number
      axialOversize?: number
      gripStock?: number
      diaRoundToNearest?: number
      lengthRoundToNearest?: number
      verticalAxis?: boolean
    }
export type FixedStock =
  | {
      mode: 'fixedBox'
      dimensions: { x: number; y: number; z: number }
      position: StockPosition
      positionOffset?: number
    }
  | {
      mode: 'fixedCylinder'
      diameter: number
      length: number
      position: StockPosition
      positionOffset?: number
    }
export type StockOption = AutomaticStock | FixedStock

export const STOCK_LABELS = {
  automaticFlatBar: 'Flat Bar',
  automaticRoundStock: 'Round Stock',
  fixedBox: 'Fixed Box',
  fixedCylinder: 'Fixed Cylinder',
} as const

export const FLAT_BAR_FIELDS = [
  ['oversizeX', 'Width (X)'],
  ['oversizeY', 'Depth (Y)'],
  ['oversizeZTop', 'Thickness (Z)'],
  ['snapX', 'Width (X)'],
  ['snapY', 'Depth (Y)'],
  ['snapZ', 'Thickness (Z)'],
  ['oversizeZBottom', 'Stock Grip Amt.'],
] as const
export const ROUND_STOCK_FIELDS = [
  ['radialOversize', 'Radial'],
  ['axialOversize', 'Front'],
  ['diaRoundToNearest', 'Diameter'],
  ['lengthRoundToNearest', 'Length'],
  ['gripStock', 'Stock Grip Amt.'],
] as const

/** Legacy-style defaults in the stock setting's entry system, stored canonical. */
export const defaultStock = (
  mode: AutomaticStock['mode'] = 'automaticFlatBar',
  units: Units = 'in',
): AutomaticStock => {
  const oversize = units === 'in' ? 0.762 : 0.5
  const increment = units === 'in' ? 6.35 : 5
  return mode === 'automaticFlatBar'
    ? {
        mode,
        oversizeX: oversize,
        oversizeY: oversize,
        oversizeZTop: oversize,
        oversizeZBottom: increment,
        snapX: increment,
        snapY: increment,
        snapZ: increment,
      }
    : {
        mode,
        radialOversize: oversize,
        axialOversize: oversize,
        gripStock: increment,
        diaRoundToNearest: increment,
        lengthRoundToNearest: increment,
        // Milling flow: stand the round along the first cutting direction, explicitly.
        verticalAxis: true,
      }
}

/** The largest stock Toolpath takes, mm, sides largest first: 80 × 50 × 30 in. */
const ENVELOPE_MM = [2032, 1270, 762] as const

/** The refusal of a stock of no mode Toolpath takes. */
const CHOOSE_STOCK = 'Choose automatic stock, a fixed box or a fixed cylinder.'

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const mm = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

/** Validate the service contract, including its stock envelope, before saving or forwarding. */
export const parseStock = (value: unknown): StockOption | string => {
  if (!record(value)) {
    return CHOOSE_STOCK
  }
  const { mode } = value
  if (mode === 'automaticFlatBar' || mode === 'automaticRoundStock') {
    return parseAutomaticStock(value, mode)
  }
  if (mode !== 'fixedBox' && mode !== 'fixedCylinder') {
    return CHOOSE_STOCK
  }
  return parseFixedStock(value, mode)
}

/** Whether `value` names a setting `allowed` does not. */
const hasUnknownKey = (value: Record<string, unknown>, allowed: ReadonlyArray<string>): boolean =>
  Object.keys(value).some((key) => !allowed.includes(key))

/** Flat Bar or Round Stock as the contract takes it, or why not. */
const parseAutomaticStock = (
  value: Record<string, unknown>,
  mode: AutomaticStock['mode'],
): AutomaticStock | string => {
  const fields = mode === 'automaticFlatBar' ? FLAT_BAR_FIELDS : ROUND_STOCK_FIELDS
  const keys: Array<string> = fields.map(([key]) => key)
  const allowed = ['mode', ...keys, ...(mode === 'automaticRoundStock' ? ['verticalAxis'] : [])]
  if (hasUnknownKey(value, allowed)) {
    return 'The automatic stock contains an unknown setting.'
  }
  if (keys.some((key) => value[key] !== undefined && !mm(value[key], 0, 762))) {
    return 'Stock oversize, grip and rounding must be between 0 and 30 in (762 mm).'
  }
  if (
    mode === 'automaticRoundStock' &&
    value.verticalAxis !== undefined &&
    typeof value.verticalAxis !== 'boolean'
  ) {
    return 'Choose whether Round Stock stands along the cutting direction.'
  }
  return value as AutomaticStock
}

/** A fixed box or cylinder as the contract takes it, or why not. */
const parseFixedStock = (
  value: Record<string, unknown>,
  mode: FixedStock['mode'],
): FixedStock | string => {
  const allowed = [
    'mode',
    'position',
    'positionOffset',
    ...(mode === 'fixedBox' ? ['dimensions'] : ['diameter', 'length']),
  ]
  if (hasUnknownKey(value, allowed)) {
    return 'The fixed stock contains an unknown setting.'
  }
  if (!['modelCentered', 'offsetFromTop', 'offsetFromBottom'].includes(String(value.position))) {
    return 'Choose the stock position.'
  }
  if (value.positionOffset !== undefined && !mm(value.positionOffset, -2032, 2032)) {
    return 'The stock position offset must be between -80 and 80 in (-2032 and 2032 mm).'
  }
  const sizeProblem =
    mode === 'fixedBox' ? fixedBoxSizeProblem(value.dimensions) : fixedCylinderSizeProblem(value)
  return sizeProblem ?? (value as FixedStock)
}

/** Whether a positive size in mm, within the largest side Toolpath takes. */
const positiveSide = (n: unknown): boolean => mm(n, 0, 2032) && n > 0

/** Whether three sides fit the envelope in no order: the largest against its largest, and so on. */
const outsideEnvelope = (sides: ReadonlyArray<number>): boolean =>
  [...sides].sort((a, b) => b - a).some((n, i) => n > ENVELOPE_MM[i]!)

/** Why a fixed box's dimensions can't be taken, or null. */
const fixedBoxSizeProblem = (dims: unknown): string | null => {
  if (
    !record(dims) ||
    hasUnknownKey(dims, ['x', 'y', 'z']) ||
    ![dims.x, dims.y, dims.z].every(positiveSide)
  ) {
    return 'Give the fixed box positive X, Y and Z dimensions.'
  }
  // Entered in the part's axes: which side runs along the cutting direction is the first
  // folder's to say (`stockRequest`), so here it need only fit the envelope some way round.
  if (outsideEnvelope([dims.x as number, dims.y as number, dims.z as number])) {
    return 'The box must fit within 80 × 50 × 30 in in some order.'
  }
  return null
}

/** Why a fixed cylinder's diameter and length can't be taken, or null. */
const fixedCylinderSizeProblem = (value: Record<string, unknown>): string | null => {
  if (![value.diameter, value.length].every(positiveSide)) {
    return 'Give the fixed cylinder a positive diameter and length.'
  }
  const { diameter, length } = value as { diameter: number; length: number }
  if (outsideEnvelope([diameter, diameter, length])) {
    return 'The cylinder’s diameter × diameter × length must fit within 80 × 50 × 30 in in some order.'
  }
  return null
}

/** Stable comparison of policy values, independent of JSON property order. */
export const sameStock = (
  a: StockOption | null | undefined,
  b: StockOption | null | undefined,
): boolean => sameJson(a ?? null, b ?? null)

/**
 * Whether the saved policy is not the stock the part's times were calculated with. A calculation
 * echoes the stock it was sent (`stock.input`, read by `echoesStock`), so edited stock — or none
 * calculated yet — shows as a preview of the policy until a calculation of it lands. A part with
 * no policy has nothing edited.
 */
export const stockEdited = (
  policy: StockOption | null,
  baseline: Record<string, unknown> | null,
): boolean => (policy ? !echoesStock(policy, baseline?.stock) : false)

/* ---------- A fixed box: the part's axes, and Toolpath's frame ---------- */

/*
  A fixed box is entered, stored, fingerprinted and previewed in the part's model axes — X, Y and Z
  as the viewer shows the part. Toolpath reads it in the first stated setup's frame: `z` its
  thickness along that setup's direction, `x` and `y` its two sides across it, in either order —
  Toolpath lays the longer along the part's longer side across it, centred on the part. Along it,
  `offsetFromTop` puts the box's top `positionOffset` beyond the part's face toward the direction,
  `offsetFromBottom` its bottom `positionOffset` beyond the face away from it, and `modelCentered`
  centres it on the part. So the box is turned into that frame as it is sent (`stockRequest`), which
  needs a first folder facing along X, Y or Z: with none, Toolpath picks its own first setup, and
  the box's frame is not known here.
*/

export type ModelAxis = 'x' | 'y' | 'z'
const AXES: ReadonlyArray<ModelAxis> = ['x', 'y', 'z']
/** How far off its axis a direction may lean and still be read as facing along it. */
const AXIS_TOLERANCE = 1e-6
/** How far past a side a figure may read and still be within it, mm. */
const FIT_TOLERANCE_MM = 1e-6

export const NO_FIRST_FOLDER = 'Add a folder first: a fixed box is measured from the first setup.'
export const TILTED_FIRST_FOLDER = 'A fixed box needs a first folder facing along X, Y or Z.'
export const BOX_ENVELOPE =
  'The box must fit 80 × 50 in across the first folder’s direction and 30 in along it.'
/** What Apply says while the fixed box does not fit. */
const FIX_STOCK_FIRST = 'Fix the stock first'

/** The model axis a direction faces along, and which way; null for one off every axis. */
export const axisAlong = (direction: PlanDirection): { axis: ModelAxis; sign: 1 | -1 } | null => {
  const along = AXES.filter((axis) => Math.abs(direction[axis]) > AXIS_TOLERANCE)
  const axis = along.length === 1 ? along[0]! : null
  return axis ? { axis, sign: direction[axis] > 0 ? 1 : -1 } : null
}

/** The first folder's axis a fixed box is measured along, or why there is none. */
const boxFrameOf = (first: PlanDirection | null) =>
  first === null ? NO_FIRST_FOLDER : (axisAlong(first) ?? TILTED_FIRST_FOLDER)

/** The two model axes across `axis`, in model order. */
const across = (axis: ModelAxis): [ModelAxis, ModelAxis] =>
  AXES.filter((each) => each !== axis) as [ModelAxis, ModelAxis]

/**
 * The stock as Toolpath is sent it, for a plan whose first stated setup faces `first` (null with
 * none stated): any stock but a fixed box as it is; a fixed box turned into that setup's frame, or
 * why it can't be — no first folder, one facing off the axes, or a box too thick along it.
 */
export const stockRequest = (
  stock: StockOption,
  first: PlanDirection | null,
): StockOption | string => {
  if (stock.mode !== 'fixedBox') {
    return stock
  }
  const frame = boxFrameOf(first)
  if (typeof frame === 'string') {
    return frame
  }
  const [a, b] = across(frame.axis)
  const { dimensions } = stock
  const sent = { x: dimensions[a], y: dimensions[b], z: dimensions[frame.axis] }
  const [length, width, depth] = ENVELOPE_MM
  return Math.max(sent.x, sent.y) > length + FIT_TOLERANCE_MM ||
    Math.min(sent.x, sent.y) > width + FIT_TOLERANCE_MM ||
    sent.z > depth + FIT_TOLERANCE_MM
    ? BOX_ENVELOPE
    : { ...stock, dimensions: sent }
}

const vectorOf = (value: unknown): PlanDirection | null =>
  record(value) && [value.x, value.y, value.z].every((n) => typeof n === 'number')
    ? { x: value.x as number, y: value.y as number, z: value.z as number }
    : null

/**
 * The direction Toolpath placed a calculation's stock along (its first setup's), or null where it
 * can't be read: a box's frame `z`; a cylinder's axis where the stock asked for stood it along that
 * direction — a fixed cylinder, or Round Stock with `verticalAxis` — taken only facing along X, Y or
 * Z. A lying round bar's axis is the part's long side, not the direction, so it gives none.
 */
export const placedAlong = (envelope: unknown): PlanDirection | null => {
  const resolved = record(envelope) ? envelope.resolved : null
  const input = record(envelope) ? envelope.input : null
  if (record(resolved) && resolved.shape === 'cylinder') {
    const stood =
      record(input) &&
      (input.mode === 'fixedCylinder' ||
        (input.mode === 'automaticRoundStock' && input.verticalAxis === true))
    const along = stood ? vectorOf(resolved.axis) : null
    const axis = along && axisAlong(along)
    return axis ? { x: 0, y: 0, z: 0, [axis.axis]: axis.sign } : null
  }
  return vectorOf(record(resolved) && record(resolved.frame) ? resolved.frame.axis : null)
}

/**
 * Whether a calculation's stock envelope echoes `policy` as it was sent (`stock.input`): the same
 * stock — but a fixed box turned into the frame Toolpath placed it in (`placedAlong`) or, with no
 * placement to read, into the frame of any one of the part's axes.
 */
export const echoesStock = (policy: StockOption, envelope: unknown): boolean => {
  const sent = parseStock(record(envelope) ? envelope.input : undefined)
  if (typeof sent === 'string') {
    return false
  }
  if (policy.mode !== 'fixedBox') {
    return sameStock(policy, sent)
  }
  const placed = placedAlong(envelope)
  const firsts = placed ? [placed] : AXES.map((axis) => ({ x: 0, y: 0, z: 0, [axis]: 1 }))
  return firsts.some((first) => {
    const request = stockRequest(policy, first)
    return typeof request !== 'string' && sameStock(request, sent)
  })
}

/** A box in the part's model coordinates, mm: its least and greatest corners. */
export interface ModelBox {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

/* ---------- Where Toolpath builds stock, in model coordinates ---------- */

/*
  Toolpath builds every stock in the first setup's stock frame (tp-rs `workholding::frame`): `z`
  along the setup's direction, `x` the part's longer side across it and `y` = z × x. It turns the
  frame about `z` to the footprint the part's upright planar walls square it to — walls not known
  here — so a part squared to the model axes is assumed: the direction's own frame (`Axis2::from_axis`,
  its x level) or a quarter turn of it, whichever lays the longer side on `x`. In that frame a block
  is centred across `z` and placed along it by its position (`StockPosition::lower_z`), and a
  cylinder centred on the part's smallest enclosing circle about its axis — here the circle about
  the part's box across it — and placed along it the same way.
*/

/** A frame's axes, each a model axis and which way along it. */
type StockFrame = Record<ModelAxis, { axis: ModelAxis; sign: 1 | -1 }>
type Span = [low: number, high: number]

const cross = (a: PlanDirection, b: PlanDirection): PlanDirection => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const unit = ({ axis, sign }: StockFrame[ModelAxis]): PlanDirection => ({
  x: 0,
  y: 0,
  z: 0,
  [axis]: sign,
})

/** The frame Toolpath builds stock in for a first setup facing `first`, or null off the axes. */
const stockFrame = (first: PlanDirection | null, part: ModelBox): StockFrame | null => {
  const z = first && axisAlong(first)
  if (!z) {
    return null
  }
  const along = unit(z)
  // The direction's own x is level, its x component not negative; for ±Z it is ±X.
  const level = cross(along, { x: 0, y: 0, z: 1 })
  const flip = along.y < 0 ? -1 : 1
  const toolX = axisAlong(level)
    ? { x: level.x * flip, y: level.y * flip, z: level.z * flip }
    : { x: along.z < 0 ? -1 : 1, y: 0, z: 0 }
  const toolY = cross(along, toolX)
  const extent = (v: PlanDirection) =>
    Math.abs(AXES.reduce((sum, k) => sum + v[k] * (part.max[k] - part.min[k]), 0))
  // A tie keeps the direction's own frame, as the kernel's least turn does.
  const x = extent(toolY) > extent(toolX) ? toolY : toolX
  return { x: axisAlong(x)!, y: axisAlong(cross(along, x))!, z }
}

/** A span read along a frame axis, from model coordinates or back to them. */
const spanAlong = (sign: 1 | -1, [low, high]: Span): Span =>
  sign > 0 ? [low, high] : [-high, -low]
const partSpan = (part: ModelBox, { axis, sign }: StockFrame[ModelAxis]): Span =>
  spanAlong(sign, [part.min[axis], part.max[axis]])
const extentAlong = (part: ModelBox, frameAxis: StockFrame[ModelAxis]): number => {
  const [low, high] = partSpan(part, frameAxis)
  return high - low
}

/** Where stock `length` long starts along a frame axis the part spans `low..high` of. */
const stockStart = (
  position: StockPosition,
  offset: number,
  [low, high]: Span,
  length: number,
): number =>
  position === 'offsetFromTop'
    ? high + offset - length
    : position === 'offsetFromBottom'
      ? low - offset
      : (low + high - length) / 2

/** Rounded up to a multiple of `increment`, as the kernel rounds (`ceil_to_multiple`); 0 leaves it. */
const snapUp = (size: number, increment: number): number =>
  increment === 0 ? size : Math.ceil(Math.round((size / increment) * 1e6) / 1e6) * increment

/** A block `size` big in the frame, centred across `z` and placed along it by `position`. */
const placeBlock = (
  frame: StockFrame,
  part: ModelBox,
  size: Record<ModelAxis, number>,
  position: StockPosition,
  offset: number,
): ModelBox => {
  const min = { ...part.min }
  const max = { ...part.max }
  for (const k of AXES) {
    const span = partSpan(part, frame[k])
    const start =
      k === 'z'
        ? stockStart(position, offset, span, size.z)
        : stockStart('modelCentered', 0, span, size[k])
    const { axis, sign } = frame[k]
    ;[min[axis], max[axis]] = spanAlong(sign, [start, start + size[k]])
  }
  return { min, max }
}

/** A cylinder in the part's model coordinates, mm: its base centre, unit axis and size. */
export interface ModelCylinder {
  origin: PlanDirection
  axis: PlanDirection
  diameter: number
  length: number
}

/** A cylinder along frame axis `along`, centred across it, its base where `start` puts it. */
const placeCylinder = (
  frame: StockFrame,
  part: ModelBox,
  along: 'x' | 'z',
  diameter: number,
  length: number,
  start: (span: Span) => number,
): ModelCylinder => {
  const { axis, sign } = frame[along]
  const middle = (k: ModelAxis) => (part.min[k] + part.max[k]) / 2
  return {
    origin: {
      x: middle('x'),
      y: middle('y'),
      z: middle('z'),
      [axis]: sign * start(partSpan(part, frame[along])),
    },
    axis: unit(frame[along]),
    diameter,
    length,
  }
}

/**
 * Where Toolpath builds a fixed box around the part, in model coordinates, by the frame reading
 * above — or null without a first folder facing along an axis. Its two sides across the direction
 * are laid longer along the part's longer side (the worker sends them so, tp-kernel loads them so);
 * `turned`: the other way round from how they were entered.
 */
export const fixedBoxPlacement = (
  stock: Extract<StockOption, { mode: 'fixedBox' }>,
  first: PlanDirection | null,
  part: ModelBox,
): (ModelBox & { turned: boolean }) | null => {
  const frame = stockFrame(first, part)
  if (!frame) {
    return null
  }
  const { dimensions } = stock
  const [x, y] = [dimensions[frame.x.axis], dimensions[frame.y.axis]]
  const size = { x: Math.max(x, y), y: Math.min(x, y), z: dimensions[frame.z.axis] }
  return {
    ...placeBlock(frame, part, size, stock.position, stock.positionOffset ?? 0),
    turned: x < y,
  }
}

/**
 * Where Toolpath builds any stock around the part, in model coordinates, standing it in the frame
 * of a first setup facing `first` along an axis (null otherwise): a block (`box`) or a cylinder.
 * Flat Bar: each side the part's extent plus its oversizes — `x` / `y` on either side across,
 * `zTop` toward the direction and the exact grip `zBottom` away from it — rounded up, the grip
 * kept exact (tp-rs `StockBox::relative`). Round Stock: lying along the part's longer side across
 * the direction, or standing along it (`verticalAxis`, default lying), its diameter the enclosing
 * circle and radial oversize rounded up, its length the grip, the part and the front oversize
 * rounded up, the grip at its base (`StockCylinder::relative`). A fixed cylinder stands along the
 * direction, placed along it by its position (`StockCylinder::fixed`).
 */
export const stockPlacement = (
  stock: StockOption,
  first: PlanDirection | null,
  part: ModelBox,
): { box: ModelBox } | { cylinder: ModelCylinder } | null => {
  if (stock.mode === 'fixedBox') {
    const box = fixedBoxPlacement(stock, first, part)
    return box && { box }
  }
  const frame = stockFrame(first, part)
  if (!frame) {
    return null
  }
  if (stock.mode === 'fixedCylinder') {
    return { cylinder: placeFixedCylinder(stock, frame, part) }
  }
  if (stock.mode === 'automaticFlatBar') {
    return { box: placeFlatBar(stock, frame, part) }
  }
  return { cylinder: placeRoundStock(stock, frame, part) }
}

type StockOf<M extends StockOption['mode']> = Extract<StockOption, { mode: M }>

/** A fixed cylinder standing along the direction, placed along it by its position. */
const placeFixedCylinder = (
  stock: StockOf<'fixedCylinder'>,
  frame: StockFrame,
  part: ModelBox,
): ModelCylinder => {
  const { diameter, length, position, positionOffset = 0 } = stock
  return placeCylinder(frame, part, 'z', diameter, length, (span) =>
    stockStart(position, positionOffset, span, length),
  )
}

/** Flat Bar: the part's extent plus its oversizes, rounded up, the grip kept exact below it. */
const placeFlatBar = (
  stock: StockOf<'automaticFlatBar'>,
  frame: StockFrame,
  part: ModelBox,
): ModelBox => {
  const extent = (k: ModelAxis) => extentAlong(part, frame[k])
  const { oversizeX, oversizeY, oversizeZTop, oversizeZBottom, snapX, snapY, snapZ } = {
    ...defaultStock(stock.mode),
    ...stock,
  } as Required<typeof stock>
  const size = {
    x: snapUp(extent('x') + 2 * oversizeX, snapX),
    y: snapUp(extent('y') + 2 * oversizeY, snapY),
    z: snapUp(extent('z') + oversizeZTop + oversizeZBottom, snapZ),
  }
  return placeBlock(frame, part, size, 'offsetFromBottom', oversizeZBottom)
}

/** Round Stock: lying along the part's longer side across the direction, or standing along it. */
const placeRoundStock = (
  stock: StockOf<'automaticRoundStock'>,
  frame: StockFrame,
  part: ModelBox,
): ModelCylinder => {
  const extent = (k: ModelAxis) => extentAlong(part, frame[k])
  // An omitted `verticalAxis` is the kernel's default, lying down — not the new profile's default.
  const { radialOversize, axialOversize, gripStock, diaRoundToNearest, lengthRoundToNearest } = {
    ...defaultStock(stock.mode),
    ...stock,
  } as Required<typeof stock>
  const along = stock.verticalAxis ? 'z' : 'x'
  const [a, b] = across(along)
  const diameter = snapUp(Math.hypot(extent(a), extent(b)) + 2 * radialOversize, diaRoundToNearest)
  const length = snapUp(gripStock + extent(along) + axialOversize, lengthRoundToNearest)
  return placeCylinder(frame, part, along, diameter, length, ([low]) => low - gripStock)
}

/** What a fixed box held for Apply comes to (`fixedBoxCheck`). */
export type FixedBoxCheck =
  /** Apply waits on it: `problem` is said beside the stock, `applyReason` on Apply. */
  | { problem: string; applyReason: string }
  /** Said beside the stock; Apply does not wait on it. */
  | { note: string }

/**
 * A fixed box against the first folder and the part, as Apply would send it: why it can't be sent
 * (`stockRequest`), else how far the part stands outside it — the most along any one axis — else
 * that Toolpath turns it. Null for any other stock, or a box with nothing to say. The part's size is
 * its model box (`length`, `width` and `height` along X, Y and Z); unknown, the fit is not checked.
 */
export const fixedBoxCheck = (
  stock: StockOption | null,
  first: PlanDirection | null,
  size: { length: number; width: number; height: number } | null,
  units: Units,
): FixedBoxCheck | null => {
  if (stock?.mode !== 'fixedBox') {
    return null
  }
  const request = stockRequest(stock, first)
  if (typeof request === 'string') {
    return unsendableBox(request)
  }
  if (!size) {
    return null
  }
  const part = { min: { x: 0, y: 0, z: 0 }, max: { x: size.length, y: size.width, z: size.height } }
  const box = fixedBoxPlacement(stock, first, part)
  if (!box) {
    return null
  }
  return partOutsideBox(box, part, units) ?? turnedBox(box)
}

/** Why `stockRequest` refused the box, beside it and on Apply. */
const unsendableBox = (request: string): FixedBoxCheck => ({
  problem: request,
  applyReason: request === BOX_ENVELOPE ? FIX_STOCK_FIRST : request,
})

/** How far the part stands outside the box, along the axis it stands furthest; null within it. */
const partOutsideBox = (box: ModelBox, part: ModelBox, units: Units): FixedBoxCheck | null => {
  const worst = furthestOutside(box, part)
  if (worst && worst.by > FIT_TOLERANCE_MM) {
    return {
      problem: `The part stands ${formatLength(worst.by, units)} outside the box along ${worst.axis.toUpperCase()}.`,
      applyReason: FIX_STOCK_FIRST,
    }
  }
  return null
}

/** The axis the part stands furthest outside the box along, and by how much (negative within). */
const furthestOutside = (
  box: ModelBox,
  part: ModelBox,
): { axis: ModelAxis; by: number } | undefined => {
  const [worst] = AXES.map((axis) => ({
    axis,
    by: Math.max(box.min[axis] - part.min[axis], part.max[axis] - box.max[axis]),
  })).sort((p, q) => q.by - p.by)
  return worst
}

/** A note where Toolpath turns the box from how it was entered; null where it doesn't. */
const turnedBox = (box: { turned: boolean }): FixedBoxCheck | null =>
  box.turned
    ? {
        note: 'Toolpath turns the box a quarter turn about the first folder’s direction, to lay its longer side along the part’s.',
      }
    : null
