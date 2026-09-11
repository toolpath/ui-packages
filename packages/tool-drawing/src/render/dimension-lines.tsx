import type { Frame, Padding } from '../model/frame.js'
import { radiusAt, type Outline } from '../model/outline.js'
import { AWAY_FROM_TIP, TOWARD_MINUS, TOWARD_PLUS, TOWARD_TIP, arrowhead } from './arrows.js'
import {
  laneOffset,
  type DimensionLane,
  type LaneLayout,
  type LaneRoom,
  type Side,
  type ToolDimensions,
} from '../model/dimensions.js'

/**
 * Dimensions, drawn the way a drawing draws them — and lettered nowhere.
 *
 * **The numbers came off the sheet** (Paul, 2026-09-02). They were six
 * two-line figures in the margin of a panel that carries the same six numbers
 * in a table an inch away, and the whole of the margin machinery — bands,
 * leaders, opaque backing boxes, a stacker that moved a figure away from the
 * tip until it covered nothing — existed to fit type that did not need to be
 * there. What is drawn now is the linework: extension lines, dimension lines,
 * arrowheads, and the point angle's own two flanks.
 *
 * **Which line is which is answered by pointing at it.** The reader hovers a
 * number in the consumer's table and the line for it lights in the sheet's
 * accent; hovering a line reports its code back, so the table can light the
 * number. Both directions key on the ISO 13399 code — `DC`, `LCF`, `OAL`,
 * `SFDM`, `LBH` — which the drawing and the table already had in common.
 *
 * **A width is dimensioned from outside.** A line drawn across a ⌀6 shank at
 * this scale is a line drawn *over the tool*, so the two arrows stand outside
 * the silhouette and point inward at the faces they measure, which is what a
 * drawing does with a dimension too narrow to hold them.
 *
 * ## Everything is placed in millimetres, and mapped last
 *
 * This took a screen-space frame — an `x(r)` and a `y(z)` — which is the same
 * thing as assuming the tool stands upright. Every placement here is in the
 * outline's own space, radius and height, and reaches the sheet only through
 * `toX`/`toY`. Arrowheads are built from a direction in that space rather than
 * from `'up' | 'down' | 'left' | 'right'`.
 */

export interface DimensionLinesProps {
  readonly model: ToolDimensions
  readonly layout: LaneLayout
  readonly frame: Frame
  /**
   * The whole stack, not just its extent: an extension line starts at the
   * solid it measures, and only the segments say where that is at a height.
   */
  readonly outline: Outline
  readonly room: LaneRoom
  /**
   * The chrome that was asked for, in pixels.
   *
   * The frame may have granted less — it caps chrome so annotation cannot
   * starve the drawing — and everything here is placed in the margin the frame
   * actually gave, scaled back in the same proportion. Drawn at the full
   * request against a capped margin, the outermost lines hang off the sheet.
   */
  readonly requested: Padding
  readonly ink: string
  /** What a highlighted dimension is drawn in. */
  readonly accent: string
  /** The codes to draw in the accent. Empty is the ordinary drawing. */
  readonly highlight: ReadonlySet<string>
  /** Told the code under the pointer, and `null` when it leaves. */
  readonly onHover?: (code: string | null) => void
}

/**
 * How much heavier a highlighted line is drawn.
 *
 * Colour alone is not the highlight: a reader who cannot tell the accent from
 * the ink still sees which line thickened, and a thin line in a new colour is
 * easy to miss on a busy sheet either way.
 */
const LIT_WEIGHT = 1.8

export const DimensionLines = ({
  model,
  layout,
  frame,
  outline,
  room,
  requested,
  ink,
  accent,
  highlight,
  onHover,
}: DimensionLinesProps) => {
  const { fontSize, scale } = frame
  const head = fontSize * 0.9

  /** A length in pixels, as the millimetres the drawing is drawn in. */
  const mm = (pixels: number) => pixels / scale
  const sign = (side: Side) => (side === 'minus' ? -1 : 1)
  /** How much of what this flank asked for it actually got. */
  const granted = (side: Side) => {
    const asked = side === 'minus' ? requested.minus : requested.plus
    const got = side === 'minus' ? frame.padding.minus : frame.padding.plus
    return asked > 0 ? got / asked : 1
  }
  const at = (r: number, z: number) => `${frame.toX(r, z).toFixed(2)},${frame.toY(r, z).toFixed(2)}`

  /**
   * Where an extension line starts: a little clear of the solid at that
   * height, on the flank the line runs up.
   *
   * **The solid at that height, not the widest thing drawn.** `outline.radius`
   * is the flange on an assembly with a holder, twenty millimetres out from
   * the shank being measured, and a line drawn from there starts in the margin
   * and points at nothing (Paul, 2026-09-02).
   */
  const clearance = fontSize * 0.35
  const edgeAt = (side: Side, z: number) => sign(side) * (radiusAt(outline, z) + clearance)
  /** Where a lane's line runs, as a signed radius. */
  const laneAt = (lane: DimensionLane) =>
    sign(lane.side) * (outline.radius + mm(laneOffset(lane.lane, room) * granted(lane.side)))

  /**
   * How far a width's arrows stand off the faces they measure.
   *
   * Clamped to the room the ladder actually left them. A width is dimensioned
   * from outside, and out at the silhouette's own edge — the tool alone — the
   * lanes reserve a full arrow's length for exactly that. With a holder the
   * width being measured is a ⌀3 shank inside a ⌀46 flange, the arrows come
   * nowhere near the edge, and the lanes reserve nothing for them; this is
   * what keeps them short of the innermost line in the case between.
   */
  const standFor = (radius: number) =>
    Math.max(head * 0.9, Math.min(head * 2.4, outline.radius - radius + mm(laneOffset(0, room))))

  const laneOf = new Map(layout.lanes.map((each) => [each.code, each]))

  /**
   * The codes drawn in the accent, with a line's other names folded in.
   *
   * A length can answer to more than one code — the stickout and the
   * below-holder length are one line where they are one number — so a table
   * lighting either name lights it.
   */
  const litCodes = new Set([
    ...highlight,
    ...model.lengths
      .filter((each) => (each.aliases ?? []).some((code) => highlight.has(code)))
      .map((each) => each.code),
  ])
  const lit = (code: string) => litCodes.has(code)
  const inkFor = (code: string) => (lit(code) ? accent : ink)
  const weightFor = (code: string, weight: number) =>
    fontSize * weight * (lit(code) ? LIT_WEIGHT : 1)
  const fadeFor = (code: string, opacity: number) => (lit(code) ? 1 : opacity)

  /**
   * What a group carries so it can be pointed at.
   *
   * Handlers only where the consumer wants them: a drawing nobody is pointing
   * at should not put a cursor or a hit target on a line.
   */
  const pointing = (code: string) =>
    onHover === undefined
      ? {}
      : {
          onPointerEnter: () => {
            onHover(code)
          },
          onPointerLeave: () => {
            onHover(null)
          },
          style: { cursor: 'pointer' },
        }

  /**
   * A line's hit target: the same run, drawn wide and in nothing.
   *
   * A dimension line is a fraction of a millimetre of ink and no pointer finds
   * it. This is that line at type width, invisible, and only present when
   * somebody is listening.
   */
  const hit = fontSize * 1.3
  const grab = (points: string) =>
    onHover === undefined ? null : (
      <polyline
        points={points}
        fill="none"
        stroke="transparent"
        strokeWidth={hit}
        strokeLinecap="round"
      />
    )

  /** Highlighted last, so an accented line is never drawn under a plain one. */
  const byLight = <T extends { code: string }>(each: ReadonlyArray<T>): Array<T> =>
    [...each].sort((one, two) => Number(lit(one.code)) - Number(lit(two.code)))

  return (
    <g data-dimensions>
      {byLight(model.lengths).map((each) => {
        const place = laneOf.get(each.code)
        if (place === undefined) {
          return null
        }
        const lane = laneAt(place)
        const edge = { from: edgeAt(place.side, each.from), to: edgeAt(place.side, each.to) }
        /**
         * Closer together than the arrows are long, they meet nose to nose —
         * so they go outside the line and point back in, which is what a
         * drawing does with a dimension too short to hold them.
         */
        const inside = Math.abs(each.to - each.from) >= head * 2.6
        const reach = head * 2.2
        const from = inside ? each.from : each.from - reach
        const to = inside ? each.to : each.to + reach
        return (
          <g
            key={each.code}
            data-dimension={each.code}
            {...(lit(each.code) ? { 'data-lit': 'true' } : {})}
            {...pointing(each.code)}
          >
            {grab(`${at(lane, from)} ${at(lane, to)}`)}
            <line
              x1={frame.toX(lane, each.from)}
              y1={frame.toY(lane, each.from)}
              x2={frame.toX(edge.from, each.from)}
              y2={frame.toY(edge.from, each.from)}
              stroke={inkFor(each.code)}
              strokeOpacity={fadeFor(each.code, 0.4)}
              strokeWidth={weightFor(each.code, 0.05)}
            />
            <line
              x1={frame.toX(lane, each.to)}
              y1={frame.toY(lane, each.to)}
              x2={frame.toX(edge.to, each.to)}
              y2={frame.toY(edge.to, each.to)}
              stroke={inkFor(each.code)}
              strokeOpacity={fadeFor(each.code, 0.4)}
              strokeWidth={weightFor(each.code, 0.05)}
            />
            <line
              x1={frame.toX(lane, from)}
              y1={frame.toY(lane, from)}
              x2={frame.toX(lane, to)}
              y2={frame.toY(lane, to)}
              stroke={inkFor(each.code)}
              strokeWidth={weightFor(each.code, 0.07)}
            />
            <polygon
              points={arrowhead(lane, each.from, inside ? TOWARD_TIP : AWAY_FROM_TIP, head, frame)}
              fill={inkFor(each.code)}
            />
            <polygon
              points={arrowhead(lane, each.to, inside ? AWAY_FROM_TIP : TOWARD_TIP, head, frame)}
              fill={inkFor(each.code)}
            />
          </g>
        )
      })}

      {/*
        A width, dimensioned from outside: two barbs standing off the faces
        they measure, pointing in. Nothing is drawn across the tool.
      */}
      {byLight(model.widths).map((each) => {
        const stand = standFor(each.radius)
        return (
          <g
            key={each.code}
            data-dimension={each.code}
            {...(lit(each.code) ? { 'data-lit': 'true' } : {})}
            {...pointing(each.code)}
          >
            {grab(`${at(-each.radius - stand, each.at)} ${at(-each.radius, each.at)}`)}
            {grab(`${at(each.radius, each.at)} ${at(each.radius + stand, each.at)}`)}
            <line
              x1={frame.toX(-each.radius - stand, each.at)}
              y1={frame.toY(-each.radius - stand, each.at)}
              x2={frame.toX(-each.radius, each.at)}
              y2={frame.toY(-each.radius, each.at)}
              stroke={inkFor(each.code)}
              strokeWidth={weightFor(each.code, 0.07)}
            />
            <polygon
              points={arrowhead(-each.radius, each.at, TOWARD_PLUS, head, frame)}
              fill={inkFor(each.code)}
            />
            <line
              x1={frame.toX(each.radius, each.at)}
              y1={frame.toY(each.radius, each.at)}
              x2={frame.toX(each.radius + stand, each.at)}
              y2={frame.toY(each.radius + stand, each.at)}
              stroke={inkFor(each.code)}
              strokeWidth={weightFor(each.code, 0.07)}
            />
            <polygon
              points={arrowhead(each.radius, each.at, TOWARD_MINUS, head, frame)}
              fill={inkFor(each.code)}
            />
          </g>
        )
      })}

      {/*
        The point angle: the cone's own two flanks, run out past the tool, and
        an arc between them.

        **The flanks are extended rather than lettered** (Paul, 2026-09-02,
        with the figures gone). On a ⌀1 drill the cone is three tenths of a
        millimetre tall, so an arc struck inside it would be invisible; run the
        faces out to a readable length first and the same angle is drawn at a
        size that can be seen, which is what a sheet does with a small angle.
      */}
      {byLight(model.angles).map((each) => {
        const half = ((each.degrees / 2) * Math.PI) / 180
        // The cone's own flank, from `at` — which sits halfway up it.
        const flank = Math.hypot(each.at.r * 2, each.at.z * 2)
        const reach = Math.max(flank * 1.5, head * 3)
        const ray = (towards: number) => ({
          r: towards * reach * Math.sin(half),
          z: reach * Math.cos(half),
        })
        const minus = ray(-1)
        const plus = ray(1)
        // Sampled rather than struck as an SVG arc: a sweep flag has to know
        // which way the frame laid the tool, and a polyline does not.
        const radius = reach * 0.62
        const arc = Array.from({ length: 17 }, (_, index) => {
          const angle = -half + (2 * half * index) / 16
          return at(radius * Math.sin(angle), radius * Math.cos(angle))
        }).join(' ')
        return (
          <g
            key={each.code}
            data-dimension={each.code}
            {...(lit(each.code) ? { 'data-lit': 'true' } : {})}
            {...pointing(each.code)}
          >
            {grab(arc)}
            {grab(`${at(minus.r, minus.z)} ${at(0, 0)} ${at(plus.r, plus.z)}`)}
            <polyline
              points={`${at(minus.r, minus.z)} ${at(0, 0)} ${at(plus.r, plus.z)}`}
              fill="none"
              stroke={inkFor(each.code)}
              strokeOpacity={fadeFor(each.code, 0.5)}
              strokeWidth={weightFor(each.code, 0.05)}
            />
            <polyline
              points={arc}
              fill="none"
              stroke={inkFor(each.code)}
              strokeWidth={weightFor(each.code, 0.07)}
            />
            {/* Along the arc at each end, the way an angle's arrows run. */}
            <polygon
              points={arrowhead(
                radius * Math.sin(-half),
                radius * Math.cos(half),
                { dr: -Math.cos(half), dz: -Math.sin(half) },
                head * 0.8,
                frame,
              )}
              fill={inkFor(each.code)}
            />
            <polygon
              points={arrowhead(
                radius * Math.sin(half),
                radius * Math.cos(half),
                { dr: Math.cos(half), dz: -Math.sin(half) },
                head * 0.8,
                frame,
              )}
              fill={inkFor(each.code)}
            />
          </g>
        )
      })}
    </g>
  )
}
