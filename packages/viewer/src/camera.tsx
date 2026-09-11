import { type RootState, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import { CAD_CAMERA_UP, type ViewerCamera } from './render/camera.js'
import { type ControlScheme, ExtendedCameraControls } from './render/controls.js'

export interface CadCameraControlsProps {
  /** Filled with the controls once they exist, for imperative framing. */
  controlsRef: RefObject<ExtendedCameraControls | null>
  scheme?: ControlScheme
  /**
   * Orbit past the poles instead of stopping there. On by default: a CAD view
   * that sticks when it reaches straight-down is the single most-reported thing
   * about an orbit control.
   */
  freeOrbit?: boolean
  /**
   * What the wheel zooms toward: the pointer, or the middle of the view.
   *
   * Fusion and SolidWorks zoom to the cursor and most people expect it — you
   * point at the corner you want and lean in. It is not universally liked: on a
   * trackpad it can walk the model off screen, which is why the other one
   * stays.
   */
  zoomTo?: 'cursor' | 'centre'
}

/**
 * Mounts `camera-controls` against the R3F camera and canvas.
 *
 * `frameloop="demand"` means no frame runs unless something asks for one, so
 * the controls' own `control` and `update` events drive `invalidate` — without
 * that the view would move only when React happened to render. The controls are
 * also registered as R3F's default `controls`, which is how anything else in
 * the scene reaches the orbit target.
 */
export const CadCameraControls = ({
  controlsRef,
  scheme = 'toolpath',
  freeOrbit = true,
  zoomTo = 'cursor',
}: CadCameraControlsProps) => {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const set = useThree((state) => state.set)

  const controls = useMemo(
    () => new ExtendedCameraControls(camera as ViewerCamera, domElement, { freeOrbit }),
    // `freeOrbit` is the constructor's initial value only; the effect below
    // owns it from then on, and rebuilding the controls would drop the pose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera, domElement],
  )

  useEffect(() => {
    controlsRef.current = controls
    // `camera-controls` derives its frame of reference from the camera's up
    // vector and caches it, so the part data's Z-up is declared here rather
    // than left to whenever R3F gets round to applying the camera props.
    camera.up.copy(CAD_CAMERA_UP)
    controls.updateCameraUp()
    controls.attach()
    const request = () => invalidate()
    controls.addEventListener('control', request)
    controls.addEventListener('update', request)
    invalidate()

    return () => {
      controls.removeEventListener('control', request)
      controls.removeEventListener('update', request)
      controls.dispose()
      if (controlsRef.current === controls) controlsRef.current = null
    }
  }, [camera, controls, controlsRef, invalidate])

  useEffect(() => {
    // R3F types this slot as three's own EventDispatcher; `camera-controls`
    // implements the same interface with its own event map, which does not
    // structurally match. Anything reading the slot goes through a capability
    // check, so the cast costs nothing at runtime.
    set({ controls: controls as unknown as NonNullable<RootState['controls']> })
    return () => set({ controls: null })
  }, [controls, set])

  useEffect(() => {
    controls.applyScheme(scheme)
  }, [controls, scheme])

  useEffect(() => {
    controls.setFreeOrbit(freeOrbit)
  }, [controls, freeOrbit])

  useEffect(() => {
    /*
     * `camera-controls` reads this on the next wheel event rather than caching
     * it, so setting it on the live controls is enough — no rebuild, and the
     * pose survives the switch.
     *
     * Nothing is reset alongside it, and that is a decision rather than an
     * omission. Two candidate resets were measured against a real part and both
     * are wrong here:
     *
     * - **The focal offset.** The legacy viewer clears it before flipping this
     *   flag (`three-object.tsx:621-631`), because zoom-to-cursor there
     *   accumulated an offset and leaving it behind held the view permanently
     *   off-centre. `camera-controls` 3.1.0 anchors by moving the *target*
     *   instead, so there is no offset to accumulate: `getFocalOffset` reads
     *   (0, 0, 0) through every cursor zoom, in both projections, clamped and
     *   unclamped. The port would clear a value that is already zero.
     *
     * - **The orbit target.** That is the symptom legacy was really treating —
     *   a cursor zoom leaves the target on the last point zoomed at, which for
     *   a 50 mm cube is a few millimetres off its corner. But the camera always
     *   looks at the target, so the target is always the exact middle of the
     *   screen; projecting it lands on (0, 0) at every stage of a zoom, an
     *   orbit and a flip. There is therefore no such thing as a silent
     *   re-target: moving it pans the part, and a preference toggle that moves
     *   the view is worse than a pivot sitting just off the part.
     *
     * So flipping this changes what the next wheel gesture does and nothing
     * else. Putting the pivot back on the part belongs to a gesture that asks
     * for it — Fit, or a double click on the face you want.
     */
    controls.dollyToCursor = zoomTo === 'cursor'
  }, [controls, zoomTo])

  useFrame((_, delta) => {
    controls.update(delta)
  })

  return null
}
