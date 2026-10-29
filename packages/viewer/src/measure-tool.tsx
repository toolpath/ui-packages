import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Vector3 } from 'three'
import { HOVER_COLORS } from './measure-hint.js'
import { MeasureLabelCopy, MeasureLabelDeclutter } from './measure-labels.js'
import { useMeasurePointer, type PointerHandlers } from './measure-pointer.js'
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
import { formatMillimetres } from './render/measure.js'
import { clickPick, dropLastPick, isFace, type MeasureGroup } from './render/measure-picks.js'
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
  /** The list changed: a click picked, Delete dropped the last pick, or a click off the part cleared it. */
  onChange?: (measurements: readonly MeasureGroup[]) => void
  /**
   * Writes a length. Millimetres to two places unless told otherwise: the
   * part is in millimetres, and converting is the consumer's call.
   */
  format?: (mm: number) => string
  /** Added to every label's `className`, beside {@link MEASURE_LABEL_CLASS}. */
  labelClassName?: string
  /**
   * The `alignment` and `margin` of the `<ViewCube>` beside the part, whose
   * clicks are its own. `<ViewCube>`'s defaults unless told; null where there
   * is no cube.
   */
  viewCube?: Pick<ViewCubeProps, 'alignment' | 'margin'> | null
}

const NONE: readonly MeasureGroup[] = []
// `<ViewCube>`'s own place, the one object for every render.
const CUBE_AS_DRAWN = {}

/**
 * Measure the part by what is clicked. Mount it inside `<PartMesh>` or
 * `<EnginePart>`.
 *
 * The tool has no modes. A plain click on a face takes the whole face, and on
 * a hole the whole hole. With Alt (Option) held a click places a point,
 * snapped to a corner, the middle of a straight edge, or an edge where one is
 * near, and on the face where none is. Two picks are read together where
 * they make a dimension: the distance between points, from a point or a
 * hole's centre line to a plane, the gap or the angle between two planes.
 * Before a click the face under the pointer is tinted, and a caption by the
 * pointer says what a click there picks.
 *
 * A click starts afresh; Shift keeps what is on screen. A click on a face
 * already held drops it, Delete drops the last pick, and a click off the
 * part clears them all. A double click aims the orbit at the point clicked,
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
 * on a label copies its number.
 */
export const MeasureTool = ({
  measurements,
  onChange,
  format = formatMillimetres,
  labelClassName,
  viewCube = CUBE_AS_DRAWN,
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
  const commit = useRef((next: readonly MeasureGroup[]): void => {
    const { groups: current, onChange: report, controlled } = latest.current
    if (next === current || (next.length === 0 && current.length === 0)) return
    if (!controlled) setHeld(next)
    report?.(next)
  }).current

  const surfaceFor = useMemo(() => surfaceCache(model, geometry), [model, geometry])
  const holes = useMemo(() => holeIndex(model, surfaceFor), [model, surfaceFor])
  // The part's own double click is off while the tool has its clicks, so the tool re-aims for it.
  const retarget = useRetarget()
  const handlers = useRef<PointerHandlers>({
    onPick: (pick, keep, pairs) => commit(clickPick(latest.current.groups, pick, keep, pairs)),
    onClear: () => commit(NONE),
    onDouble: (at) => retarget?.(at),
    format,
    viewCube,
  })
  handlers.current.onDouble = (at) => retarget?.(at)
  handlers.current.format = format
  handlers.current.viewCube = viewCube

  const part = useMemo(
    () => ({ model, geometry, surfaceFor, holes }),
    [model, geometry, surfaceFor, holes],
  )
  const shown = useMeasurePointer(part, handlers, !picking)
  useDeleteKey((event) => {
    if (latest.current.groups.length === 0) return
    event.preventDefault()
    commit(dropLastPick(latest.current.groups))
  })
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
      />
      {hoverEdge ? <HoverEdge points={hoverEdge} color={HOVER_COLORS.plane} /> : null}
      <MeasureLabelDeclutter />
      <MeasureLabelCopy />
    </>
  )
}

const isEditing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Delete or Backspace, unless a field beside the viewer is being typed in. */
const useDeleteKey = (onDelete: (event: KeyboardEvent) => void): void => {
  const latest = useRef(onDelete)
  latest.current = onDelete
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      // Cmd+Backspace and the like are the page's, not a pick dropped.
      if (event.metaKey || event.ctrlKey || event.altKey || isEditing(event.target)) return
      latest.current(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
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
