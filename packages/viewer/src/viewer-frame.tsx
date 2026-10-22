import { Canvas, type CanvasProps } from '@react-three/fiber'
import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Projection } from './render/camera.js'
import { type TapTracker, trackTaps } from './render/tap.js'
import { webGLAvailableSnapshot } from './render/webgl.js'
import { WebGLUnavailable } from './webgl-unavailable.js'

/** What `<Viewer>` asks of its canvas, whichever frame draws it. */
export interface CanvasSettings {
  projection: Projection
  camera: NonNullable<CanvasProps['camera']>
  gl: NonNullable<CanvasProps['gl']>
  frameloop: NonNullable<CanvasProps['frameloop']>
}

export interface ViewerFrameProps {
  className?: string
  style?: CSSProperties
  canvas: CanvasSettings
  onPointerMissed?: () => void
  /** `<Viewer>`'s `webglUnavailable`: shown in place of the canvas without WebGL. */
  webglUnavailable?: ReactNode
  children: ReactNode
}

// Support does not change while the page is open, so there is nothing to subscribe to.
const subscribeNever = () => () => {}

/**
 * The element `<Viewer>` draws into: on the web, a wrapper `<div>` around
 * R3F's DOM canvas.
 *
 * Everything here is about the page around the canvas — the classes and data
 * hooks applications style, the focus the canvas must not take, and which
 * clicks count as a miss. The scene inside is the same on every platform.
 */
export const ViewerFrame = ({
  className,
  style,
  canvas,
  onPointerMissed,
  webglUnavailable,
  children,
}: ViewerFrameProps) => {
  // The server assumes WebGL, so its markup hydrates as the canvas; a blocked
  // browser then re-renders into the alert.
  const webglAvailable = useSyncExternalStore(subscribeNever, webGLAvailableSnapshot, () => true)
  // Watched on the wrapper rather than the canvas: `onPointerMissed` is the
  // Canvas's own prop, and this side of it has no hooks into the scene.
  const tracker = useRef<TapTracker | null>(null)
  const hold = useCallback((element: HTMLDivElement | null) => {
    tracker.current?.dispose()
    tracker.current = element ? trackTaps(element) : null
  }, [])

  return (
    /*
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
    */
    <div
      className={['viewer-root', className].filter(Boolean).join(' ')}
      data-viewer-root="true"
      ref={hold}
      onMouseDown={(event) => {
        if (event.target instanceof HTMLCanvasElement) event.preventDefault()
      }}
      style={{ height: '100%', width: '100%', ...style }}
    >
      {webglAvailable ? (
        <Canvas
          className="viewer-canvas-container"
          data-viewer-canvas-container="true"
          key={canvas.projection}
          orthographic={canvas.projection === 'orthographic'}
          camera={canvas.camera}
          dpr={[1, 2]}
          frameloop={canvas.frameloop}
          gl={canvas.gl}
          onCreated={({ gl }) => {
            const element = gl.domElement
            element.classList.add('viewer-canvas')
            element.dataset.viewerCanvas = 'true'
            element.parentElement?.classList.add('viewer-canvas-frame')
            element.parentElement?.setAttribute('data-viewer-canvas-frame', 'true')
          }}
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
          {children}
        </Canvas>
      ) : (
        <WebGLUnavailable>{webglUnavailable}</WebGLUnavailable>
      )}
    </div>
  )
}
