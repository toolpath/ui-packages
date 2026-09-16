import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  type CSSProperties,
  type ComponentRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Group,
  type InterleavedBufferAttribute,
  type LineSegments,
  type Object3D,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { useContentBox } from './content-box.js'
import type { Vec3 } from './model/types.js'
import { EXCLUDE_FROM_FRAME, type ViewerCamera, screenLength } from './render/camera.js'
import {
  AXIS_COLORS,
  DELTA_DASH_PIXELS,
  MEASURE_LINE_PIXELS,
  MEASURE_MARKER_PIXELS,
  MEASURE_RENDER_ORDER,
  type MeasureMode,
  type Measurement,
  SNAP_MARKER_PIXELS,
  type Snap,
  type SnapEdges,
  angleArc,
  angleArcRadius,
  angleAt,
  deltaLegs,
  distanceBetween,
  formatDegrees,
  formatMillimetres,
  lockToAxis,
  measurementFromPoints,
  measurementLabel,
  measurementLabelAnchor,
  midpoint,
  nextMeasurementId,
  snapAt,
} from './render/measure.js'
import { hitUnderRay } from './render/section.js'
import { type ViewerTheme, resolveTheme } from './render/theme.js'
import { useTapGuard } from './tap.js'
import { useSectionStore } from './viewer.js'

const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

/** The class every label carries, for a stylesheet to find. */
export const MEASURE_LABEL_CLASS = 'toolpath-measure-label'

/** drei's fat line, whose material and geometry come from three-stdlib. */
type FatLine = NonNullable<ComponentRef<typeof Line>>

/** The two properties of a dashed fat line's material this file moves. */
type DashedMaterial = { dashSize: number; gapSize: number }

export interface MeasureToolProps {
  /**
   * What a click sequence measures. `distance` takes two points; `angle` takes
   * three — one arm's end, the vertex, the other arm's end. Changing it drops
   * any points already placed.
   */
  mode?: MeasureMode
  /**
   * The measurements on screen. Pass it to own them; omit it and the tool keeps
   * its own list, which `onChange` still reports.
   */
  measurements?: readonly Measurement[]
  /** The list changed: a measurement finished, or Delete removed the last one. */
  onChange?: (measurements: readonly Measurement[]) => void
  /**
   * Whether a distance also shows its X, Y and Z parts, as dashed legs in the
   * axis colours with their own labels. On by default; a distance that already
   * runs along an axis shows none either way.
   */
  showDeltas?: boolean
  /**
   * Writes a length. Millimetres to two places unless told otherwise — the part
   * is in millimetres, and converting is the consumer's call.
   */
  format?: (mm: number) => string
  /** Added to every label's `className`, beside {@link MEASURE_LABEL_CLASS}. */
  labelClassName?: string
  theme?: Partial<ViewerTheme>
}

/**
 * Measure the part from inside the viewport. Mount it beside `<PartMesh>`.
 *
 * The pointer snaps to what is under it — a corner first, then an edge's
 * midpoint, then the edge, then the face — and a marker shows where the click
 * will land. A distance is two clicks and an angle three; the line follows the
 * pointer between them with a live readout. Finished measurements stay up,
 * drawn over the part with a label each, until Delete removes the last one or
 * the tool is unmounted. Escape drops the points of one in progress. Holding
 * Shift holds the next point to the X, Y or Z line through the last one — the
 * axis the pointer is furthest along — so a length along an edge is measured
 * along the edge and not a little across it.
 *
 * Nothing needs wiring. While it is mounted the part reports no hovers or
 * picks — a click that places a point is not a click that selects a face — and
 * unmounting it hands the pointer back. It snaps to the edges the part draws,
 * which are the boundaries between analytic surfaces rather than the mesh's
 * triangles, so a corner is a corner of the part and not of a facet.
 *
 * Lines are drawn at a width in pixels, through drei's `Line`, because a
 * WebGL line is one pixel wide whatever is asked of it and one pixel of blue
 * over a white face is not a measurement anybody can see.
 *
 * Labels are DOM elements laid over the canvas, so they are text: a stylesheet
 * can restyle them through {@link MEASURE_LABEL_CLASS}, and a test can read
 * them.
 */
export const MeasureTool = ({
  mode = 'distance',
  measurements,
  onChange,
  showDeltas = true,
  format = formatMillimetres,
  labelClassName,
  theme,
}: MeasureToolProps) => {
  const store = useSectionStore()
  const box = useContentBox()
  const resolved = useMemo(() => resolveTheme(theme), [theme])

  const [held, setHeld] = useState<readonly Measurement[]>([])
  const controlled = measurements !== undefined
  const list = controlled ? measurements : held
  const [draft, setDraft] = useState<readonly Vec3[]>([])

  // For as long as this is up, the part reports no hovers or picks.
  useEffect(() => {
    store.setEngaged(true)
    return () => store.setEngaged(false)
  }, [store])

  // Two points of a distance are not two points of an angle.
  useEffect(() => {
    setDraft([])
  }, [mode])

  const commit = (next: readonly Measurement[]) => {
    if (!controlled) setHeld(next)
    onChange?.(next)
  }

  const latest = useRef({ list, commit })
  latest.current = { list, commit }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft([])
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      // Somebody editing a field beside the viewer is not deleting a measurement.
      if (isEditing(event.target)) return
      const { list: current, commit: apply } = latest.current
      if (current.length === 0) return
      event.preventDefault()
      apply(current.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const place = (point: Vec3) => {
    const points = [...draft, point]
    const complete = measurementFromPoints(mode, points, nextMeasurementId(list))
    if (complete) {
      commit([...list, complete])
      setDraft([])
    } else {
      setDraft(points)
    }
  }

  // Nothing is sized until the part has been measured; see `useContentBox`.
  if (box.isEmpty()) return null

  const labelStyle = labelStyleFor(resolved)
  const label = { className: className(labelClassName), style: labelStyle }

  return (
    <group userData={FURNITURE}>
      <Snapper
        mode={mode}
        draft={draft}
        onPlace={place}
        theme={resolved}
        format={format}
        label={label}
      />
      {draft.map((point, index) => (
        <ScreenDot
          key={index}
          point={point}
          pixels={MEASURE_MARKER_PIXELS}
          color={resolved.measure}
        />
      ))}
      {draft.length === 2 ? (
        <Segment points={[draft[0]!, draft[1]!]} color={resolved.measure} />
      ) : null}
      {list.map((measurement) => (
        <MeasurementView
          key={measurement.id}
          measurement={measurement}
          theme={resolved}
          format={format}
          showDeltas={showDeltas}
          label={label}
        />
      ))}
    </group>
  )
}

interface LabelProps {
  className: string
  style: CSSProperties
}

interface SnapperProps {
  mode: MeasureMode
  draft: readonly Vec3[]
  onPlace: (point: Vec3) => void
  theme: ViewerTheme
  format: (mm: number) => string
  label: LabelProps
}

/** Where a line that has not been placed yet starts out: nowhere, hidden. */
const NOWHERE: readonly [Vector3, Vector3] = [new Vector3(), new Vector3()]

/**
 * The pointer's half of the tool: where it would land, and the line from the
 * last point placed to there.
 *
 * Everything here moves from a `pointermove` listener on the canvas and never
 * through React state — a pointer crossing a face is not a render. The ray is
 * this component's own, as the section tool's is, because the part does not
 * know a tool is mounted and reports nothing while one is.
 */
const Snapper = ({ mode, draft, onPlace, theme, format, label }: SnapperProps) => {
  const camera = useThree((state) => state.camera) as ViewerCamera
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const domElement = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const isTap = useTapGuard()

  const marker = useRef<Group>(null)
  const edgeLine = useRef<FatLine>(null)
  const band = useRef<FatLine>(null)
  const bandLabel = useRef<Group>(null)
  const bandText = useRef<HTMLDivElement>(null)
  const snap = useRef<Snap | null>(null)
  const dot = useDot()

  // Hidden by hand rather than through a `visible` prop: drei's `Line` hands
  // every extra prop to its material as well as its object, and a material
  // made invisible stays that way when the object is shown again.
  useLayoutEffect(() => {
    if (edgeLine.current) edgeLine.current.visible = false
    if (band.current) band.current.visible = false
  }, [])

  // Read by the listener without re-subscribing it on every placed point.
  const current = useRef({ mode, draft, onPlace, format, size })
  current.current = { mode, draft, onPlace, format, size }

  useEffect(() => {
    const raycaster = new Raycaster()
    const pointer = new Vector2()

    const hide = () => {
      if (!snap.current) return
      snap.current = null
      if (marker.current) marker.current.visible = false
      if (edgeLine.current) edgeLine.current.visible = false
      if (band.current) band.current.visible = false
      if (bandLabel.current) bandLabel.current.visible = false
      if (bandText.current) bandText.current.style.display = 'none'
      invalidate()
    }

    /** Where the pointer was last seen, so a Shift press alone can re-aim. */
    let last: { x: number; y: number } | null = null

    const update = (clientX: number, clientY: number, shift: boolean) => {
      last = { x: clientX, y: clientY }
      const rect = domElement.getBoundingClientRect()
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = hitUnderRay(raycaster, scene)
      if (!hit?.face) {
        hide()
        return
      }
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const { size: viewport, draft: placed, mode: kind, format: write } = current.current
      const snapped = snapAt(
        { point: hit.point, normal },
        edgesBeside(hit.object),
        camera,
        viewport,
      )
      const from = placed[placed.length - 1]

      // Shift holds the point to an axis through the last one. What was
      // snapped to no longer matters — the point is on the axis, not the edge.
      const lock = shift && from ? lockToAxis(from, snapped.point) : null
      const found: Snap = lock
        ? { ...snapped, point: new Vector3(lock.point.x, lock.point.y, lock.point.z), edge: null }
        : snapped
      snap.current = found

      const node = marker.current
      if (node) {
        node.position.copy(found.point)
        node.visible = true
        node.scale.setScalar(
          screenLength(camera, found.point, viewport, SNAP_MARKER_PIXELS[found.kind]),
        )
      }
      if (edgeLine.current) {
        edgeLine.current.visible = found.edge !== null
        if (found.edge) moveLine(edgeLine.current, found.edge[0], found.edge[1])
      }

      const text = liveLabel(kind, placed, found.point, write)
      if (band.current) {
        band.current.visible = from !== undefined
        if (from) moveLine(band.current, from, found.point)
        // The line wears the axis it is held to, the way a delta leg does.
        setLineColor(band.current, lock ? AXIS_COLORS[lock.axis] : theme.measure)
      }
      if (bandLabel.current && from) {
        const at = midpoint(from, found.point)
        bandLabel.current.position.set(at.x, at.y, at.z)
        bandLabel.current.visible = text !== null
      }
      if (bandText.current) {
        bandText.current.style.display = text === null ? 'none' : ''
        bandText.current.textContent = text ?? ''
      }
      invalidate()
    }

    const move = (event: PointerEvent) => {
      // A pointer that is orbiting is not looking for a corner.
      if (event.buttons !== 0) {
        hide()
        return
      }
      update(event.clientX, event.clientY, event.shiftKey)
    }

    // Shift pressed or released over a still pointer re-aims the point.
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Shift' || !last || !snap.current) return
      update(last.x, last.y, event.type === 'keydown')
    }

    const up = (event: PointerEvent) => {
      if (event.button !== 0 || !isTap(event)) return
      // Judged with the modifier the click itself carries, so a Shift that
      // came down with the button counts.
      update(event.clientX, event.clientY, event.shiftKey)
      const found = snap.current
      if (!found) return
      current.current.onPlace({ x: found.point.x, y: found.point.y, z: found.point.z })
    }

    const leave = () => {
      last = null
      hide()
    }

    domElement.addEventListener('pointermove', move)
    domElement.addEventListener('pointerleave', leave)
    domElement.addEventListener('pointerup', up)
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    return () => {
      domElement.removeEventListener('pointermove', move)
      domElement.removeEventListener('pointerleave', leave)
      domElement.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
    }
  }, [camera, domElement, invalidate, isTap, scene, theme.measure])

  // A finished measurement takes the band with it; the pointer has not moved
  // to say so. The text goes too, or a hidden label would still read the last
  // number to anything that finds labels by their text.
  useEffect(() => {
    if (draft.length === 0 && band.current) {
      band.current.visible = false
      if (bandLabel.current) bandLabel.current.visible = false
      if (bandText.current) {
        bandText.current.style.display = 'none'
        bandText.current.textContent = ''
      }
      invalidate()
    }
  }, [draft, invalidate])

  return (
    <>
      <group ref={marker} visible={false}>
        <mesh geometry={dot} renderOrder={MEASURE_RENDER_ORDER} raycast={() => null}>
          <meshBasicMaterial color={theme.measureSnap} depthTest={false} depthWrite={false} />
        </mesh>
      </group>
      <Line
        ref={edgeLine}
        points={NOWHERE}
        color={theme.measureSnap}
        lineWidth={MEASURE_LINE_PIXELS.edge}
        depthTest={false}
        depthWrite={false}
        frustumCulled={false}
        renderOrder={MEASURE_RENDER_ORDER}
        raycast={() => null}
      />
      <Line
        ref={band}
        points={NOWHERE}
        color={theme.measure}
        lineWidth={MEASURE_LINE_PIXELS.line}
        depthTest={false}
        depthWrite={false}
        frustumCulled={false}
        renderOrder={MEASURE_RENDER_ORDER}
        raycast={() => null}
      />
      <group ref={bandLabel} visible={false}>
        <Html center zIndexRange={[0, 0]}>
          <div
            ref={bandText}
            className={label.className}
            style={{ ...label.style, display: 'none' }}
          />
        </Html>
      </group>
    </>
  )
}

/**
 * Moves a two-point fat line's ends in place.
 *
 * drei rebuilds the geometry when `points` changes, which for a line that
 * follows the pointer is a buffer per event. The positions live in one
 * interleaved buffer — start at offset 0, end at offset 3 — so the six numbers
 * are written straight into it instead.
 */
function moveLine(line: FatLine, from: Vec3, to: Vec3): void {
  const start = line.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute
  const array = start.data.array
  array[0] = from.x
  array[1] = from.y
  array[2] = from.z
  array[3] = to.x
  array[4] = to.y
  array[5] = to.z
  start.data.needsUpdate = true
  line.computeLineDistances()
}

/** Recolours a fat line's material in place. */
function setLineColor(line: FatLine, color: number): void {
  const material = line.material as { color: { getHex(): number; setHex(hex: number): void } }
  if (material.color.getHex() !== color) material.color.setHex(color)
}

/** The live readout while a measurement is being placed, or `null` for none yet. */
function liveLabel(
  mode: MeasureMode,
  placed: readonly Vec3[],
  at: Vector3,
  format: (mm: number) => string,
): string | null {
  if (mode === 'distance' && placed.length === 1) {
    return format(distanceBetween(placed[0]!, at))
  }
  if (mode === 'angle' && placed.length === 2) {
    return formatDegrees(angleAt(placed[1]!, placed[0]!, at))
  }
  return null
}

/**
 * The edges the part draws beside its mesh, as something to snap to.
 *
 * `createPart` puts the mesh and its region edges in one group, so the edges
 * are the hit mesh's sibling. A consumer's own mesh with no such sibling snaps
 * to faces only, which is still a measurement.
 */
function edgesBeside(object: Object3D): SnapEdges | null {
  const siblings = object.parent?.children ?? []
  for (const sibling of siblings) {
    if (!('isLineSegments' in sibling)) continue
    const geometry = (sibling as LineSegments).geometry
    const positions = geometry.getAttribute('position')
    if (!positions) continue
    return { positions: positions.array, matrixWorld: sibling.matrixWorld }
  }
  return null
}

interface MeasurementViewProps {
  measurement: Measurement
  theme: ViewerTheme
  format: (mm: number) => string
  showDeltas: boolean
  label: LabelProps
}

/** One finished measurement: its lines, its markers, and its label. */
const MeasurementView = ({
  measurement,
  theme,
  format,
  showDeltas,
  label,
}: MeasurementViewProps) => {
  const text = measurementLabel(measurement, format)
  const anchor = measurementLabelAnchor(measurement)

  if (measurement.kind === 'distance') {
    const [a, b] = measurement.points
    return (
      <>
        <Segment points={[a, b]} color={theme.measure} />
        <ScreenDot point={a} pixels={MEASURE_MARKER_PIXELS} color={theme.measure} />
        <ScreenDot point={b} pixels={MEASURE_MARKER_PIXELS} color={theme.measure} />
        {showDeltas ? <DeltaLegs a={a} b={b} format={format} label={label} /> : null}
        <Label at={anchor} text={text} {...label} />
      </>
    )
  }

  const [a, vertex, b] = measurement.points
  const arc = angleArc(vertex, a, b, angleArcRadius(vertex, a, b))
  return (
    <>
      <Segment points={[vertex, a]} color={theme.measure} />
      <Segment points={[vertex, b]} color={theme.measure} />
      <Polyline points={arc} color={theme.measure} />
      <ScreenDot point={a} pixels={MEASURE_MARKER_PIXELS} color={theme.measure} />
      <ScreenDot point={vertex} pixels={MEASURE_MARKER_PIXELS} color={theme.measure} />
      <ScreenDot point={b} pixels={MEASURE_MARKER_PIXELS} color={theme.measure} />
      <Label at={anchor} text={text} {...label} />
    </>
  )
}

interface DeltaLegsProps {
  a: Vec3
  b: Vec3
  format: (mm: number) => string
  label: LabelProps
}

/**
 * A distance's X, Y and Z parts, dashed in the axis colours.
 *
 * The dash is held to a size on screen, as the markers are: a dash in world
 * units is a solid line on a plate and a dotted one on an insert.
 */
const DeltaLegs = ({ a, b, format, label }: DeltaLegsProps) => {
  const camera = useThree((state) => state.camera) as ViewerCamera
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const legs = useMemo(() => deltaLegs(a, b), [a, b])
  const lines = useRef<(FatLine | null)[]>([])
  const centre = useMemo(() => {
    const at = midpoint(a, b)
    return new Vector3(at.x, at.y, at.z)
  }, [a, b])

  useFrame(() => {
    const dash = screenLength(camera, centre, size, DELTA_DASH_PIXELS)
    let changed = false
    for (const line of lines.current) {
      const material = line?.material as DashedMaterial | undefined
      if (!material || Math.abs(material.dashSize - dash) <= dash * 1e-3) continue
      material.dashSize = dash
      material.gapSize = dash
      changed = true
    }
    if (changed) invalidate()
  })

  return (
    <>
      {legs.map((leg, index) => (
        <Line
          key={leg.axis}
          ref={(line) => {
            lines.current[index] = line
          }}
          points={[
            new Vector3(leg.from.x, leg.from.y, leg.from.z),
            new Vector3(leg.to.x, leg.to.y, leg.to.z),
          ]}
          color={AXIS_COLORS[leg.axis]}
          lineWidth={MEASURE_LINE_PIXELS.leg}
          dashed
          dashSize={1}
          gapSize={1}
          depthTest={false}
          depthWrite={false}
          frustumCulled={false}
          renderOrder={MEASURE_RENDER_ORDER}
          raycast={() => null}
        />
      ))}
      {legs.map((leg) => (
        <Label
          key={leg.axis}
          at={midpoint(leg.from, leg.to)}
          text={`${leg.axis.toUpperCase()} ${format(leg.length)}`}
          className={label.className}
          style={{ ...label.style, ...legLabelStyle(AXIS_COLORS[leg.axis]) }}
        />
      ))}
    </>
  )
}

interface LabelViewProps extends LabelProps {
  at: Vec3
  text: string
}

const Label = ({ at, text, className: name, style }: LabelViewProps) => (
  <group position={[at.x, at.y, at.z]}>
    <Html center zIndexRange={[0, 0]}>
      <div className={name} style={style}>
        {text}
      </div>
    </Html>
  </group>
)

interface ScreenDotProps {
  point: Vec3
  pixels: number
  color: number
}

/** A dot that holds its size on screen, drawn over everything. */
const ScreenDot = ({ point, pixels, color }: ScreenDotProps) => {
  const camera = useThree((state) => state.camera) as ViewerCamera
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const node = useRef<Group>(null)
  const dot = useDot()
  const position = useMemo(() => new Vector3(point.x, point.y, point.z), [point])

  useFrame(() => {
    const group = node.current
    if (!group) return
    const length = screenLength(camera, position, size, pixels)
    if (Math.abs(group.scale.x - length) > length * 1e-3) {
      group.scale.setScalar(length)
      invalidate()
    }
  })

  return (
    <group ref={node} position={position}>
      <mesh geometry={dot} renderOrder={MEASURE_RENDER_ORDER} raycast={() => null}>
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

interface SegmentProps {
  points: readonly [Vec3, Vec3]
  color: number
}

const Segment = ({ points, color }: SegmentProps) => {
  const [a, b] = points
  const ends = useMemo(
    () => [new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z)],
    // Keyed on the numbers: a draft's tuple is a fresh array on every render,
    // and a rebuilt array would rebuild the line's geometry with it.
    [a.x, a.y, a.z, b.x, b.y, b.z],
  )
  return <Polyline points={ends} color={color} />
}

interface PolylineProps {
  points: readonly Vector3[]
  color: number
}

/** A run of points as one line, a few pixels wide, drawn over everything. */
const Polyline = ({ points, color }: PolylineProps) => {
  if (points.length < 2) return null
  return (
    <Line
      points={points}
      color={color}
      lineWidth={MEASURE_LINE_PIXELS.line}
      depthTest={false}
      depthWrite={false}
      frustumCulled={false}
      renderOrder={MEASURE_RENDER_ORDER}
      raycast={() => null}
    />
  )
}

/** The marker sphere, unit radius, so a group's scale is its radius. */
function useDot(): SphereGeometry {
  const geometry = useMemo(() => new SphereGeometry(1, 16, 12), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function className(extra: string | undefined): string {
  return extra ? `${MEASURE_LABEL_CLASS} ${extra}` : MEASURE_LABEL_CLASS
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * How a label looks with no stylesheet: a dark pill with the measurement
 * colour for a border, lifted off the point it names. `pointer-events: none`
 * so a label over the part does not take the click meant for the face under
 * it.
 */
function labelStyleFor(theme: ViewerTheme): CSSProperties {
  return {
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    font: '600 12px/1.2 system-ui, sans-serif',
    color: '#ffffff',
    background: 'rgba(20, 23, 33, 0.85)',
    border: `1px solid ${hex(theme.measure)}`,
    borderRadius: 4,
    padding: '2px 6px',
    transform: 'translateY(-16px)',
  }
}

/**
 * A leg's label hangs below its leg where the distance's own label is lifted
 * above: the leg along the line's longest axis runs close beside the line, and
 * the two labels would otherwise sit on the same pixel.
 */
function legLabelStyle(color: number): CSSProperties {
  return {
    borderColor: hex(color),
    fontWeight: 500,
    fontSize: 11,
    transform: 'translateY(14px)',
  }
}
