import { Html, Line } from '@react-three/drei'
import { type CSSProperties, useMemo } from 'react'
import type { Vector3 } from 'three'
import { cssColor } from './measure-hint.js'
import { MEASURE_LABEL_CLASS, type MeasureLabelKind } from './measure-labels.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import type { HoleIndex, SurfaceFor } from './render/face-measure.js'
import { MEASURE_LINE_PIXELS, MEASURE_RENDER_ORDER } from './render/measure.js'
import { measureReadout, type MeasureGroup, type MeasureReadout } from './render/measure-picks.js'

const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

/**
 * Each measurement's own colour, for its faces, its lines and its label's
 * border, so that measurements kept side by side with Shift can be told
 * apart. The first is the selection blue; after the fourth they come round
 * again. Chosen clear of the usual rule colours (red, orange, yellow,
 * purple, green, cyan) and of the hover tints, so a measured face does not
 * read as a flag or as a hover.
 */
const MEASURE_COLORS = [0x2563eb, 0xc026d3, 0x0f766e, 0x4d7c0f] as const

/** The colour of the measurement at `index` on screen. */
export const measureColor = (index: number): number =>
  MEASURE_COLORS[index % MEASURE_COLORS.length] ?? MEASURE_COLORS[0]

/** How many dashes an extension line is cut into, whatever its length. */
const DASHES = 24

/** A dash for the line, in the part's millimetres: sized to the line, so a long one does not read solid. */
const dashFor = (points: readonly Vector3[]): number => {
  const [first, last] = [points[0], points[points.length - 1]]
  return first && last ? Math.max(first.distanceTo(last) / (DASHES * 2), 1e-3) : 1
}

const ignoreRay = (): void => undefined

/** The size of a point picked, in CSS pixels, and of the white ring round it. */
const MARKER_STYLE: CSSProperties = {
  width: '10px',
  height: '10px',
  boxSizing: 'border-box',
  border: '2px solid #fff',
  borderRadius: '9999px',
  boxShadow: '0 1px 3px rgb(0 0 0 / 30%)',
}

interface MeasurementsProps {
  groups: readonly MeasureGroup[]
  surfaceFor: SurfaceFor
  /** The part's holes, so a hole reads as a whole and with how many of it there are. */
  holes: HoleIndex
  format: (mm: number) => string
  /** Added to every label's class, beside {@link MEASURE_LABEL_CLASS}. */
  labelClass: string
}

/**
 * The picks measured, read out over the part (`measureReadout`): a hole's
 * diameter or a wall's radius, how two planes stand to one another, and the
 * distances between points, planes and holes' centre lines. Only picks
 * clicked are read out; `HoverEdge` and the hint show what a click would pick.
 *
 * Each measurement is in its own colour (`measureColor`), its label's border
 * too. Lines show through the part: a hole's diameter is often across the
 * far side of it. Deaf to the pointer and left out of framing.
 */
export const Measurements = ({
  groups,
  surfaceFor,
  holes,
  format,
  labelClass,
}: MeasurementsProps) => {
  const readouts = useMemo(
    () => groups.map((group) => measureReadout(group, surfaceFor, holes, format)),
    [groups, surfaceFor, format, holes],
  )
  return (
    <group userData={FURNITURE}>
      {readouts.map((readout, index) => (
        // By place: two measurements can hold the same picks, and each keeps its place's colour.
        <Readout
          key={index}
          readout={readout}
          color={measureColor(index)}
          labelClass={labelClass}
        />
      ))}
    </group>
  )
}

interface ReadoutProps {
  readout: MeasureReadout
  /** The measurement's colour, for its lines and its label's border. */
  color: number
  labelClass: string
}

const Readout = ({ readout, color, labelClass }: ReadoutProps) => {
  const flag = { '--measure-color': cssColor(color) } as CSSProperties
  return (
    <>
      {readout.lines.map((line, index) => (
        <Line
          key={`line:${index}`}
          points={line.points}
          color={line.color ?? color}
          lineWidth={line.dashed ? MEASURE_LINE_PIXELS.line / 2 : MEASURE_LINE_PIXELS.line}
          dashed={line.dashed}
          dashSize={dashFor(line.points)}
          gapSize={dashFor(line.points)}
          depthTest={false}
          renderOrder={MEASURE_RENDER_ORDER}
          raycast={ignoreRay}
        />
      ))}
      {readout.labels.map((label, index) => {
        const kind: MeasureLabelKind = label.axis ? 'delta' : 'face'
        return (
          <Html
            key={`label:${index}`}
            position={label.at}
            center
            zIndexRange={[20, 0]}
            pointerEvents="none"
          >
            <div
              className={labelClass}
              data-measure-label={kind}
              data-axis={label.axis}
              style={label.axis ? undefined : flag}
            >
              {/* What a click on the label copies. */}
              <span data-measure-value>{label.text}</span>
            </div>
          </Html>
        )
      })}
      {readout.markers.map((at, index) => (
        <PointMarker key={`marker:${index}`} at={at} color={color} />
      ))}
    </>
  )
}

/**
 * Set on the box drei wraps round a dot. Its `pointerEvents` prop does not
 * reach that box unless `transform` is set, and the box, the dot's size,
 * would take a click on the point from the part.
 */
const DEAF: CSSProperties = { pointerEvents: 'none' }

/** A point picked: a dot on screen, a set size however far off. */
const PointMarker = ({ at, color }: { at: Vector3; color: number }) => (
  <Html position={at} center zIndexRange={[20, 0]} style={DEAF}>
    <div style={{ ...MARKER_STYLE, backgroundColor: cssColor(color) }} />
  </Html>
)

/**
 * The edge an Alt point snaps to, or is the middle of, drawn bold and whole
 * while the pointer is on it. The ring and the caption are not drawn here,
 * but over the canvas (`measure-hint.ts`). Nothing here takes the pointer.
 */
export const HoverEdge = ({ points, color }: { points: readonly Vector3[]; color: number }) => {
  // Copied once per edge: a new array each draw would have `Line` build its geometry again.
  const along = useMemo(() => [...points], [points])
  return (
    <group userData={FURNITURE}>
      <Line
        points={along}
        color={color}
        lineWidth={MEASURE_LINE_PIXELS.edge}
        depthTest={false}
        renderOrder={MEASURE_RENDER_ORDER + 1}
        raycast={ignoreRay}
      />
    </group>
  )
}

/** The labels' class: {@link MEASURE_LABEL_CLASS}, and the consumer's beside it. */
export const labelClassOf = (extra: string | undefined): string =>
  extra ? `${MEASURE_LABEL_CLASS} ${extra}` : MEASURE_LABEL_CLASS
