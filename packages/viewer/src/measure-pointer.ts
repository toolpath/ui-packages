import { useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { Matrix4, Raycaster, type BufferGeometry, type Vector3 } from 'three'
import { createMeasureHint, type CanvasSpot } from './measure-hint.js'
import type { PartModel } from './model/types.js'
import type { ViewerCamera } from './render/camera.js'
import { zoomedReach, type ScreenAt } from './render/edge-corners.js'
import type { HoleIndex, Point, SurfaceFor } from './render/face-measure.js'
import {
  SNAP_REACH,
  hoverCaption,
  isPointSnap,
  pairsOn,
  pickFrom,
  stickySnap,
  type MeasurePick,
  type Pairs,
  type SnapReach,
  type Snapped,
  type Under,
} from './render/measure-picks.js'
import { cutSampler, onCanvas, partSphere, underPointer } from './render/measure-under.js'
import { partSurfaces } from './render/part-surfaces.js'
import { TAP_SLOP, trackDoubleTaps } from './render/tap.js'
import { onViewCube, type ViewCubePlace } from './render/view-cube.js'

/** The part measured, and what the tool already knows of it. */
export interface MeasuredPart {
  model: PartModel
  geometry: BufferGeometry
  surfaceFor: SurfaceFor
  holes: HoleIndex
}

/** What the pointer does to the measurements, and how it reads them. Read afresh at each event. */
export interface PointerHandlers {
  onPick: (pick: MeasurePick, keep: boolean, pairs: Pairs) => void
  onClear: () => void
  /** A double click or tap, on the part at `at`, in world space. */
  onDouble: (at: Vector3) => void
  format: (mm: number) => string
  /** Where a view cube stands, whose clicks are its own; null for none. */
  viewCube: ViewCubePlace | null
}

/** What the part paints for the pointer: the face it is on (no Alt), and the edge an Alt point is on. */
export interface PointerShown {
  region: number | null
  /** The edge an Alt point snaps to or is the middle of, as points along it, drawn bold. */
  edge: readonly Point[] | null
}

interface ClientSpot {
  clientX: number
  clientY: number
}

/** How long after the last turn of the wheel the view is read again, ms: a zoom glides on a little. */
const WHEEL_SETTLE_MS = 120

/** Where no mesh is found, its space is taken as the world's. */
const NO_MOVE = new Matrix4()

/**
 * The measure tool's pointer: what is under it, shown before a click, and
 * the clicks themselves. Listens only while `active`.
 *
 * Without Alt it reads only the face under the pointer. With Alt (Option)
 * held it also finds where a point would go (`underPointer`): a corner
 * within reach (`SNAP_REACH`, scaled to the part on screen by
 * `zoomedReach`), else an edge, else the face. Alt is read off each key, each
 * press and each move but a drag's, and a click reads it again for itself.
 *
 * Steady by design. A move is read once a frame at most. The caption and the
 * ring are moved straight from here (`createMeasureHint`), and the part is
 * painted again only when the face or the edge it paints changes, not on
 * every move. A corner holds the pointer a little past its reach once it has
 * it (`stickySnap`), and so does an edge (`edgesNear`).
 *
 * It listens on the whole canvas rather than on the part, because the
 * corners a point is most often wanted at are on the part's outline, where
 * half of a corner's reach is off the part. The view is read again as a drag
 * or a zoom ends, as the part has moved under a pointer that has not.
 *
 * A click picks exactly what was shown. A click off the part clears the
 * measurements; a plain click on the part with nothing to pick, such as on
 * a face a section cut made, does nothing. A drag is no click, only the left
 * button picks, a click on the view cube is the cube's, and a click whose
 * press came before the tool was listening is not its. A double click is
 * paired as the part pairs it (`trackDoubleTaps`) and goes to `onDouble` at
 * the point clicked; its second click picks nothing.
 */
export const useMeasurePointer = (
  part: MeasuredPart,
  handlers: RefObject<PointerHandlers>,
  active: boolean,
): PointerShown | null => {
  const { model, geometry, surfaceFor, holes } = part
  const { gl, camera, size, scene } = useThree()
  // Re-sampled only when cut; the part's edges are found the first time a point is snapped.
  const cut = useMemo(() => cutSampler(geometry, model), [geometry, model])
  const [shown, setShown] = useState<PointerShown | null>(null)
  const pairs = useMemo(() => pairsOn(surfaceFor), [surfaceFor])
  // Kept past a re-run of the effect below, so a pointer that has not moved is read again.
  const last = useRef<ClientSpot | null>(null)
  // Kept past a re-run too: a pick can resize the canvas between a double click's two clicks.
  const [doubles] = useState(trackDoubleTaps)

  useEffect(() => {
    // Off, the tool sees no moves: where the pointer was is not where it will be.
    if (!active) last.current = null
    const container = gl.domElement.parentElement
    if (!active || !container) return
    const canvas = gl.domElement
    const view = camera as ViewerCamera
    const hint = createMeasureHint(container)
    const raycaster = new Raycaster()
    let alt = false
    let pressing = false
    let zooming = false
    let under: Under | null = null
    let onPart = false
    // Where the ray met the part at the last read, in world space.
    let hit: Vector3 | null = null
    let heldCorner: Snapped | null = null
    let heldLine: number | null = null
    let pressedAt: ClientSpot | null = null
    let frame = 0
    let settle = 0

    const show = (next: PointerShown | null): void =>
      setShown((previous) => (sameShown(previous, next) ? previous : next))
    const letGo = (): void => {
      under = null
      hit = null
      heldCorner = null
      heldLine = null
      hint.hide()
      show(null)
    }
    const pointerOf = (at: ClientSpot): CanvasSpot => {
      const box = canvas.getBoundingClientRect()
      return { x: at.clientX - box.left, y: at.clientY - box.top }
    }
    const spotOf = (point: Point, meshToWorld: Matrix4): CanvasSpot => {
      const { x, y } = onCanvas(point, meshToWorld, view, size)
      return { x, y }
    }
    const onCube = (pointer: CanvasSpot): boolean => {
      const { viewCube } = handlers.current
      return viewCube !== null && onViewCube(pointer, size, viewCube)
    }
    // A corner the pointer had holds it a little past its reach (`stickySnap`).
    const holdCorner = (
      snap: Snapped | null,
      pointer: CanvasSpot,
      reach: SnapReach,
      meshToWorld: Matrix4,
    ): Snapped | null => {
      const held = heldCorner && spotOf(heldCorner.point, meshToWorld)
      const fromHeld = held ? Math.hypot(held.x - pointer.x, held.y - pointer.y) : Infinity
      const kept = stickySnap(heldCorner, snap, fromHeld, reach)
      heldCorner = kept && isPointSnap(kept.kind) ? kept : null
      return kept
    }
    const readAt = (at: ClientSpot): void => {
      last.current = at
      const pointer = pointerOf(at)
      if (onCube(pointer)) {
        onPart = false
        letGo()
        return
      }
      const screen: ScreenAt = { camera: view, viewport: size, pointer }
      const surfaces = partSurfaces(scene, geometry)
      // The tool draws in the mesh's space, so its points are in it (`underPointer`).
      const meshToWorld = surfaces[0]?.matrixWorld ?? NO_MOVE
      const reach = alt ? zoomedReach(SNAP_REACH, partSphere(geometry, surfaces), view, size) : null
      const at3d = { model, geometry, surfaceFor, holes, cut, surfaces, raycaster }
      const found = underPointer(at3d, screen, reach && { reach, heldLine })
      onPart = found !== null
      hit = found?.at ?? null
      if (!reach) heldCorner = null
      const snap = reach ? holdCorner(found?.under.snap ?? null, pointer, reach, meshToWorld) : null
      heldLine = snap?.kind === 'edge' ? (found?.line ?? null) : null
      const on = found?.under.on ?? null
      under = on || snap ? { on, snap } : null
      if (!under) {
        letGo()
        return
      }
      const ring = snap
        ? { ...spotOf(snap.point, meshToWorld), corner: snap.kind === 'vertex' }
        : null
      hint.show(hoverCaption(under, holes, handlers.current.format), pointer, ring)
      show({ region: snap ? null : (on?.face.region ?? null), edge: snap?.edge ?? null })
    }
    const readSoon = (): void => {
      if (frame || zooming) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (last.current && !pressing) readAt(last.current)
      })
    }
    // A drag turns the part under the pointer: nothing shown stays true of it.
    const dragged = (): void => {
      under = null
      hint.hide()
      show(null)
    }
    // The view moved under a still pointer: nothing held stands where it did.
    const viewMoved = (): void => {
      heldCorner = null
      heldLine = null
    }
    const onMove = (event: PointerEvent): void => {
      // Kept through a drag, so the read as it ends is where the pointer let go.
      last.current = event
      if (event.buttons !== 0) {
        if (!pressedAt || distance(event, pressedAt) > TAP_SLOP) dragged()
        return
      }
      // A press let go off the canvas sends no pointerup here.
      pressing = false
      alt = event.altKey
      readSoon()
    }
    // A zoom glides on after the wheel stops: nothing is read until it has settled.
    const onWheel = (): void => {
      viewMoved()
      dragged()
      zooming = true
      clearTimeout(settle)
      settle = window.setTimeout(() => {
        zooming = false
        readSoon()
      }, WHEEL_SETTLE_MS)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.altKey === alt) return
      alt = event.altKey
      if (last.current && !pressing && !zooming) readAt(last.current)
    }
    // Alt let go in another window sends no keyup here.
    const onBlur = (): void => {
      alt = false
      if (last.current && !pressing) readAt(last.current)
    }
    // A touch leaves as it lifts, before its click: what it pressed on must stay for the click.
    const onLeave = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse') return
      last.current = null
      doubles.reset()
      letGo()
    }
    // Read where the press lands: a touch or a pen has no hover before it, and Alt may have changed unseen.
    const onDown = (event: PointerEvent): void => {
      pressedAt = event.button === 0 ? event : null
      alt = event.altKey
      readAt(event)
      pressing = true
    }
    const onCancel = (): void => {
      pressing = false
      pressedAt = null
      readSoon()
    }
    const onUp = (event: PointerEvent): void => {
      pressing = false
      if (pressedAt && distance(event, pressedAt) > TAP_SLOP) viewMoved()
      readSoon()
    }
    const onClick = (event: MouseEvent): void => {
      const pressed = pressedAt
      pressedAt = null
      if (!pressed) return
      // A drag between two clicks, or a click on the cube, breaks a double click up.
      if (distance(event, pressed) > TAP_SLOP || onCube(pointerOf(pressed))) {
        doubles.reset()
        return
      }
      const doubled = doubles.isDouble(event)
      if (event.detail <= 1) {
        // Alt as the click has it, so a ring left up by a missed keyup cannot make a plain click a point.
        const pick = under && (event.altKey ? pickFrom(under) : (under.on?.face ?? null))
        if (pick) handlers.current.onPick(pick, event.shiftKey, pairs)
        // Only a click off the part clears: a plain click on a corner just off it, or on a cut face, does nothing.
        else if (!under && !onPart) handlers.current.onClear()
      }
      // After the pick, as the part orders it: the re-aim moves the view the pick was read in.
      if (doubled && hit) handlers.current.onDouble(hit)
    }
    const listeners: [EventTarget, string, EventListener][] = [
      [canvas, 'pointermove', onMove as EventListener],
      [canvas, 'pointerleave', onLeave as EventListener],
      [canvas, 'pointerdown', onDown as EventListener],
      [canvas, 'pointerup', onUp as EventListener],
      [canvas, 'pointercancel', onCancel],
      [canvas, 'wheel', onWheel],
      [canvas, 'click', onClick as EventListener],
      [window, 'keydown', onKey as EventListener],
      [window, 'keyup', onKey as EventListener],
      [window, 'blur', onBlur],
    ]
    for (const [target, type, listener] of listeners) {
      target.addEventListener(type, listener, { passive: true })
    }
    readSoon()
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settle)
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener)
      hint.remove()
      setShown(null)
    }
  }, [
    active,
    gl,
    camera,
    size,
    scene,
    model,
    geometry,
    surfaceFor,
    holes,
    cut,
    pairs,
    handlers,
    doubles,
  ])

  return shown
}

const distance = (a: ClientSpot, b: ClientSpot): number =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

const samePoints = (a: readonly Point[] | null, b: readonly Point[] | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.length === b.length &&
    a.every((point, index) => point.every((value, axis) => value === b[index]?.[axis])))

/** Whether two reads paint the same, so the part need not be painted again. */
const sameShown = (a: PointerShown | null, b: PointerShown | null): boolean =>
  a === b || (a !== null && b !== null && a.region === b.region && samePoints(a.edge, b.edge))
