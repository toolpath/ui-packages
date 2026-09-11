/**
 * Stage 2 of the drawing: where the millimetres land on the sheet.
 *
 * Pure arithmetic over a content extent and a measured box. No React, no DOM,
 * no SVG — {@link frameFor} returns numbers and two mapping functions, and the
 * renderer does nothing but place things with them.
 *
 * ## The inversion
 *
 * **The frame is content plus margins, and the scale absorbs the panel's
 * shape.** Never the other way round. The component this replaces derived the
 * *frame* from the panel's aspect ratio while pinning the scale to the tool's
 * length, so a ⌀1 drill 58 mm long got a 312 mm-wide sheet and then had
 * `preserveAspectRatio` shrink it to fit — about 85% of the panel rendered
 * empty. Here `scale` is the smaller of the two px-per-mm ratios that fit the
 * content in the box, and the viewBox describes the content and its margins.
 * A wide panel now buys a bigger drawing rather than a wider sheet.
 *
 * ## The contract with the renderer
 *
 * The `<svg>` must carry `preserveAspectRatio="xMidYMid meet"`, which is the
 * default. That is not decoration: `meet` fits the viewBox by the smaller of
 * its own two ratios, and the algebra below chooses `scale` so that the
 * binding ratio is exactly `scale`. The reported number and the rendered
 * number are then the same, which is what lets {@link Frame.fontSize} be
 * trusted. Under `preserveAspectRatio="none"` the drawing would stretch and
 * `scale` would be a lie on one axis.
 *
 * ## Orientation
 *
 * {@link Frame.toX} and {@link Frame.toY} are the **only** things in this
 * package that know which way the tool axis runs. Everything downstream — the
 * silhouette, the joins, the centreline, the dimensions, the clearance overlay
 * — is written once against them and is orientation-agnostic. Orientation
 * being baked into a pair of closures inside the render pass, and assumed by
 * every renderer below them, is the reason the old component could not be
 * patched into shape.
 */

/** What framing needs from an outline: how far it reaches, in millimetres. */
export interface Extent {
  /** The tallest point drawn, above the tip. */
  readonly height: number
  /** The widest radius drawn. The drawing is mirrored, so it spans twice this. */
  readonly radius: number
}

/** A measured panel, in CSS pixels. Zero on the server and before first paint. */
export interface Box {
  readonly width: number
  readonly height: number
}

export type Orientation = 'vertical' | 'horizontal'

export interface Frame {
  readonly orientation: Orientation
  /** Pixels per millimetre, as the drawing will actually render. */
  readonly scale: number
  /** `minX minY width height`, in millimetres: the content and its margins. */
  readonly viewBox: string
  /** A point's horizontal place in viewBox coordinates, from radius and height. */
  readonly toX: (r: number, z: number) => number
  /** A point's vertical place in viewBox coordinates, from radius and height. */
  readonly toY: (r: number, z: number) => number
  /** Type size in **millimetres**, back-derived from a target in pixels. */
  readonly fontSize: number
  /**
   * The chrome actually applied, in pixels — what was asked for, or less.
   *
   * The frame reports what it did with the request, the way it reports the
   * scale it settled on. A caller placing something in the margin has to place
   * it against the room the margin really has: ask for more than
   * {@link MOST_OF_A_PANEL} and the request is scaled back rather than
   * granted, and anything drawn at the full request would then hang off the
   * sheet.
   */
  readonly padding: Padding
}

/**
 * Room for chrome around the content, in **pixels**, flank by flank.
 *
 * **Pixels rather than millimetres because it is chrome**: it should not grow
 * because the tool is long, and it has to stay independent of `scale` or the
 * arithmetic closes a loop — more padding shrinks the scale, which changes the
 * type size, which changes the band widths, which changes the padding.
 *
 * **Named by flank rather than by side of the screen.** `minus` is the `-r`
 * flank and `plus` the `+r` flank; which of them is the screen's left, right,
 * top or bottom is `toX`/`toY`'s business and nothing else's.
 *
 * A plain number is the same room on every side, and that is what a drawing
 * with no dimensions on it wants.
 */
export interface Padding {
  /** Outside the `-r` flank. */
  readonly minus: number
  /** Outside the `+r` flank. */
  readonly plus: number
  /** Past each end of the tool, along its axis. */
  readonly along: number
}

export interface FrameOptions {
  /**
   * Room for chrome around the content, in **pixels** — dimension bands, the
   * arrowheads, the figures.
   *
   * **Widened from a plain number in phase 4, deliberately.** The dimension
   * bands are genuinely asymmetric: with figures on both flanks each side
   * needs as much room as its own bands take, and those differ. Forcing that
   * through one scalar would mean padding both flanks by the wider of the two
   * and throwing away the difference — real drawing area, on the axis where a
   * long thin tool has least of it. A number still means what it always did.
   */
  readonly padding?: number | Partial<Padding>
  /**
   * The box to frame against before the panel has been measured. A
   * `ResizeObserver` reports nothing on the server or on first paint, and
   * framing against a zero box would paint at the stack's own width and then
   * visibly jump. This is a plain landscape sheet instead.
   */
  readonly defaultBox?: Box
}

const DEFAULT_PADDING = 16

const DEFAULT_BOX: Box = { width: 640, height: 240 }

/**
 * Type size as a fraction of the panel's short side, held to a readable range.
 *
 * **This is the whole of the fix for defect 2.** The old component sized type
 * as `Math.max(1.5, height * 0.018)` — millimetres of *tool* — so a 58 mm
 * drill got about 1 mm of model space, roughly four pixels once rendered, and
 * every dimension on every screenshot was illegible. Type size is a property
 * of the drawing's size on screen and of nothing else; the millimetre figure
 * is derived from it at the end by dividing by `scale`, never the reverse.
 */
const TYPE_FRACTION = 0.045
const TYPE_MIN_PX = 9
const TYPE_MAX_PX = 14

/**
 * The most of one axis that chrome may take, leaving the rest for the drawing.
 *
 * Without a cap a margin can starve the content completely: five dimension
 * figures on both flanks of a tool in a narrow panel asked for 429 px of a
 * 400 px axis, `px - chrome` went negative, and the scale fell to a fortieth
 * of a pixel per millimetre — a viewBox twelve metres across, with figures a
 * metre tall stacked off the sheet. The drawing is the point; the annotation
 * around it gives way first.
 */
const MOST_OF_A_PANEL = 0.6

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high)

/** Two chrome measures scaled back together until they fit their axis. */
const fitted = (low: number, high: number, axis: number): [number, number] => {
  const total = low + high
  const most = axis * MOST_OF_A_PANEL
  return total <= most || total <= 0 ? [low, high] : [(low * most) / total, (high * most) / total]
}

/** Trimmed so a viewBox reads as a measurement rather than as float noise. */
const round = (value: number): number => Math.round(value * 1e4) / 1e4

/**
 * Where a drawing of `outline` sits in `box`.
 *
 * Takes the whole assembly as its framing — there is no cutter-only option, and
 * that is deliberate. The cost is accepted and known: a slot mill's 0.38 mm
 * cutting disc on a 38 mm tool is about one pixel at any honest whole-assembly
 * scale, and no arithmetic here rescues it.
 */
/**
 * The box to frame against: a panel with no area has not been measured — the
 * server, or the paint before the observer fires — rather than being a panel
 * of no size.
 */
const boxFor = (box: Box, options: FrameOptions): Box =>
  box.width > 0 && box.height > 0 ? box : (options.defaultBox ?? DEFAULT_BOX)

/**
 * The type size a drawing in this box is set in, in **pixels**.
 *
 * Exported because the dimension model has to know it before there is a frame:
 * its band widths are measured in type, the frame's padding is the total of
 * those bands, and a frame cannot be built until the padding is known. It
 * depends only on the panel, so there is no circle to close.
 */
export const typeSizeFor = (box: Box, options: FrameOptions = {}): number => {
  const measured = boxFor(box, options)
  return clamp(Math.min(measured.width, measured.height) * TYPE_FRACTION, TYPE_MIN_PX, TYPE_MAX_PX)
}

/**
 * Which way the tool axis runs in this box: along its long side.
 *
 * Exported for the same reason as {@link typeSizeFor} — the dimension model
 * has to size its bands before there is a frame, and one of its measures
 * depends on which way the type runs relative to the axis. It reads the panel
 * only, so there is no circle to close.
 */
export const orientationFor = (box: Box, options: FrameOptions = {}): Orientation => {
  const measured = boxFor(box, options)
  return measured.width >= measured.height ? 'horizontal' : 'vertical'
}

export const frameFor = (outline: Extent, box: Box, options: FrameOptions = {}): Frame => {
  const given = options.padding ?? DEFAULT_PADDING
  const pad: Padding =
    typeof given === 'number'
      ? { minus: given, plus: given, along: given }
      : {
          minus: given.minus ?? DEFAULT_PADDING,
          plus: given.plus ?? DEFAULT_PADDING,
          along: given.along ?? DEFAULT_PADDING,
        }
  const measured = boxFor(box, options)

  // Along the box's long axis, because that is where the length of a tool has
  // room to go. A square box is drawn along its width; the tie has to break
  // somewhere and reading order is as good a reason as any.
  const orientation = orientationFor(box, options)

  const alongPx = orientation === 'horizontal' ? measured.width : measured.height
  const acrossPx = orientation === 'horizontal' ? measured.height : measured.width
  const alongMm = outline.height
  const acrossMm = outline.radius * 2

  // Scaled back where it would starve the drawing, and reported as applied.
  const [minus, plus] = fitted(pad.minus, pad.plus, acrossPx)
  const [ends] = fitted(pad.along, pad.along, alongPx)
  const padding: Padding = { minus, plus, along: ends }

  // The smaller of the two ratios that fit the content, ignoring an axis the
  // content has no extent on. Nothing to fit at all is drawn at life size.
  const room = (px: number, chrome: number) => Math.max(1, px - chrome)
  const ratios = [
    room(alongPx, padding.along * 2) / alongMm,
    room(acrossPx, padding.minus + padding.plus) / acrossMm,
  ].filter((ratio) => Number.isFinite(ratio) && ratio > 0)
  const scale = ratios.length > 0 ? Math.min(...ratios) : 1

  const endMargin = padding.along / scale
  const minusMargin = padding.minus / scale
  const plusMargin = padding.plus / scale
  const along = alongMm + endMargin * 2
  const across = acrossMm + minusMargin + plusMargin

  const viewBox =
    orientation === 'horizontal'
      ? [-endMargin, -outline.radius - minusMargin, along, across]
      : [-outline.radius - minusMargin, -endMargin, across, along]

  const fontSize = typeSizeFor(box, options) / scale

  return {
    orientation,
    scale,
    viewBox: viewBox.map(round).join(' '),
    padding,
    // The tip sits at the origin. Horizontal runs it left to right, so the
    // business end is where reading starts; vertical runs it bottom to top, so
    // the tool hangs from its holder the way it does in the spindle.
    toX: orientation === 'horizontal' ? (_r, z) => z : (r) => r,
    toY: orientation === 'horizontal' ? (r) => r : (_r, z) => outline.height - z,
    fontSize,
  }
}
