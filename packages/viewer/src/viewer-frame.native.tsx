import {
  Canvas,
  type RootState,
  addAfterEffect,
  useFrame,
  useStore,
  useThree,
} from '@react-three/fiber/native'
import { GLView } from 'expo-gl'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import {
  AppState,
  type GestureResponderEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import { SceneLabelStoreContext } from './label-context.js'
import { LabelOverlay } from './label-overlay.js'
import { type LabelStore, createLabelStore } from './render/label-store.js'
import { createPresenter, createRelease, disposeTree } from './render/native-gl.js'
import { pauseWhileInactive } from './render/pause-inactive.js'
import {
  type FingerTracker,
  type TouchOps,
  type TouchOrbit,
  type TouchControls,
  type TouchPoint,
  applyTouchOps,
  createFingerTracker,
  createTouchOps,
  createTouchOrbit,
  localPoint,
} from './render/touch-orbit.js'
import type { CanvasSettings, ViewerFrameProps } from './viewer-frame.js'

export type { CanvasSettings, ViewerFrameProps } from './viewer-frame.js'

/** The touch camera's state, shared between the frame's touch handlers and the canvas. */
interface TouchState {
  fingers: FingerTracker
  orbit: TouchOrbit
  ops: TouchOps
  /** The canvas's `invalidate`, once it exists: a touch on a demand canvas asks for a frame. */
  invalidate: (() => void) | null
}

const TouchOrbitContext = createContext<TouchState | null>(null)

/** Anything in R3F's `controls` slot without the touch methods is left alone. */
const isTouchControls = (controls: unknown): controls is TouchControls =>
  typeof (controls as TouchControls | null)?.orbitBy === 'function'

/**
 * React Native's `ViewerFrame`: a `View` around fiber's native `Canvas`.
 *
 * The web frame is about the page; this one is about the phone. It owns the
 * camera's touch input — the canvas has no DOM element for camera-controls to
 * listen on — and draws `SceneLabel`s over the canvas, since there is no DOM
 * for them either.
 *
 * Touches are read by observing them on this `View` rather than by taking the
 * responder: fiber's own `PanResponder`, inside the canvas, keeps the gesture
 * for picking, taps and the section handle's drag, and still sees every touch.
 * The fingers are tracked from each event's `changedTouches`, not its
 * `touches` (see `createFingerTracker`).
 */
// `webglUnavailable` is never shown: expo-gl always creates a context, so
// there is nothing to probe.
export const ViewerFrame = ({
  style,
  canvas,
  labels,
  onPointerMissed,
  children,
}: ViewerFrameProps) => {
  const store = useMemo(() => createLabelStore(), [])
  const touch = useMemo<TouchState>(
    () => ({
      fingers: createFingerTracker(),
      orbit: createTouchOrbit(),
      ops: createTouchOps(),
      invalidate: null,
    }),
    [],
  )
  const frame = useRef<ComponentRef<typeof View>>(null)
  const origin = useRef({ x: 0, y: 0 })

  // An ancestor can move — a sheet sliding, a scroll — without the frame's
  // own layout changing, so the origin is measured again as each gesture
  // starts as well as on layout. The measurement is asynchronous: if it moved
  // the origin, the orbit starts afresh from the fingers' next positions
  // rather than reading the change as a jump.
  const measure = () => {
    frame.current?.measureInWindow((x, y) => {
      const moved = x !== origin.current.x || y !== origin.current.y
      origin.current = { x, y }
      if (moved) touch.orbit.reset()
    })
  }

  // Touch positions are page coordinates; the frame's origin makes them local to
  // the canvas.
  const onTouch = (kind: 'start' | 'move' | 'end' | 'cancel') => (event: GestureResponderEvent) => {
    const { touches, changedTouches } = event.nativeEvent
    if (kind === 'start' && touches.length === changedTouches.length) measure()
    const point = (finger: (typeof touches)[number]): TouchPoint =>
      localPoint(finger, origin.current)
    const fingers = touch.fingers.update(kind, changedTouches.map(point), touches.map(point))
    const ops = touch.orbit.update(fingers)
    if (ops.length === 0) return
    touch.ops.push(ops)
    touch.invalidate?.()
  }

  return (
    <View
      ref={frame}
      style={[{ flex: 1 }, style as StyleProp<ViewStyle>]}
      onLayout={measure}
      onTouchStart={onTouch('start')}
      onTouchMove={onTouch('move')}
      onTouchEnd={onTouch('end')}
      onTouchCancel={onTouch('cancel')}
    >
      <SceneLabelStoreContext.Provider value={store}>
        <TouchOrbitContext.Provider value={touch}>
          <Canvas
            key={canvas.projection}
            orthographic={canvas.projection === 'orthographic'}
            camera={canvas.camera}
            gl={canvas.gl}
            frameloop={canvas.frameloop}
            // Fiber already ignores a press that moved, so a miss is a miss.
            onPointerMissed={onPointerMissed ? () => onPointerMissed() : undefined}
            onCreated={releaseWithTheCanvas}
          >
            {/* First, so it is torn down before anything below it leaves the scene. */}
            <ReleaseOnUnmount />
            {children}
            <TouchBridge />
            <LabelProjector store={store} />
            <PauseWhenInactive frameloop={canvas.frameloop} />
          </Canvas>
        </TouchOrbitContext.Provider>
      </SceneLabelStoreContext.Provider>
      <LabelOverlay store={store} theme={labels} />
    </View>
  )
}

/**
 * Applies the touch camera's operations, once a frame.
 *
 * Touch events arrive faster than frames, and in bursts; applied one event at
 * a time the camera jumped. They are merged as they arrive and applied here,
 * through `applyTouchOps`.
 */
const TouchBridge = () => {
  const touch = useContext(TouchOrbitContext)
  const controls = useThree((state) => state.controls)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!touch) return undefined
    touch.invalidate = () => invalidate()
    return () => {
      touch.invalidate = null
    }
  }, [invalidate, touch])

  useFrame(() => {
    if (!touch) return
    const ops = touch.ops.take()
    if (!isTouchControls(controls)) return
    if (applyTouchOps(ops, controls, size, touch.orbit)) invalidate()
  })

  return null
}

/** Projects the labels for this frame's camera, after the camera has moved for it. */
const LabelProjector = ({ store }: { store: LabelStore }) => {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  useFrame(() => {
    camera.updateMatrixWorld()
    store.project(camera, size)
  })
  return null
}

/** No frames while the app is not active: see `pauseWhileInactive`. */
const PauseWhenInactive = ({ frameloop }: { frameloop: CanvasSettings['frameloop'] }) => {
  const store = useStore()
  useEffect(() => pauseWhileInactive(AppState, store, frameloop), [frameloop, store])
  return null
}

type ExpoContext = WebGL2RenderingContext & { endFrameEXP(): void }

/**
 * Presents each frame once (`createPresenter`), and makes the renderer's
 * `forceContextLoss` free everything the canvas holds on the GPU
 * (`createRelease`): expo-gl's own context loss does nothing.
 */
const releaseWithTheCanvas = ({ gl, scene }: RootState) => {
  const context = gl.getContext() as ExpoContext
  gl.forceContextLoss = createRelease({
    gl,
    scene,
    stopPresenting: createPresenter(context, addAfterEffect),
    destroy: () => {
      void GLView.destroyContextAsync(
        context as unknown as Parameters<typeof GLView.destroyContextAsync>[0],
      ).catch(() => undefined)
    },
  })
}

/** Fiber's root teardown is done well within this, and calls `forceContextLoss` itself when it is. */
const RELEASE_FALLBACK_MS = 2000

/**
 * Disposes what the scene holds while it still holds it, and makes sure the
 * context goes.
 *
 * By the time fiber's teardown reaches `forceContextLoss` the scene is empty,
 * and what left it was not all disposed: a mesh rendered as a `<primitive>`,
 * or a geometry a cache keeps for the next mount, still has its buffers on the
 * GPU, and a context's destruction is not guaranteed to free them. A layout
 * effect's cleanup on the canvas's first child runs before anything after it
 * leaves the scene. Disposing only frees GPU memory: a geometry kept for
 * reuse uploads again the next time it is drawn.
 */
const ReleaseOnUnmount = () => {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => () => disposeTree(scene), [scene])

  useEffect(() => {
    // An effect run again without an unmount between — React's StrictMode
    // does this — is still the same live canvas.
    if (pending.current) clearTimeout(pending.current)
    pending.current = null
    return () => {
      pending.current = setTimeout(() => gl.forceContextLoss(), RELEASE_FALLBACK_MS)
    }
  }, [gl])
  return null
}
