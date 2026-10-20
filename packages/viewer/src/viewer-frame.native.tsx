import {
  Canvas,
  type RootState,
  addAfterEffect,
  useFrame,
  useThree,
} from '@react-three/fiber/native'
import { GLView } from 'expo-gl'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties, ComponentRef, ReactNode } from 'react'
import {
  AppState,
  type GestureResponderEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import type { Material, Object3D, Texture, WebGLRenderer } from 'three'
import { SceneLabelStoreContext } from './label-context.js'
import { LabelOverlay } from './label-overlay.js'
import { type LabelStore, createLabelStore } from './render/label-store.js'
import type { ViewerTheme } from './render/theme.js'
import {
  type FingerTracker,
  type TouchOps,
  type TouchOrbit,
  type TouchPoint,
  createFingerTracker,
  createTouchOps,
  createTouchOrbit,
} from './render/touch-orbit.js'
import type { CanvasSettings } from './viewer-frame.js'

export type { CanvasSettings } from './viewer-frame.js'

interface ViewerFrameProps {
  className?: string
  style?: CSSProperties
  canvas: CanvasSettings
  labels?: ViewerTheme['labels']
  onPointerMissed?: () => void
  children: ReactNode
}

/** The touch camera's state, shared between the frame's touch handlers and the canvas. */
interface TouchState {
  fingers: FingerTracker
  orbit: TouchOrbit
  ops: TouchOps
  /** The canvas's `invalidate`, once it exists: a touch on a demand canvas asks for a frame. */
  invalidate: (() => void) | null
}

const TouchOrbitContext = createContext<TouchState | null>(null)

/** The controls' touch methods; anything else in R3F's `controls` slot is left alone. */
interface TouchControls {
  enabled: boolean
  orbitBy(dx: number, dy: number, viewportMin: number): void
  zoomAt(
    scale: number,
    at: { x: number; y: number },
    viewport: { width: number; height: number },
  ): void
  panBy(dx: number, dy: number, viewport: { width: number; height: number }): void
}

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
 * The fingers are tracked from each event's `changedTouches`, because on an
 * iPhone feeding the orbit React Native's `touches` jumped and drifted more.
 */
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

  const measure = () => {
    frame.current?.measureInWindow((x, y) => {
      origin.current = { x, y }
    })
  }

  // Touch positions are page coordinates; the frame's origin makes them local to
  // the canvas. Measured on layout only: the measurement is asynchronous, and
  // one taken mid-gesture would land between two moves and read as a jump.
  const onTouch = (kind: 'start' | 'move' | 'end' | 'cancel') => (event: GestureResponderEvent) => {
    const { touches, changedTouches } = event.nativeEvent
    const point = (finger: (typeof touches)[number]): TouchPoint => ({
      id: Number(finger.identifier),
      x: finger.pageX - origin.current.x,
      y: finger.pageY - origin.current.y,
    })
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
            onCreated={(state) => {
              presentOncePerFrame(state)
              releaseOnContextLoss(state)
            }}
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
 * a time the camera jumped. They are merged as they arrive and applied here.
 * While the controls are off — a drag owns the gesture, the section handle's —
 * they are dropped, and the orbit starts from where the fingers are when the
 * controls come back, rather than from where they were.
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
    if (ops.length === 0 || !isTouchControls(controls)) return
    if (!controls.enabled) {
      touch.orbit.reset()
      return
    }
    for (const op of ops) {
      if (op.kind === 'orbit') controls.orbitBy(op.dx, op.dy, Math.min(size.width, size.height))
      else if (op.kind === 'zoom') controls.zoomAt(op.scale, { x: op.x, y: op.y }, size)
      else controls.panBy(op.dx, op.dy, size)
    }
    invalidate()
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

/**
 * No frames while the app is not active.
 *
 * Behind Notification Centre an iPhone app is inactive but not suspended:
 * fiber's loop keeps running, iOS refuses the GPU work, and the GL view never
 * shows a new frame again, though touches still move the camera. Stopping the
 * loop while inactive and asking for a frame on the way back avoids it.
 */
const PauseWhenInactive = ({ frameloop }: { frameloop: CanvasSettings['frameloop'] }) => {
  const setFrameloop = useThree((state) => state.setFrameloop)
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setFrameloop(frameloop)
        invalidate()
      } else {
        setFrameloop('never')
      }
    })
    return () => subscription.remove()
  }, [frameloop, invalidate, setFrameloop])
  return null
}

type ExpoContext = WebGL2RenderingContext & { endFrameEXP(): void }

/**
 * The frame reaches the screen once, when it is finished.
 *
 * Fiber native presents after every `gl.render`, and the view cube's HUD is a
 * second render each frame — so every other present showed the scene without
 * the cube, and it flickered. `endFrameEXP` here only marks the frame; an
 * after-effect presents it, once, at the end of the frame.
 */
const presentOncePerFrame = (state: RootState) => {
  const context = state.gl.getContext() as ExpoContext
  const present = context.endFrameEXP.bind(context)
  let dirty = false
  context.endFrameEXP = () => {
    dirty = true
  }
  const remove = addAfterEffect(() => {
    if (!dirty) return
    dirty = false
    present()
  })
  stopPresenting.set(state.gl, remove)
}

/** The after-effect each renderer presents through, removed with the renderer's context. */
const stopPresenting = new WeakMap<WebGLRenderer, () => void>()

/**
 * Frees what the canvas holds on the GPU, once, with the canvas.
 *
 * expo-gl has no `WEBGL_lose_context`, so the context loss fiber asks for when
 * a canvas unmounts does nothing, and expo-gl's view does not destroy its
 * context on unmount either: every canvas a screen mounted kept its buffers.
 * Here, the renderer's `forceContextLoss` — the last thing fiber calls when it
 * tears a root down — disposes anything still under the scene, disposes the
 * renderer, and destroys the context. {@link ReleaseOnUnmount} disposes the
 * scene's contents before that, and calls it too, in case a fiber version
 * tears down without it.
 */
const releaseOnContextLoss = (state: RootState) => {
  const { gl, scene } = state
  const context = gl.getContext()
  let released = false
  gl.forceContextLoss = () => {
    if (released) return
    released = true
    stopPresenting.get(gl)?.()
    disposeTree(scene)
    gl.dispose()
    void GLView.destroyContextAsync(
      context as unknown as Parameters<typeof GLView.destroyContextAsync>[0],
    ).catch(() => undefined)
  }
}

/** Fiber's root teardown is done well within this, and calls `forceContextLoss` itself when it is. */
const RELEASE_FALLBACK_MS = 2000

/**
 * Disposes what the scene holds while it still holds it, and makes sure the
 * context goes.
 *
 * By the time fiber's teardown reaches `forceContextLoss` the scene is empty,
 * and what left it was not all disposed: a mesh rendered as a `<primitive>`,
 * or a geometry a cache keeps for the next mount, still had its buffers on the
 * GPU, and an emulator, at least, did not free them with the context. A layout
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

/** Disposes every geometry, material and texture under `root`, and any render target a material samples. */
const disposeTree = (root: Object3D) => {
  root.traverse((object) => {
    const { geometry, material } = object as Object3D & {
      geometry?: { dispose(): void }
      material?: Material | Material[]
    }
    geometry?.dispose()
    for (const each of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(each)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose()
      }
      const uniforms = (each as Material & { uniforms?: Record<string, { value: unknown }> })
        .uniforms
      for (const uniform of Object.values(uniforms ?? {})) {
        if ((uniform.value as Texture | null)?.isTexture) (uniform.value as Texture).dispose()
      }
      each.dispose()
    }
  })
}
