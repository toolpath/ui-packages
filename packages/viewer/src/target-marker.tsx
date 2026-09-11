import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { EXCLUDE_FROM_FRAME, type ViewerCamera, screenLength } from './render/camera.js'
import type { ExtendedCameraControls } from './render/controls.js'
import {
  ORBIT_TARGET_COLOR,
  ORBIT_TARGET_FLASH_MS,
  ORBIT_TARGET_PIXELS,
  ORBIT_TARGET_RING_COLOR,
  ORBIT_TARGET_RING_OPACITY,
  ORBIT_TARGET_RING_PIXELS,
  ORBIT_TARGET_RING_WIDTH,
  orbitTargetOpacity,
} from './render/target.js'

/**
 * Kept off every measurement of the scene. `useContentBox` walks the whole
 * scene and skips only what carries this, so an unflagged marker would be
 * measured as part of the part — and it sits at the orbit target, which is
 * exactly where the wheel can carry it well outside the geometry.
 */
const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

export interface TargetMarkerProps {
  /** The viewer's controls, whose target this follows. */
  controlsRef: RefObject<ExtendedCameraControls | null>
}

/**
 * Two circles at the orbit target, up only while it matters.
 *
 * Shown for as long as a gesture is running, and flashed whenever the pivot
 * moves on its own — a cursor zoom walking it, a double click re-aiming it, a
 * Fit putting it back. Those are the moments nothing else on screen accounts
 * for, and the ones F4 recorded as leaving a runaway wheel with no cue at all.
 *
 * Deliberately not shown for a centre-zoom: the pivot is not moving then, and
 * the frustum is scaling about the middle of the view, which is where the
 * marker already is. The library gives no help here either — the wheel emits no
 * `controlstart` or `controlend`, by its own documentation, because scroll
 * arrives intermittently and neither end of it can be detected. Watching the
 * target itself is what covers the wheel, and it covers the programmatic moves
 * as well without anything having to tell it about them.
 *
 * A dot inside a ring, both drawn over everything — see `render/target.ts` for
 * why that replaced legacy's depth-tested outer sphere. The ring is billboarded
 * on the camera each frame, which is what keeps a flat annulus a circle from
 * every angle instead of collapsing to a line edge-on.
 *
 * Sized through `screenLength` rather than legacy's `partScale / camera.zoom`.
 * That divisor is right for an orthographic camera, where the frustum is the
 * only scale, and wrong for a perspective one, where apparent size is a
 * question about distance. `screenLength` is the answer this package already
 * uses for the section handle, and it asks the right question of both cameras.
 */
export const TargetMarker = ({ controlsRef }: TargetMarkerProps) => {
  const camera = useThree((state) => state.camera) as ViewerCamera
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  // Not read, only watched: R3F setting its `controls` slot is the signal that
  // `controlsRef` has been filled, and re-runs the effect below at that moment.
  const registered = useThree((state) => state.controls)

  const group = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const dotMaterial = useRef<MeshBasicMaterial>(null)
  const ringMaterial = useRef<MeshBasicMaterial>(null)

  const dotGeometry = useMemo(() => new SphereGeometry(1, 16, 12), [])
  // Outer radius 1, so the mesh's own scale is that radius in pixels.
  const ringGeometry = useMemo(() => new RingGeometry(1 - ORBIT_TARGET_RING_WIDTH, 1, 48), [])
  useEffect(
    () => () => {
      dotGeometry.dispose()
      ringGeometry.dispose()
    },
    [dotGeometry, ringGeometry],
  )

  const dragging = useRef(false)
  /** When the last thing holding the marker up let go, on the frame clock. */
  const heldUntil = useRef(0)
  const painted = useRef(-1)
  const placed = useRef(false)
  const lastTarget = useMemo(() => new Vector3(), [])
  const scratch = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return undefined

    const start = () => {
      dragging.current = true
      invalidate()
    }
    const end = () => {
      dragging.current = false
      heldUntil.current = performance.now()
      invalidate()
    }

    controls.addEventListener('controlstart', start)
    controls.addEventListener('controlend', end)

    return () => {
      controls.removeEventListener('controlstart', start)
      controls.removeEventListener('controlend', end)
    }
  }, [controlsRef, invalidate, registered])

  useFrame(() => {
    const controls = controlsRef.current
    const node = group.current
    if (!controls || !node) return

    const now = performance.now()
    const target = controls.getTarget(scratch)

    if (!placed.current) {
      // Arriving where the pivot already is is not the pivot moving.
      placed.current = true
      lastTarget.copy(target)
      node.position.copy(target)
    } else if (!target.equals(lastTarget)) {
      lastTarget.copy(target)
      node.position.copy(target)
      heldUntil.current = Math.max(heldUntil.current, now + ORBIT_TARGET_FLASH_MS)
    }

    const opacity = dragging.current ? 1 : orbitTargetOpacity(now - heldUntil.current)

    if (opacity !== painted.current) {
      painted.current = opacity
      node.visible = opacity > 0
      if (dotMaterial.current) dotMaterial.current.opacity = opacity
      if (ringMaterial.current) ringMaterial.current.opacity = opacity * ORBIT_TARGET_RING_OPACITY
      /*
       * The fade's own engine. This viewer renders on demand, so writing an
       * opacity changes a material and repaints nothing — every step of the
       * fade has to ask for the frame that will show it, and the step that
       * reaches zero has to ask for the one that clears it.
       */
      invalidate()
    }

    // One world length per CSS pixel, so each mesh's own scale is its radius in
    // pixels and only this number moves. Recomputed while visible because
    // dollying and zooming both change it, and both happen mid-gesture.
    if (node.visible) {
      node.scale.setScalar(screenLength(camera, target, size, 1))
      ring.current?.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group ref={group} visible={false} userData={FURNITURE}>
      <mesh
        ref={ring}
        geometry={ringGeometry}
        scale={ORBIT_TARGET_RING_PIXELS}
        renderOrder={998}
        raycast={() => null}
      >
        <meshBasicMaterial
          ref={ringMaterial}
          color={ORBIT_TARGET_RING_COLOR}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        geometry={dotGeometry}
        scale={ORBIT_TARGET_PIXELS}
        renderOrder={999}
        raycast={() => null}
      >
        {/* Never depth-tested: where the pivot is has to be readable even when
            it is inside the part, which after a cursor zoom it usually is. */}
        <meshBasicMaterial
          ref={dotMaterial}
          color={ORBIT_TARGET_COLOR}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
