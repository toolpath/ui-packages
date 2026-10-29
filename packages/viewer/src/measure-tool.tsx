import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Vector3 } from 'three'
import { MeasureLabelChrome } from './measure-labels.js'
import { useMeasurePointer } from './measure-pointer.js'
import { HoverEdge, Measurements, labelClassOf, measureColor } from './measure-readout.js'
import type { PartModel } from './model/types.js'
import { PartPaintContext, usePartContext } from './part-context.js'
import {
  faceRegions,
  holeIndex,
  surfaceCache,
  toVector,
  type HoleIndex,
  type SurfaceFor,
} from './render/face-measure.js'
import { HOVER_COLORS, formatMillimetres, type LabelPress } from './render/measure.js'
import { clickPick, dropLastPick, isFace, type MeasureGroup } from './render/measure-picks.js'
import type { PointerHandlers } from './render/measure-under.js'
import { HOVER_WEIGHT, type RegionHighlight } from './render/paint.js'
import type { ViewCubeProps } from './primitives.js'
import { useRetarget, useSectionStore } from './viewer.js'

export interface MeasureToolProps {
  /**
   * The measurements on screen, each one pick or two read together. Pass it
   * to own them; omit it and the tool keeps its own list, which `onChange`
   * still reports. Picks name the part's regions: clear the list when the
   * part changes.
   */
  measurements?: readonly MeasureGroup[]
  /**
   * The list changed: a click or a tap picked, Delete dropped the last pick,
   * or a click or a tap off the part cleared it. On React Native, where there
   * is no Delete, an app drops the last pick itself with `dropLastPick`.
   */
  onChange?: (measurements: readonly MeasureGroup[]) => void
  /**
   * Writes a length. Millimetres to two places unless told otherwise: the
   * part is in millimetres, and converting is the consumer's call.
   */
  format?: (mm: number) => string
  /** Added to every label's `className`, beside {@link MEASURE_LABEL_CLASS}. Ignored on React Native. */
  labelClassName?: string
  /**
   * The `alignment` and `margin` of the `<ViewCube>` beside the part, whose
   * clicks are its own. `<ViewCube>`'s defaults unless told; null where there
   * is no cube.
   */
  viewCube?: Pick<ViewCubeProps, 'alignment' | 'margin'> | null
  /**
   * Place points rather than take faces, as Alt (Option) does on the web,
   * where either one does it. For a touch screen, which has no Alt.
   */
  points?: boolean
  /**
   * Keep what is on screen and start another measurement, as Shift does on
   * the web, where either one does it.
   */
  keep?: boolean
  /**
   * A label was pressed: `text` is the label as drawn (`X 12.30 mm`), and
   * `value` the bare number in it (`12.30`). On the web it takes the place of
   * the copy a click makes; on React Native the labels can be pressed only
   * where it is given.
   */
  onLabelPress?: (label: { text: string; value: string }) => void
  /**
   * What a screen reader is told pressing a label does, such as "Copies the
   * measurement", on React Native: what a press does is the app's own. None
   * unless given, and ignored on the web.
   */
  labelHint?: string
}

const NONE: readonly MeasureGroup[] = []
// `<ViewCube>`'s own place, the one object for every render.
const CUBE_AS_DRAWN = {}

/**
 * Measure the part by what is clicked or tapped. Mount it inside `<PartMesh>`
 * or `<EnginePart>`.
 *
 * The tool has no modes. A plain click on a face takes the whole face, and on
 * a hole the whole hole. With Alt (Option) held, or `points`, a click places
 * a point, snapped to a corner, the middle of a straight edge, or an edge
 * where one is near, and on the face where none is. Two picks are read
 * together where they make a dimension: the distance between points, from a
 * point or a hole's centre line to a plane, the gap or the angle between two
 * planes.
 * Before a click the face under the pointer is tinted, and a caption by the
 * pointer says what a click there picks.
 *
 * A click starts afresh; Shift, or `keep`, keeps what is on screen. A click
 * on a face already held drops it, Delete drops the last pick, and a click
 * off the part clears them all. A double click aims the orbit at the point clicked,
 * as it does without the tool, and measures once.
 *
 * It measures the part as a section cut leaves it. The cut faces are solid
 * on screen and solid to the tool: an Alt point lands on them and snaps to
 * their corners, and nothing behind one is offered.
 *
 * Nothing needs wiring. While it is mounted the part reports no hovers or
 * picks, and unmounting it hands the pointer back. Beside a `<SectionTool>`
 * waiting for its cut it waits too, until the cut is chosen.
 *
 * Labels are DOM elements laid over the canvas, and they are **unstyled**:
 * what a label looks like is the consumer's stylesheet's, through
 * {@link MEASURE_LABEL_CLASS} and the data attributes on each one. A click
 * on a label copies its number, or goes to `onLabelPress`.
 *
 * On React Native a tap does what a click does, with no hover, no caption
 * and no keys: what was tapped stays painted until the measurements are
 * cleared, a pinch's lift is no tap, and the labels are the native frame's
 * (`<SceneLabel>`), pressable where `onLabelPress` is given.
 */
export const MeasureTool = ({
  measurements,
  onChange,
  format = formatMillimetres,
  labelClassName,
  viewCube = CUBE_AS_DRAWN,
  points = false,
  keep = false,
  onLabelPress,
  labelHint,
}: MeasureToolProps) => {
  const { model, geometry } = usePartContext()
  const store = useSectionStore()
  // A section tool waiting for its cut has the next click. See `render/section-store.ts`.
  const picking = useSyncExternalStore(store.subscribe, store.isPicking, store.isPicking)

  // For as long as this is up, the part reports no hovers or picks.
  useEffect(() => {
    store.setEngaged(true)
    return () => store.setEngaged(false)
  }, [store])

  const [held, setHeld] = useState<readonly MeasureGroup[]>(NONE)
  // A new part's regions are not the old one's: what was picked on the old one goes.
  useEffect(() => setHeld(NONE), [model, geometry])
  const groups = measurements ?? held
  const latest = useRef({ groups, onChange, controlled: measurements !== undefined })
  latest.current = { groups, onChange, controlled: measurements !== undefined }
  // Draws the tool again after a change its app owns, even one the app declines.
  const [, redraw] = useReducer((count: number) => count + 1, 0)
  const commit = useRef((next: readonly MeasureGroup[]): void => {
    const { groups: current, onChange: report, controlled } = latest.current
    if (next === current || (next.length === 0 && current.length === 0)) return
    // A second event before the next render builds on this one; the render puts back what is shown.
    latest.current.groups = next
    if (controlled) {
      redraw()
    } else {
      setHeld(next)
    }
    report?.(next)
  }).current

  const surfaceFor = useMemo(() => surfaceCache(model, geometry), [model, geometry])
  const holes = useMemo(() => holeIndex(model, surfaceFor), [model, surfaceFor])
  // The part's own double click is off while the tool has its clicks, so the tool re-aims for it.
  const retarget = useRetarget()
  // What the input reads afresh at each event, as of this render.
  const current = {
    onDouble: (at: Vector3) => retarget?.(at),
    format,
    viewCube,
    points,
    keep,
  }
  const handlers = useRef<PointerHandlers>({
    onPick: (pick, kept, pairs) => commit(clickPick(latest.current.groups, pick, kept, pairs)),
    onClear: () => commit(NONE),
    onDrop: () => {
      if (latest.current.groups.length === 0) return false
      commit(dropLastPick(latest.current.groups))
      return true
    },
    ...current,
  })
  Object.assign(handlers.current, current)
  // One handler for as long as one is given, whatever the app passes each render:
  // on React Native a new one would draw every label again.
  const press = useRef(onLabelPress)
  press.current = onLabelPress
  const pressable = onLabelPress !== undefined
  const pressLabel = useMemo(
    () => (pressable ? (label: LabelPress) => press.current?.(label) : undefined),
    [pressable],
  )

  const part = useMemo(
    () => ({ model, geometry, surfaceFor, holes }),
    [model, geometry, surfaceFor, holes],
  )
  const shown = useMeasurePointer(part, handlers, !picking, groups.length)
  useMeasurePaint(model, surfaceFor, holes, groups, shown?.region ?? null)
  const edge = shown?.edge
  const hoverEdge = useMemo((): Vector3[] | null => (edge ? edge.map(toVector) : null), [edge])

  return (
    <>
      <Measurements
        groups={groups}
        surfaceFor={surfaceFor}
        holes={holes}
        format={format}
        labelClass={labelClassOf(labelClassName)}
        onLabelPress={pressLabel}
        labelHint={labelHint}
      />
      {hoverEdge ? <HoverEdge points={hoverEdge} color={HOVER_COLORS.plane} /> : null}
      <MeasureLabelChrome onPress={pressLabel} />
    </>
  )
}

/** How strongly the holes the same as a measured one are painted in its colour. */
const SAME_HOLE_WEIGHT = 0.55

const NO_PAINT: readonly RegionHighlight[] = []

/** Paints `faces`, each over every region it was split into. */
const paintFaces = (
  model: PartModel,
  faces: readonly number[],
  color: number,
  weight: number,
): RegionHighlight[] =>
  faces.flatMap((face) => faceRegions(model, face).map((region) => ({ region, color, weight })))

/**
 * Paints the part, over its own paint (`PartPaintContext`): each
 * measurement's faces in its own colour, as its lines and label are, at full
 * strength.
 *
 * A measured hole's faces, every one of them, and the holes the same as it
 * fainter in its colour, so the set a hole belongs to shows with it.
 *
 * The hovered face, tinted by its kind over the whole face, as the last
 * layer. Painted here rather than by the part's own hover, which paints the
 * region under the pointer in the theme's one colour: a face the analysis
 * split into regions would light up a strip at a time. A face already
 * measured keeps its measurement's colour.
 */
const useMeasurePaint = (
  model: PartModel,
  surfaceFor: SurfaceFor,
  holes: HoleIndex,
  groups: readonly MeasureGroup[],
  hovered: number | null,
): void => {
  const setPaint = useContext(PartPaintContext)
  const colorOf = useMemo(() => {
    const colors = new Map<number, number>()
    groups.forEach((group, index) => {
      for (const face of group.filter(isFace)) colors.set(face.region, measureColor(index))
    })
    return colors
  }, [groups])
  const measured = useMemo(
    () => [...colorOf].flatMap(([face, color]) => paintFaces(model, [face], color, 1)),
    [colorOf, model],
  )
  const holePaint = useMemo(() => {
    const faint: RegionHighlight[] = []
    const full: RegionHighlight[] = []
    groups.forEach((group, index) => {
      const color = measureColor(index)
      for (const face of group.filter(isFace)) {
        const hole = holes.holeOf(face.region)
        if (!hole) continue
        for (const same of holes.sameAs(hole)) {
          const into = same === hole ? full : faint
          into.push(...paintFaces(model, same.faces, color, same === hole ? 1 : SAME_HOLE_WEIGHT))
        }
      }
    })
    return [...faint, ...full]
  }, [groups, holes, model])
  const hoverPaint = useMemo(() => {
    if (hovered === null || colorOf.has(hovered)) return NO_PAINT
    const color = HOVER_COLORS[surfaceFor(hovered).kind]
    const faces = holes.holeOf(hovered)?.faces ?? [hovered]
    return paintFaces(model, faces, color, HOVER_WEIGHT)
  }, [hovered, colorOf, surfaceFor, model, holes])

  useLayoutEffect(
    () => setPaint([...measured, ...holePaint, ...hoverPaint]),
    [setPaint, measured, holePaint, hoverPaint],
  )
  useLayoutEffect(() => () => setPaint(NO_PAINT), [setPaint])
}
