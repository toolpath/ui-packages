import { useId } from 'react'
import { useDrawingContext } from '../../render/drawing-context.js'
import type { Extent, Frame } from '../../model/frame.js'
import type { OutlinePoint } from '../../model/outline.js'
import {
  AWAY_FROM_TIP,
  TOWARD_MINUS,
  TOWARD_PLUS,
  TOWARD_TIP,
  arrowhead,
} from '../../render/arrows.js'
import type { Sheet } from '../../render/sheet.js'
import { NO_MARGINS, type Margins } from '../model/curve.js'
import type { Gaps } from '../model/gaps.js'
import { clipped, lastRise, polyline, wallCorners, wallPath, zigzag } from '../model/wall.js'

/**
 * The material the sweep read, drawn beside the tool, with the two clearances
 * that decided the verdict.
 *
 * **The verdict does not live here — only its drawing does.** Whether an
 * assembly clears a feature is the catalog's tool-selection question, answered
 * for a dozen callers that never draw anything; putting it behind a rendering
 * package would put that engine behind a dependency on React. So this takes
 * the answer as data — the material profile, the collisions, the two tightest
 * gaps — and owns every line drawn from it.
 *
 * **The part is always secondary to the assembly** (Paul, 2026-08-30). The
 * stack sets the frame and the scale; the material is drawn in the room left
 * beside it and cut off at a **break** — the saw-tooth of an interrupted view
 * — rather than pushing the stack smaller to fit a wall in. A dimension whose
 * far face falls past the break is broken too, and carries the true number.
 * The material is **hatched**, because it is a section through metal and
 * nothing on the stack is.
 */
export interface ClearanceOverlayProps {
  /**
   * The material around the feature, as a staircase in the drawing's own
   * space: radius from the axis, height above the tip.
   *
   * Taken rather than derived, because whatever turns a reach curve into this
   * staircase has drawing consumers of its own and stays with them.
   */
  readonly profile: ReadonlyArray<OutlinePoint>
  /**
   * The frame, the extent and the ink.
   *
   * All three are taken from the surrounding `<ToolDrawing>` and are only worth
   * passing to override it — framing a fixture in a test, or composing a
   * drawing by hand. A consumer drawing an overlay the ordinary way, as a child,
   * supplies none of them: it cannot, because the panel is measured inside the
   * component it is a child of.
   */
  readonly frame?: Frame
  readonly outline?: Extent
  /** Where the cut is: the radius the material is measured out from. */
  readonly cuttingRadius: number
  /** The two tightest points, each measured at its own. */
  readonly gaps: Gaps
  /** Room the shop wants kept, drawn as a dashed line outside the wall. */
  readonly margins?: Margins
  readonly sheet?: Sheet
  /** How a length is written out, for the two readouts. */
  readonly formatLength: (millimetres: number) => string
}

/** The colours a clearance reads in: it passed, or it did not. */
const PASS = '#6ee7b7'
const FAIL = '#f87171'

export const ClearanceOverlay = ({
  profile,
  frame: framed,
  outline: extent,
  cuttingRadius,
  gaps,
  margins = NO_MARGINS,
  sheet: ink,
  formatLength,
}: ClearanceOverlayProps) => {
  const hatchId = `hatch-${useId().replace(/:/g, '')}`
  const drawing = useDrawingContext()
  const frame = framed ?? drawing?.frame
  const outline = extent ?? drawing?.outline
  const sheet = ink ?? drawing?.sheet
  if (frame === undefined || outline === undefined || sheet === undefined) {
    throw new Error(
      'ClearanceOverlay needs a frame, an outline and a sheet: draw it inside <ToolDrawing>, or pass all three.',
    )
  }
  if (profile.length === 0) {
    return null
  }
  const { fontSize, scale } = frame
  const head = fontSize * 0.9
  const top = outline.height
  const noise = top * 0.0005
  const corners = wallCorners(profile, noise)
  const deciding = gaps.axial
  const sideways = gaps.radial

  /**
   * How far out the material would like to be drawn, and how far it gets.
   *
   * Out to the last rise — past it the staircase is a flat block that says
   * nothing new — and far enough to show the face a dimension measures to.
   * What it actually gets is the room the frame reserved on this flank, which
   * is the caller's to ask for.
   */
  const sheetEdge = outline.radius + frame.padding.plus / scale
  const wanted =
    corners.length === 0
      ? 0
      : Math.max(lastRise(corners), sideways ? sideways.r + sideways.gap : 0, cuttingRadius) + 2
  const wallEdge = Math.max(Math.min(wanted, sheetEdge - fontSize * 0.5), cuttingRadius + 1)
  const wall = clipped(corners, wallEdge, top)
  // Closely spaced across, and no rise the size of a wall: a sampled curve.
  const smooth = { run: (wallEdge - cuttingRadius) * 0.06, rise: top * 0.06 }
  const room =
    margins.radial > 0 || margins.axial > 0
      ? clipped(
          wallCorners(
            profile.map((point) => ({
              r: Math.max(cuttingRadius, point.r - margins.radial),
              z: point.z + margins.axial,
            })),
            noise,
          ),
          wallEdge,
          top,
        )
      : null
  // The outer edge of the material is always a break: past the last knot it
  // carries on at that height, and the drawing does not.
  const outerBreak = zigzag(wallEdge, wall[wall.length - 1]?.z ?? 0, 0, fontSize * 0.3)
  const wallAtCut = Math.min(profile[1]?.z ?? 0, top)
  const hatch = fontSize * 0.85

  /** A readout: the number, on its own ground so the lines behind it do not read through. */
  const readout = (key: string, r: number, z: number, text: string, tone: string) => {
    const width = (text.length + 1) * fontSize * 0.6
    const one = { x: frame.toX(r, z), y: frame.toY(r, z) }
    const two = {
      x: frame.toX(r + width, z + fontSize * 1.45),
      y: frame.toY(r + width, z + fontSize * 1.45),
    }
    const box = {
      x: Math.min(one.x, two.x),
      y: Math.min(one.y, two.y),
      width: Math.abs(one.x - two.x),
      height: Math.abs(one.y - two.y),
    }
    return (
      <g key={key} data-readout={key}>
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx={fontSize * 0.2}
          fill={sheet.ground}
          fillOpacity={0.9}
        />
        <text
          x={box.x + box.width / 2}
          y={box.y + box.height / 2 + fontSize * 0.35}
          fontSize={fontSize}
          textAnchor="middle"
          fill={tone}
          fontFamily="ui-monospace, monospace"
        >
          {text}
        </text>
      </g>
    )
  }

  return (
    <g data-clearance>
      <defs>
        {/* Section hatching: the material is metal in section, and nothing on the stack is. */}
        <pattern
          id={hatchId}
          width={hatch}
          height={hatch}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={hatch} height={hatch} fill={sheet.ground} />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={hatch}
            stroke={sheet.dimension}
            strokeWidth={hatch * 0.09}
          />
        </pattern>
      </defs>

      <path
        data-part="material"
        d={`${wallPath(wall, smooth, frame)} ${outerBreak
          .map(
            (point) =>
              `L${frame.toX(point.r, point.z).toFixed(2)},${frame.toY(point.r, point.z).toFixed(2)}`,
          )
          .join(
            ' ',
          )} L${frame.toX(cuttingRadius, 0).toFixed(2)},${frame.toY(cuttingRadius, 0).toFixed(2)} Z`}
        fill={`url(#${hatchId})`}
        stroke="none"
      />
      {/* The surface the sweep read, solid: it is geometry. */}
      <path
        data-surface="material"
        d={wallPath(wall, smooth, frame)}
        fill="none"
        stroke={sheet.ink}
        strokeWidth={fontSize * 0.06}
        strokeLinejoin="round"
      />
      <line
        x1={frame.toX(cuttingRadius, 0)}
        y1={frame.toY(cuttingRadius, 0)}
        x2={frame.toX(wallEdge, 0)}
        y2={frame.toY(wallEdge, 0)}
        stroke={sheet.dimension}
        strokeWidth={fontSize * 0.05}
      />
      {/* The break: the material carries on past here, the drawing does not. */}
      <polyline
        data-break="material"
        points={polyline(outerBreak, frame)}
        fill="none"
        stroke={sheet.dimension}
        strokeWidth={fontSize * 0.05}
      />
      {/* The part's own wall at the cut, where the flutes are. */}
      <line
        data-wall="cut"
        x1={frame.toX(cuttingRadius, 0)}
        y1={frame.toY(cuttingRadius, 0)}
        x2={frame.toX(cuttingRadius, wallAtCut)}
        y2={frame.toY(cuttingRadius, wallAtCut)}
        stroke={sheet.centre}
        strokeWidth={fontSize * 0.08}
      />
      {room ? (
        <path
          data-part="room"
          d={wallPath(room, smooth, frame)}
          fill="none"
          stroke={sheet.dimension}
          strokeWidth={fontSize * 0.05}
          strokeLinejoin="round"
          strokeDasharray={`${(fontSize * 0.6).toFixed(2)} ${(fontSize * 0.4).toFixed(2)}`}
        />
      ) : null}

      {/*
        The two clearances, each dimensioned at its own tightest point. Up from
        the wall to the part above it, and sideways from a part to the wall
        face beside it — measured where the check measured, with the number the
        check used.
      */}
      {deciding
        ? (() => {
            const tone = deciding.clears ? PASS : FAIL
            const lane = deciding.r + fontSize * 1.6
            const low = Math.min(deciding.z, deciding.wall)
            const high = Math.max(deciding.z, deciding.wall)
            const inside = high - low >= head * 2.6
            const reach = head * 2.2
            const text = `${deciding.gap < 0 ? '−' : ''}${formatLength(Math.abs(deciding.gap))} up`
            return (
              <g data-clearance-dimension="axial">
                <line
                  x1={frame.toX(lane, inside ? low : low - reach)}
                  y1={frame.toY(lane, inside ? low : low - reach)}
                  x2={frame.toX(lane, inside ? high : high + reach)}
                  y2={frame.toY(lane, inside ? high : high + reach)}
                  stroke={tone}
                  strokeWidth={fontSize * 0.07}
                />
                <polygon
                  points={arrowhead(lane, low, inside ? TOWARD_TIP : AWAY_FROM_TIP, head, frame)}
                  fill={tone}
                />
                <polygon
                  points={arrowhead(lane, high, inside ? AWAY_FROM_TIP : TOWARD_TIP, head, frame)}
                  fill={tone}
                />
                {readout('axial', lane + fontSize * 0.5, (low + high) / 2, text, tone)}
              </g>
            )
          })()
        : null}

      {sideways
        ? (() => {
            const tone = sideways.clears ? PASS : FAIL
            const face = sideways.r + sideways.gap
            // A face past the break is not on the drawing: the dimension is
            // broken at the break and keeps the number the check used.
            const cutOff = face > wallEdge
            const to = Math.min(face, wallEdge)
            const inside = to - sideways.r >= head * 2.6
            const text = `${formatLength(sideways.gap)} across${cutOff ? ' ⟨' : ''}`
            return (
              <g data-clearance-dimension="radial" data-broken={cutOff ? 'true' : 'false'}>
                <line
                  x1={frame.toX(sideways.r, sideways.z)}
                  y1={frame.toY(sideways.r, sideways.z)}
                  x2={frame.toX(to, sideways.z)}
                  y2={frame.toY(to, sideways.z)}
                  stroke={tone}
                  strokeWidth={fontSize * 0.07}
                />
                <polygon
                  points={arrowhead(
                    sideways.r,
                    sideways.z,
                    inside ? TOWARD_MINUS : TOWARD_PLUS,
                    head,
                    frame,
                  )}
                  fill={tone}
                />
                <polygon
                  points={arrowhead(
                    to,
                    sideways.z,
                    inside ? TOWARD_PLUS : TOWARD_MINUS,
                    head,
                    frame,
                  )}
                  fill={tone}
                />
                {readout('radial', sideways.r, sideways.z + fontSize * 0.4, text, tone)}
              </g>
            )
          })()
        : null}
    </g>
  )
}
