import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import type { CSSProperties, PropsWithChildren, ReactNode } from 'react'
import { Box3, Group, Vector3 } from 'three'
import { CadCameraControls } from './camera.js'
import { retargetPose } from './render/retarget.js'
import { type TapTracker, trackDoubleTaps, trackTaps } from './render/tap.js'
import { ViewerTapProvider, useTapGuard } from './tap.js'
import {
  CAD_CAMERA_UP,
  DEFAULT_FIT_MARGIN,
  PERSPECTIVE_FOV,
  type Projection,
  type SceneBounds,
  type ViewerCamera,
  applyProjection,
  boundsFromBox,
  cadViewDirections,
  cameraLimits,
  contentBounds,
  currentViewDirection,
  defaultBounds,
  fitDistance,
  startPosition,
  targetBoundary,
} from './render/camera.js'
import type { ControlScheme, ExtendedCameraControls } from './render/controls.js'
import { type ViewerTheme, resolveTheme } from './render/theme.js'
import { TargetMarker } from './target-marker.js'
import { squaredUp } from './render/view-cube.js'
import type { VectorLike, ViewerControls, ViewerHandle, ViewerView } from './types.js'

const ViewerControlsContext = createContext<ViewerControls | null>(null)

export const useViewerControls = (): ViewerControls => {
  const controls = useContext(ViewerControlsContext)
  if (!controls) throw new Error('useViewerControls must be used inside <Viewer>')
  return controls
}

/** Re-aims the orbit, or `null` when this viewer has the gesture turned off. */
export type Retarget = ((point: VectorLike) => void) | null

const ViewerRetargetContext = createContext<Retarget>(null)

/**
 * How the part reports "orbit about this from now on".
 *
 * Split this way because the two halves belong to different places: only the
 * part knows *where* the pointer landed, and it knows it from the raycast the
 * selection already ran, so nothing here casts a second ray. Only the viewer
 * knows whether the gesture is wanted, because `retargetOnDoubleClick` is its
 * prop. `null` is that answer, and it turns the pairing off at the source
 * rather than making the part detect a gesture nobody will act on.
 */
export const useRetarget = (): Retarget => useContext(ViewerRetargetContext)

interface SceneProps extends PropsWithChildren {
  setControls: (controls: ViewerControls) => void
  projection: Projection
  scheme: ControlScheme
  freeOrbit: boolean
  zoomTo: 'cursor' | 'centre'
  recentreOnDoubleClick: boolean
  retargetOnDoubleClick: boolean
  showOrbitTarget: boolean
  theme: ViewerTheme
}

const ViewerScene = ({
  children,
  setControls,
  projection,
  scheme,
  freeOrbit,
  zoomTo,
  recentreOnDoubleClick,
  retargetOnDoubleClick,
  showOrbitTarget,
  theme,
}: SceneProps) => {
  const camera = useThree((state) => state.camera) as ViewerCamera
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const domElement = useThree((state) => state.gl.domElement)
  const isTap = useTapGuard()
  const controlsRef = useRef<ExtendedCameraControls | null>(null)
  const contentRef = useRef<Group>(null)
  const lightsRef = useRef<Group>(null)
  const initialFrameComplete = useRef(false)
  const boundsRef = useRef<SceneBounds>(defaultBounds())
  /*
   * The bounds the view was last framed on, when they were smaller than the
   * scene's — `null` whenever the framing is the whole part.
   *
   * The limits are derived from it as well as from the scene (see
   * {@link applyLimits}), and they are re-derived on every resize. Without
   * somewhere to keep this, that re-derivation narrowed the band back to the
   * scene's and undid the framing's widening: the next wheel notch snapped an
   * orthographic zoom back to 10× and dollied a perspective camera outward,
   * against the gesture. A resize is a window drag, a panel opening, a sidebar
   * toggle — not something the consumer connects to the view jumping.
   */
  const framedRef = useRef<SceneBounds | null>(null)
  const scratchBox = useMemo(() => new Box3(), [])
  const scratchBoundary = useMemo(() => new Box3(), [])
  const scratchDirection = useMemo(() => new Vector3(), [])
  const scratchView = useMemo(() => new Vector3(), [])
  const scratchTarget = useMemo(() => new Vector3(), [])
  const scratchPosition = useMemo(() => new Vector3(), [])

  /**
   * How far the wheel may travel, for the bounds the scene currently has.
   *
   * Applied here rather than once at mount because the limits are derived from
   * the part: a viewer that loads a second part, or is resized under a
   * perspective camera, would otherwise keep the first framing's idea of far.
   *
   * `framed` widens the band to take in a view framed on something smaller than
   * the scene; see {@link cameraLimits}. The target boundary stays on the
   * scene's bounds either way — what the wheel may reach is a question about the
   * framing, but where the part is remains a question about the part, and
   * confining the target to a box around a framed feature would strand somebody
   * who framed one and then tried to pan off it.
   */
  const applyLimits = useCallback(
    (bounds: SceneBounds, framed?: SceneBounds) => {
      controlsRef.current?.applyLimits(
        cameraLimits(projection, size, bounds, DEFAULT_FIT_MARGIN, framed),
        targetBoundary(bounds, scratchBoundary, DEFAULT_FIT_MARGIN),
      )
    },
    [projection, scratchBoundary, size],
  )

  /**
   * The bounds of whatever the consumer put in the scene, grid and axes aside.
   *
   * A measurement and nothing else. It used to apply the limits too, which put
   * a `setBoundary` — and so a `CameraControls` update — at the top of `frame`,
   * *before* the look-at that frame exists to perform. Every update re-derives
   * the up vector under free orbit, so that one ran against the pose the frame
   * was about to replace and rolled the camera off `CAD_CAMERA_UP` for good.
   * The limits now go on after the pose is set; see {@link frame}.
   */
  const measure = useCallback((): SceneBounds => {
    const content = contentRef.current
    boundsRef.current = content ? contentBounds(content, scratchBox) : defaultBounds()
    return boundsRef.current
  }, [scratchBox])

  /**
   * Frames the content from `direction`, sizing the frustum to it first.
   *
   * The frustum is derived from the bounds rather than from the camera's
   * distance, so orbiting and dollying afterwards never need it recomputed.
   *
   * `up` squares the view: a named view or a cube panel is a request for a
   * standard orientation, and free orbit re-derives the up vector from the
   * pose it is leaving, so without one the roll built up by dragging survives
   * the jump and the part arrives at the right angle but tilted. Which of the
   * four square rolls to use is the caller's to choose — see `squaredUp`. Fit
   * and Zoom to omit it on purpose: they keep the orientation they were given.
   */
  const frame = useCallback(
    (direction: Vector3, transition = false, up?: VectorLike): boolean => {
      const controls = controlsRef.current
      if (!controls) return false

      const bounds = measure()
      applyProjection(camera, size, bounds, DEFAULT_FIT_MARGIN)

      const distance = fitDistance(projection, size, bounds, DEFAULT_FIT_MARGIN)
      const position = scratchDirection.copy(direction).normalize().multiplyScalar(distance)
      position.add(bounds.center)

      if (up) {
        // Before the look-at, so its basis is built from the squared up rather
        // than corrected afterwards by a second camera move.
        camera.up.set(up.x, up.y, up.z)
        controls.updateCameraUp()
      }

      void controls.setLookAt(
        position.x,
        position.y,
        position.z,
        bounds.center.x,
        bounds.center.y,
        bounds.center.z,
        transition,
      )
      // The orthographic frustum is already sized to the bounds, so anything
      // the wheel did to zoom would otherwise survive a Fit.
      if (projection === 'orthographic') void controls.zoomTo(1, transition)

      // This framing is the whole scene, so there is no widening left to carry
      // across a resize.
      framedRef.current = null

      // Last, because applying them moves the controls: `setBoundary` marks
      // them for update, and an update under free orbit re-derives the up
      // vector from whatever the camera is looking at *now*. Ahead of the
      // look-at that is the outgoing pose, and the roll it leaves behind
      // survives into this frame.
      applyLimits(bounds)

      invalidate()
      return true
    },
    [applyLimits, camera, invalidate, measure, projection, scratchDirection, size],
  )

  /**
   * Frames bounds other than the whole part's, from where the camera already
   * is. The frustum still comes from the *scene's* bounds rather than these, so
   * a feature framed up close does not clip the part around it.
   *
   * The limits are re-derived about this framing before the zoom that reaches
   * it, because otherwise they refuse it. `zoomTo` clamps to `maxZoom`, so
   * framing a 3 mm hole in a 100 mm plate asked for about 37× and silently got
   * the wheel's 10× — a quarter of the size requested, reported as success. The
   * perspective half failed the other way round: `setLookAt` writes the distance
   * without consulting `minDistance` while the wheel's own dolly clamps to it,
   * so a close framing stood until the first notch and then jumped *outward*,
   * away from the direction of the gesture.
   */
  const frameBounds = useCallback(
    (bounds: SceneBounds): boolean => {
      const controls = controlsRef.current
      if (!controls) return false

      const target = controls.getTarget(new Vector3())
      const direction = currentViewDirection(camera, target, new Vector3())
      const distance = fitDistance(projection, size, bounds, DEFAULT_FIT_MARGIN)
      const position = direction.multiplyScalar(distance).add(bounds.center)

      void controls.setLookAt(
        position.x,
        position.y,
        position.z,
        bounds.center.x,
        bounds.center.y,
        bounds.center.z,
        true,
      )

      // After the look-at, for the reason `frame` applies its own limits last —
      // applying them updates the controls, and an update under free orbit
      // re-derives the up vector from the pose the camera is looking at now.
      // Before the `zoomTo`, because that is the call being clamped. Kept, so
      // a later resize re-derives the same widened band rather than the
      // scene's; see {@link framedRef}.
      framedRef.current = bounds
      applyLimits(boundsRef.current, bounds)

      if (projection === 'orthographic') {
        void controls.zoomTo(boundsRef.current.radius / bounds.radius, true)
      }

      invalidate()
      return true
    },
    [applyLimits, camera, invalidate, projection, size],
  )

  const fitContent = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return false
    const target = controls.getTarget(new Vector3())
    return frame(currentViewDirection(camera, target, new Vector3()), true)
  }, [camera, frame])

  /**
   * The opening pose, and the way back to it.
   *
   * It squares the up vector, which Fit deliberately does not: Fit keeps the
   * orientation it was given, and a reset is a request for the standard one.
   * `CAD_CAMERA_UP` rather than {@link squaredUp} because a start direction is
   * a three-quarter view rather than an axis, so there is no square roll to
   * pick — Z-up is the orientation the part data is authored in, and the
   * frame's own look-at is what turns it into a roll.
   *
   * Without this a roll had no way back. The up vector is re-derived from the
   * view on every controls update, which makes it path-dependent, so any pose
   * the camera passed through on the way here is still in it. Reset is where
   * that history is meant to end, and the legacy viewer squares it here for
   * the same reason (`three-object.tsx` `resetCameraPose`).
   */
  const resetContent = useCallback(() => {
    const bounds = measure()
    const start = startPosition(projection, size, bounds).sub(bounds.center)
    return frame(start, true, CAD_CAMERA_UP)
  }, [frame, measure, projection, size])

  /**
   * Orbit about this from now on.
   *
   * Called with a point on the part, from the raycast the pick already ran.
   * `retargetPose` decides where the camera and the target go.
   *
   * The transition flag is passed, but the move arrives immediately: these
   * controls run at `DEFAULT_SMOOTH_TIME` (0.001), which settles a transition
   * inside a single frame at any frame rate this renders at. The flag is kept
   * because it is what the call means and because it would ease if the damping
   * were ever raised — not because anything eases today. `showOrbitTarget` is
   * what makes the pivot moving visible; a move this fast cannot say it itself.
   *
   * It does not re-frame and it does not square the roll. Somebody asking to
   * orbit about a corner is not asking to be shown the whole part again, and
   * Fit is one gesture away on the middle button if they were.
   */
  const retarget = useCallback(
    (point: VectorLike) => {
      const controls = controlsRef.current
      if (!controls) return

      /*
       * `getPosition`, not `camera.position`. Both accessors return the
       * controls' *end* value, so the pair describes one pose; `camera.position`
       * is where the camera has got to so far, and pairing that with an end
       * target subtracts two halves of different poses. In any frame where an
       * earlier `setLookAt` has not finished settling, the offset
       * `retargetPose` is asked to preserve is wrong by whatever is left of
       * that move, and the view shifts instead of holding the angle and
       * distance it had. At `DEFAULT_SMOOTH_TIME` that is a one-frame window
       * rather than the length of an animation, which makes it rare and not
       * less wrong.
       */
      const pose = retargetPose(
        controls.getPosition(scratchPosition),
        controls.getTarget(scratchTarget),
        point,
      )
      void controls.setLookAt(
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
        true,
      )
      invalidate()
    },
    [invalidate, scratchPosition, scratchTarget],
  )

  /*
   * `null` rather than a function that does nothing, so the part can tell the
   * gesture is off and skip the work of moving the camera. The tap pairing runs
   * either way and the pick always fires — a paired click just arrives marked
   * `doubled` and re-aims nothing.
   */
  const retargetOn = useMemo(
    () => (retargetOnDoubleClick ? retarget : null),
    [retarget, retargetOnDoubleClick],
  )

  /**
   * Double **middle** click puts the part back in the middle.
   *
   * The way out of having zoomed into a corner and lost the rest of it — which
   * zooming to the cursor makes easy to do, so the two belong together. It
   * keeps the view direction and only re-frames, because it is "show me all of
   * this", not "start again".
   *
   * On the middle button, because the left one is spoken for: double left click
   * is "orbit about this from now on", which is where a viewer usually puts it
   * and where `retargetOnDoubleClick` now does. Assembled from `auxclick` by
   * hand, because `dblclick` fires for the primary button only, so there is no
   * middle-button double-click event to listen to.
   *
   * On the canvas rather than on the mesh: the gesture has to work on empty
   * space too, which is exactly where somebody reaches for it.
   */
  useEffect(() => {
    if (!recentreOnDoubleClick) return undefined

    const doubles = trackDoubleTaps()
    const recentre = (event: MouseEvent) => {
      if (event.button !== 1) return

      // The end of a pan is not a request to re-frame. The middle button is
      // TRUCK, so *every* pan ends in an `auxclick` here — and two quick pans
      // that happen to be released within the slop of each other, panning out
      // and back being the obvious one, read as a double and threw away the
      // pan just made. The same guard the left button gets on the mesh.
      if (!isTap(event)) return

      if (doubles.isDouble(event)) fitContent()
    }

    domElement.addEventListener('auxclick', recentre)
    return () => domElement.removeEventListener('auxclick', recentre)
  }, [domElement, fitContent, isTap, recentreOnDoubleClick])

  useEffect(() => {
    setControls({
      fit: () => {
        fitContent()
      },
      reset: () => {
        resetContent()
      },
      setView: (view) => {
        frame(cadViewDirections[view], true, squaredUp(cadViewDirections[view], camera.up))
      },
      setViewDirection: (direction) => {
        frame(
          scratchView.set(direction.x, direction.y, direction.z),
          true,
          squaredUp(direction, camera.up),
        )
      },
      frameBox: (box) => {
        frameBounds(boundsFromBox(box))
      },
    })
  }, [camera, fitContent, frame, frameBounds, resetContent, scratchView, setControls])

  /*
   * Reframe when the projection changes: a perspective distance and an
   * orthographic frustum are not interchangeable.
   *
   * This resets the *view direction* too, back to that projection's
   * `START_DIRECTION`, and that is on purpose rather than an oversight — the
   * two start directions differ because the two cameras read a part
   * differently. Worth knowing: `Canvas key={projection}` rebuilds the whole
   * context, so a switch would arrive at the start position even if this effect
   * did nothing. Preserving the pose across the switch means carrying it out
   * through the teardown, which is a change worth making deliberately rather
   * than by making this effect cleverer.
   */
  useEffect(() => {
    if (initialFrameComplete.current) resetContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection])

  /*
   * Keep the frustum matched to the viewport without moving the camera. The
   * limits go with it: under a perspective camera `fitDistance` depends on the
   * aspect, so a resize changes how far "all of it" is.
   *
   * The limits wait for the opening frame. Before it, `boundsRef` is
   * `defaultBounds()` — a unit sphere at the origin — and this effect runs on
   * mount, so a part sitting anywhere else was given a target boundary a few
   * millimetres wide around a point it does not contain. That moves the
   * controls, and a controls update re-derives the up vector, so the camera was
   * rolled before it had ever been framed. The frustum still tracks the
   * viewport throughout, which is what stops a degenerate aspect.
   */
  useEffect(() => {
    applyProjection(camera, size, boundsRef.current, DEFAULT_FIT_MARGIN)
    if (initialFrameComplete.current) applyLimits(boundsRef.current, framedRef.current ?? undefined)
    invalidate()
  }, [applyLimits, camera, invalidate, size])

  /**
   * The light rig turns with the camera, so a part is lit the same way from
   * every angle.
   *
   * Fixed to the world, the lighting is physically honest and practically
   * useless: a face that starts in shadow stays in shadow however the view is
   * orbited, so the only way to see it is to guess which way to turn the part
   * that is not turning.
   */
  useFrame(() => {
    const lights = lightsRef.current
    if (lights && !lights.quaternion.equals(camera.quaternion)) {
      lights.quaternion.copy(camera.quaternion)
      invalidate()
    }
  })

  // A Suspense-loaded mesh does not exist during the first effect, so the
  // opening frame waits for something to actually be in the scene.
  useFrame(() => {
    if (!initialFrameComplete.current && contentRef.current?.children.length) {
      initialFrameComplete.current = resetContent()
    }
  })

  return (
    <ViewerTapProvider value={isTap}>
      <ViewerRetargetContext.Provider value={retargetOn}>
        <group ref={lightsRef}>
          <ambientLight color={theme.ambient} intensity={theme.ambientIntensity} />
          <hemisphereLight
            args={[theme.hemisphereSky, theme.hemisphereGround, theme.hemisphereIntensity]}
          />
        </group>
        <group ref={contentRef}>{children}</group>
        <CadCameraControls
          controlsRef={controlsRef}
          scheme={scheme}
          freeOrbit={freeOrbit}
          zoomTo={zoomTo}
        />
        {/* After the controls, so its effect finds `controlsRef` filled. */}
        {showOrbitTarget ? <TargetMarker controlsRef={controlsRef} /> : null}
      </ViewerRetargetContext.Provider>
    </ViewerTapProvider>
  )
}

export interface ViewerProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /**
   * **Orthographic by default.** It is what a machinist reads a part in:
   * parallel edges stay parallel, so a wall that looks square is square, and
   * two features the same size measure the same size wherever they sit.
   *
   * Perspective is the better answer for reading a deep pocket *as* depth, and
   * is one prop away.
   */
  projection?: Projection
  /**
   * `toolpath` — left-drag orbits, right-drag pans. `fusion` — middle-drag and
   * two-finger scroll pan, shift makes them orbit, pinch zooms; it matches
   * Fusion 360, which is what most users have open in the other window.
   */
  controls?: ControlScheme
  /** Orbit past the poles instead of stopping there. On by default. */
  freeOrbit?: boolean
  /**
   * What the wheel zooms toward: the pointer, or the middle of the view.
   *
   * `cursor` by default, which is what Fusion does and what most people reach
   * for. It is a preference rather than a right answer — on a trackpad it can
   * walk the model off screen.
   */
  zoomTo?: 'cursor' | 'centre'
  /**
   * Whether a double **middle** click re-frames the part. On by default — it is
   * the way back from having zoomed into a corner, which zooming to the cursor
   * makes easy to do.
   */
  recentreOnDoubleClick?: boolean
  /**
   * Whether a double **left** click on the part orbits about what was clicked
   * from then on. On by default.
   *
   * The clicked point moves to the middle of the view at the same size and
   * angle, and stays the pivot until something else moves it. It is how you get
   * from "the whole part" to "this corner" without losing the ability to turn
   * what you are looking at — and under an orthographic camera it is the only
   * gesture that re-aims the pivot at all, because the wheel there scales a
   * frustum rather than travelling toward anything.
   *
   * The move is immediate rather than eased: the damping these controls ship
   * with settles a transition inside one frame. Turn on {@link showOrbitTarget}
   * if the pivot moving needs to be visible.
   *
   * The click is still a click. Its pick arrives with `doubled: true` on it, so
   * an app that wants a double click to mean something of its own can say so,
   * and one that would rather a double click left the selection alone can
   * ignore it. What the viewport claims is the *view*, not the pick.
   */
  retargetOnDoubleClick?: boolean
  /**
   * Whether to show two small circles at the orbit target — the point the view
   * turns and zooms about. **Off by default.**
   *
   * They are up while a gesture is running and flash when the pivot moves on
   * its own: a cursor zoom walking it, a double click re-aiming it, a Fit
   * putting it back. Then they fade. It answers "why did the part swing that
   * way", which nothing else on screen does, and it is what makes a wheel that
   * has carried the pivot off the part legible while it is happening rather
   * than after.
   *
   * Off by default because it is an aid rather than furniture: a viewer that
   * grew a dot in the middle of every screenshot would be a surprise to anybody
   * already rendering with this.
   */
  showOrbitTarget?: boolean
  /** Lighting and background. The part's own colours are tuned against this rig. */
  theme?: Partial<ViewerTheme>
  /**
   * A click that hit nothing in the scene — not the part, not an arrow, not a
   * section handle. The usual meaning is "put the selection down".
   */
  onPointerMissed?: () => void
}

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  {
    children,
    className,
    style,
    projection = 'orthographic',
    controls = 'toolpath',
    freeOrbit = true,
    zoomTo = 'cursor',
    recentreOnDoubleClick = true,
    retargetOnDoubleClick = true,
    showOrbitTarget = false,
    theme,
    onPointerMissed,
  },
  ref,
) {
  const actionsRef = useRef<ViewerControls | null>(null)
  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const proxy = useMemo<ViewerControls>(
    () => ({
      fit: () => actionsRef.current?.fit(),
      reset: () => actionsRef.current?.reset(),
      setView: (view: ViewerView) => actionsRef.current?.setView(view),
      setViewDirection: (direction) => actionsRef.current?.setViewDirection(direction),
      frameBox: (box) => actionsRef.current?.frameBox(box),
    }),
    [],
  )
  useImperativeHandle(ref, () => proxy, [proxy])
  const setControls = useCallback((next: ViewerControls) => {
    actionsRef.current = next
  }, [])

  // Watched on the wrapper rather than the canvas: `onPointerMissed` is the
  // Canvas's own prop, and this side of it has no hooks into the scene.
  const tracker = useRef<TapTracker | null>(null)
  const hold = useCallback((element: HTMLDivElement | null) => {
    tracker.current?.dispose()
    tracker.current = element ? trackTaps(element) : null
  }, [])

  return (
    <ViewerControlsContext.Provider value={proxy}>
      {/*
        Orbiting the part does not take focus off whatever had it.

        Pressing on a canvas moves focus to the document body, and the lists
        beside the part are walked with the arrow keys from a focused row — so
        one orbit to look at what a row was pointing at ended the walk, and the
        arrows quietly did nothing afterwards.

        `mousedown` rather than `pointerdown`: the default action of a mousedown
        *is* the focus change, and the controls listen on pointer events, so
        this takes the focus behaviour without touching the gesture. Nothing
        here needs the canvas focused — every control is a real element beside
        it.
      */}
      <div
        className={className}
        ref={hold}
        onMouseDown={(event) => {
          if (event.target instanceof HTMLCanvasElement) event.preventDefault()
        }}
        style={{ height: '100%', width: '100%', ...style }}
      >
        <Canvas
          key={projection}
          orthographic={projection === 'orthographic'}
          camera={{ fov: PERSPECTIVE_FOV, up: [0, 0, 1], position: [1, -1, 1] }}
          dpr={[1, 2]}
          frameloop="demand"
          // `stencil` is off by default in three, and the section cap is a
          // stencil trick — without it the cut still happens and the part just
          // looks hollow. `localClippingEnabled` is what lets a material carry
          // its own clipping plane rather than the whole scene sharing one.
          gl={{ antialias: true, alpha: true, stencil: true, localClippingEnabled: true }}
          // Two guards, and both are about gestures that are not a click.
          //
          // Only the primary button puts a selection down. R3F treats
          // `contextmenu` as a click, and the browser sends that the instant a
          // right button goes down — before any movement — so a pan cleared
          // the selection at the moment it started, whatever it did next.
          //
          // And an orbit that ends over empty space is not somebody letting go
          // of what they were orbiting to look at.
          onPointerMissed={(event) => {
            if (event.button !== 0) return
            if (tracker.current?.isTap(event) ?? true) onPointerMissed?.()
          }}
        >
          <ViewerScene
            setControls={setControls}
            projection={projection}
            scheme={controls}
            freeOrbit={freeOrbit}
            zoomTo={zoomTo}
            recentreOnDoubleClick={recentreOnDoubleClick}
            retargetOnDoubleClick={retargetOnDoubleClick}
            showOrbitTarget={showOrbitTarget}
            theme={resolved}
          >
            {children}
          </ViewerScene>
        </Canvas>
      </div>
    </ViewerControlsContext.Provider>
  )
})
