import { useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { Raycaster } from 'three'
import type { ViewerCamera } from './render/camera.js'
import { zoomedReach } from './render/edge-corners.js'
import { SNAP_REACH, pairsOn, pickFrom } from './render/measure-picks.js'
import { classifyTap, countFingers } from './render/measure-taps.js'
import {
  cutSampler,
  partSphere,
  underPointer,
  type MeasuredPart,
  type PointerHandlers,
  type PointerShown,
} from './render/measure-under.js'
import { partSurfaces } from './render/part-surfaces.js'
import { readPointer } from './render/pointer.js'
import { trackDoubleTaps } from './render/tap.js'

/** The fingers down as a touch lands, which fiber's native canvas sends on its event. */
interface CanvasTouch {
  touches?: readonly unknown[]
}

/**
 * React Native's `measure-pointer.ts`: a tap picks what is under it. A finger
 * has no hover to show what a tap would pick, so what was tapped stays
 * painted instead, the face, or the edge a point snapped to, until no
 * measurement is left (`measured`, how many are on screen).
 *
 * It listens for `click` on `gl.domElement`, which fiber's native canvas
 * sends for a touch that moved less than its own click threshold, and for
 * `pointerdown`, with the fingers down, as each finger lands. A tap ending a
 * gesture that had two fingers down is a pinch's, not a pick
 * (`classifyTap`). A tap on the view cube is the cube's.
 *
 * Taps are paired as the part pairs them (`trackDoubleTaps`); a pinch or a
 * cube tap between two breaks them up. The second tap of a pair is the
 * view's: it goes to `onDouble` at the point tapped, and picks nothing, as a
 * pick would undo the first or pair a point with itself.
 *
 * A tap picks the face or the hole under it, or with `points` a point,
 * snapped to a corner or an edge within reach (`SNAP_REACH`, scaled to the
 * part on screen), as the web's Alt does. `keep` keeps what is on screen, as
 * Shift does. A tap off the part clears. There is no hover and there are no
 * keys: an app drops the last pick with `dropLastPick`.
 *
 * Each tap casts one ray at the part, through the part's bounding volume
 * hierarchy (`render/part-picking.native.ts`), and with `points` a few more
 * at the corners and edges in reach. The part's edges are found the first
 * time a point is tapped (`edgeSnapsFor`).
 */
export const useMeasurePointer = (
  part: MeasuredPart,
  handlers: RefObject<PointerHandlers>,
  active: boolean,
  measured: number,
): PointerShown | null => {
  const { model, geometry, surfaceFor, holes } = part
  const { gl, camera, size, scene } = useThree()
  const cut = useMemo(() => cutSampler(geometry, model), [geometry, model])
  const [shown, setShown] = useState<PointerShown | null>(null)
  const pairs = useMemo(() => pairsOn(surfaceFor), [surfaceFor])
  // Kept past a re-run of the listeners, so a pick that moves the layout keeps a pair or a pinch.
  const [doubles] = useState(trackDoubleTaps)
  const [fingers] = useState(countFingers)
  const measuring = useRef(active)
  measuring.current = active
  const empty = measured === 0

  // What was tapped goes with the measurements it made, and with the part.
  useEffect(() => {
    if (!active || empty) setShown(null)
  }, [active, empty])
  useEffect(() => setShown(null), [model, geometry])

  useEffect(() => {
    const canvas = gl.domElement
    const view = camera as ViewerCamera
    const raycaster = new Raycaster()

    const onDown = (event: Event): void => {
      // Fiber types its native canvas's events as the DOM's; a touch carries the fingers down.
      fingers.land((event as unknown as CanvasTouch).touches?.length ?? 1)
    }
    const onClick = (event: Event): void => {
      const { x, y } = readPointer(event)
      const pointer = { x, y }
      const { viewCube, points, keep } = handlers.current
      const kind = classifyTap({
        measuring: measuring.current,
        fingers: fingers.most(),
        pointer,
        viewport: size,
        viewCube,
      })
      if (kind === 'pinch' || kind === 'cube') doubles.reset()
      if (kind !== 'part') return
      const doubled = doubles.isDouble(event)
      const surfaces = partSurfaces(scene, geometry)
      const reach =
        points && !doubled
          ? zoomedReach(SNAP_REACH, partSphere(geometry, surfaces), view, size)
          : null
      const found = underPointer(
        { model, geometry, surfaceFor, holes, cut, surfaces, raycaster },
        { camera: view, viewport: size, pointer },
        reach && { reach, heldLine: null },
      )
      if (doubled) {
        if (found?.at) handlers.current.onDouble(found.at)
        return
      }
      if (!found) {
        handlers.current.onClear()
        setShown(null)
        return
      }
      const { under } = found
      const pick = points ? pickFrom(under) : (under.on?.face ?? null)
      if (pick) handlers.current.onPick(pick, keep, pairs)
      const snapped = points ? under.snap : null
      setShown({
        region: snapped ? null : (under.on?.face.region ?? null),
        edge: snapped?.edge ?? null,
      })
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('click', onClick)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('click', onClick)
    }
  }, [
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
    fingers,
  ])

  return active && !empty ? shown : null
}
