import CameraControls from 'camera-controls'
import {
  Box3,
  Matrix4,
  OrthographicCamera,
  Plane,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three'

import { adaptedUp } from './camera.js'
import type { CameraLimits, ViewerCamera, ViewportSize } from './camera.js'
import { resolveControlScheme } from './control-schemes.js'
import type { ControlScheme, ControlSchemeMapping } from './control-schemes.js'

/**
 * `camera-controls` needs the three classes it constructs injected once, and
 * against the *same* three instance the rest of the app uses — which is why
 * `three` is a peer dependency and a duplicate copy is a silent breakage.
 *
 * Only the documented subset is passed rather than the whole namespace, so a
 * bundler can still drop what the viewer does not use.
 */
CameraControls.install({
  THREE: {
    Box3,
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
  },
})

export type { ControlScheme } from './control-schemes.js'

export type ExtendedCameraControlsOptions = {
  /**
   * Orbit past the poles instead of stopping there. When enabled the up vector
   * is re-derived from the view each frame, so there is no gimbal stop.
   */
  readonly freeOrbit?: boolean | undefined
}

const EPSILON = 1e-6

const FUSION_PINCH_ZOOM_SCALE = 0.04
const FUSION_ROTATE_SCALE = 2.2
const FUSION_TRUCK_SCALE = 0.33

/**
 * Effectively no damping — the legacy viewer settled on this after overriding
 * its own preset values, and the product feel depends on the view tracking the
 * pointer exactly.
 */
const DEFAULT_SMOOTH_TIME = 0.001

/**
 * Wheel step and the settle threshold, both the legacy viewer's
 * (`three-object.tsx:289-311`).
 *
 * `dollySpeed` is only tolerable alongside {@link CameraLimits}: at 1.15 five
 * notches cross most of the 0.25–10 range, which is the point — the whole range
 * is a few flicks of the wheel. Unclamped, the same speed is what reached
 * `zoom` 1e30. Set the two together or the first notch overshoots everything.
 *
 * `restThreshold` at 0.005 rather than the library's 0.01. The reason it was
 * first written down — that the `rest` event fired while the tail of a zoom was
 * still visibly moving — is not the reason it earns its place here: nothing in
 * this package or in `examples/react-viewer` listens for `rest`. What it
 * actually governs is two things, both of which the viewer does use.
 *
 * `update()` compares it against the remaining deltas to decide the view has
 * settled (camera-controls 3.1.0, line 2266), and on a `frameloop="demand"`
 * canvas that is what ends the run of frames a gesture costs. Every `*To` call
 * — `setLookAt`, `zoomTo`, `dollyTo` — also compares against it to decide
 * whether to resolve immediately rather than animate. So halving it buys the
 * end of a zoom and pays for it in frames.
 *
 * **It cannot be scaled to the part, and it is not an oversight that it is
 * not.** The same number is compared against `deltaTheta` and `deltaPhi` in
 * radians, `deltaRadius` and `deltaTarget` in world units, and `deltaZoom`
 * unitless. Multiplying it by the scene radius the way `MIN_FRAME_RATIO`
 * and `targetBoundary` are would fix the world-unit half and break the angular
 * one — on a 900 mm plate an orbit would be called finished while still turning
 * by radians. The honest cost is that a large part spends longer under the
 * world-unit comparisons than a small one, which is extra update frames per
 * gesture; fixing that needs the library to separate the units, not a
 * multiplier here.
 */
const DOLLY_SPEED = 1.15
const REST_THRESHOLD = 0.005

/**
 * The shorter side of an element's box, in CSS pixels. Reading it can force a
 * layout, so callers read it only while the view is turning.
 */
const viewportMin = (element: HTMLElement): number =>
  Math.min(element.clientWidth, element.clientHeight)

/** Radians per pixel of travel: half a turn across the viewport's shorter side. */
const orbitScale = (viewportMin: number): number => Math.PI / Math.max(1, viewportMin)

/**
 * `CameraControls` with free orbit, camera-relative up, and CAD navigation
 * schemes.
 *
 * Two departures from the legacy implementation, both deliberate:
 *
 * - It does **not** override `connect`/`disconnect`. Legacy declared them as
 *   arrow-function class fields, which shadowed the base methods of the same
 *   name — so `connect()` added a pointer listener but never did what the base
 *   class's `connect` does, and the base's own connection came from the
 *   constructor instead. The extra listeners live on `attach`/`detach` here,
 *   and the base methods are left alone.
 * - Modifier state is tracked internally. Legacy read Shift and Control from a
 *   React hook and reapplied the whole preset on every keypress, which coupled
 *   the controls to the component tree for two booleans.
 */
export class ExtendedCameraControls extends CameraControls {
  #domElement: HTMLElement | undefined
  #freeOrbit: boolean
  #scheme: ControlScheme = 'toolpath'
  #attached = false
  #autoUpEnabled = false
  #shiftPressed = false
  #ctrlPressed = false
  #wheelHandler: ((event: WheelEvent) => void) | null = null
  /** Where each touch pointer last was, for one-finger orbit; see `#onPointerMove`. */
  #touches = new Map<number, { clientX: number; clientY: number }>()

  // Scratch objects — `#onPointerMove` and `#adaptUpVector` run at pointer and
  // frame rate respectively, so neither may allocate.
  #spherical = new Spherical()
  #scratchA = new Vector3()
  #scratchB = new Vector3()
  #scratchC = new Vector3()
  // `zoomAt`'s own: the `update` between its two readings runs
  // `#adaptUpVector`, which writes the three above.
  #zoomBefore = new Vector3()
  #zoomAfter = new Vector3()
  #scratchPlane = new Plane()
  #scratchRay = new Raycaster()
  #scratchPointer = new Vector2()

  /**
   * `domElement` is the canvas the controls listen on. Without one they listen
   * to nothing and are driven entirely through {@link orbitBy},
   * {@link zoomAt} and {@link panBy} — which is how a React Native canvas,
   * with no DOM element, moves the camera from its own touch handling.
   */
  constructor(
    camera: ViewerCamera,
    domElement?: HTMLElement,
    options: ExtendedCameraControlsOptions = {},
  ) {
    super(camera, domElement)

    this.#domElement = domElement
    this.#freeOrbit = options.freeOrbit ?? true

    // Rotation is driven entirely by `#onPointerMove`, which can flip the up
    // vector when the pose crosses a pole. The base rotate must contribute
    // nothing or the two would compound.
    this.azimuthRotateSpeed = 0
    this.polarRotateSpeed = 0

    this.dollySpeed = DOLLY_SPEED
    this.restThreshold = REST_THRESHOLD
  }

  /**
   * Bounds how far the wheel may travel, and where the orbit target may go.
   *
   * Re-applied whenever the scene is re-measured rather than set once: the
   * limits are derived from the part's bounds, and a viewer that loads a second
   * part would otherwise keep the first part's idea of far.
   *
   * The boundary confines the *target*. Zoom-to-cursor moves it, and goes on
   * moving it after the zoom clamp bites — which is a runaway no zoom clamp can
   * catch. `boundaryEnclosesCamera` stays off: under an orthographic camera the
   * camera sits well outside the framing it is looking at, so enclosing it would
   * drag the target back in on every frame.
   */
  applyLimits(limits: CameraLimits, boundary?: Box3): void {
    this.minZoom = limits.minZoom
    this.maxZoom = limits.maxZoom
    this.minDistance = limits.minDistance
    this.maxDistance = limits.maxDistance

    this.setBoundary(boundary)
  }

  get freeOrbit(): boolean {
    return this.#freeOrbit
  }

  get scheme(): ControlScheme {
    return this.#scheme
  }

  /**
   * Adds the listeners this subclass owns, on top of the base connection.
   *
   * With no element there is nothing to listen on, so only the parts that are
   * not listeners happen: free orbit's up vector, and the scheme.
   */
  attach(): void {
    if (this.#attached) {
      return
    }

    this.#attached = true

    if (this.#domElement) {
      this.#addListeners(this.#domElement)
    }

    if (this.#freeOrbit) {
      this.#enableAutoUp()
    }

    this.applyScheme(this.#scheme)
  }

  #addListeners(element: HTMLElement): void {
    element.addEventListener('pointerdown', this.#onPointerDown)
    element.ownerDocument.addEventListener('pointermove', this.#onPointerMove)
    element.ownerDocument.addEventListener('pointerup', this.#onPointerEnd)
    element.ownerDocument.addEventListener('pointercancel', this.#onPointerEnd)

    const view = element.ownerDocument.defaultView
    view?.addEventListener('keydown', this.#onModifierChange)
    view?.addEventListener('keyup', this.#onModifierChange)
    // A window that loses focus never delivers the matching keyup, which would
    // otherwise leave a modifier-aware scheme stuck in its shifted variant.
    view?.addEventListener('blur', this.#onWindowBlur)
  }

  detach(): void {
    if (!this.#attached) {
      return
    }

    this.#attached = false

    const element = this.#domElement
    if (element) {
      element.removeEventListener('pointerdown', this.#onPointerDown)
      element.ownerDocument.removeEventListener('pointermove', this.#onPointerMove)
      element.ownerDocument.removeEventListener('pointerup', this.#onPointerEnd)
      element.ownerDocument.removeEventListener('pointercancel', this.#onPointerEnd)

      const view = element.ownerDocument.defaultView
      view?.removeEventListener('keydown', this.#onModifierChange)
      view?.removeEventListener('keyup', this.#onModifierChange)
      view?.removeEventListener('blur', this.#onWindowBlur)
    }
    this.#touches.clear()

    this.#disableAutoUp()
    this.#disableCadWheel()
  }

  override dispose(): void {
    this.detach()
    super.dispose()
  }

  /**
   * Reapplies the current preset. The Viewer calls this after a projection
   * change too, because the correct wheel action differs between an
   * orthographic and a perspective camera.
   */
  applyScheme(scheme: ControlScheme): void {
    this.#scheme = scheme
    const mapping = resolveControlScheme(scheme, {
      orthographic: this.camera instanceof OrthographicCamera,
      modifiers: { shift: this.#shiftPressed, ctrl: this.#ctrlPressed },
    })

    this.#applyMapping(mapping)
  }

  #applyMapping(mapping: ControlSchemeMapping): void {
    const action = {
      none: CameraControls.ACTION.NONE,
      rotate: CameraControls.ACTION.ROTATE,
      truck: CameraControls.ACTION.TRUCK,
      zoom: CameraControls.ACTION.ZOOM,
      dolly: CameraControls.ACTION.DOLLY,
    } as const
    const touchAction = {
      rotate: CameraControls.ACTION.TOUCH_ROTATE,
      truck: CameraControls.ACTION.TOUCH_TRUCK,
      'dolly-truck': CameraControls.ACTION.TOUCH_DOLLY_TRUCK,
      'zoom-truck': CameraControls.ACTION.TOUCH_ZOOM_TRUCK,
    } as const

    this.#disableCadWheel()

    this.mouseButtons.left = action[mapping.mouse.left]
    this.mouseButtons.middle = action[mapping.mouse.middle]
    this.mouseButtons.right = action[mapping.mouse.right]
    this.mouseButtons.wheel = action[mapping.mouse.wheel]

    this.touches.one = touchAction[mapping.touches.one]
    this.touches.two = touchAction[mapping.touches.two]
    this.touches.three = touchAction[mapping.touches.three]

    this.smoothTime = mapping.immediate ? 0 : DEFAULT_SMOOTH_TIME
    this.draggingSmoothTime = mapping.immediate ? 0 : DEFAULT_SMOOTH_TIME

    if (mapping.usesCadWheel) {
      this.#enableCadWheel()
    }
  }

  setFreeOrbit(freeOrbit: boolean): void {
    if (this.#freeOrbit === freeOrbit) {
      return
    }

    this.#freeOrbit = freeOrbit

    if (!this.#attached) {
      return
    }

    if (freeOrbit) {
      this.#enableAutoUp()
    } else {
      this.#disableAutoUp()
      this.resetUpVector()
    }
  }

  /** Returns the camera to Z-up, the orientation the part data is authored in. */
  resetUpVector(): void {
    this.camera.up.set(0, 0, 1)
    this.updateCameraUp()

    const position = this.getPosition(this.#scratchA)
    void this.setPosition(position.x, position.y, position.z, false)
  }

  #enableAutoUp(): void {
    if (this.#autoUpEnabled) {
      return
    }

    this.#autoUpEnabled = true
    this.addEventListener('update', this.#adaptUpVector)
  }

  #disableAutoUp(): void {
    if (!this.#autoUpEnabled) {
      return
    }

    this.#autoUpEnabled = false
    this.removeEventListener('update', this.#adaptUpVector)
  }

  #enableCadWheel(): void {
    const element = this.#domElement
    if (!this.#attached || this.#wheelHandler || !element) {
      return
    }

    this.#wheelHandler = (event: WheelEvent) => this.#onCadWheel(event, element)
    element.addEventListener('wheel', this.#wheelHandler, {
      passive: false,
    })
  }

  #disableCadWheel(): void {
    if (!this.#wheelHandler) {
      return
    }

    this.#domElement?.removeEventListener('wheel', this.#wheelHandler)
    this.#wheelHandler = null
  }

  /**
   * Re-derives the up vector from the current view each update, so orbiting
   * over a pole keeps going instead of flipping the horizon.
   */
  #adaptUpVector = (): void => {
    const target = this.getTarget(this.#scratchA)
    const view = this.#scratchB.subVectors(target, this.camera.position).normalize()

    this.camera.up.copy(adaptedUp(view, this.camera.up, this.#scratchC))

    const position = this.getPosition(this.#scratchA)
    this.updateCameraUp()
    void this.setPosition(position.x, position.y, position.z, false)
  }

  /**
   * Turns the camera by a pointer's travel, in pixels: half a turn across the
   * viewport's shorter side, `viewportMin`.
   *
   * Rotation is done here rather than by the base class so a constrained orbit
   * can bounce off a pole — flipping the up vector and inverting azimuth —
   * instead of sticking there. The mouse and one-finger touch reach it from
   * `#onPointerMove`; a canvas with no element calls it directly.
   */
  orbitBy(dx: number, dy: number, viewportMin: number): void {
    const scale = orbitScale(viewportMin)

    const spherical = this.getSpherical(this.#spherical)

    let azimuth = spherical.theta - dx * scale
    let polar = spherical.phi - dy * scale

    const exceededUpper = polar > Math.PI - EPSILON
    const exceededLower = polar < EPSILON

    if (!this.#freeOrbit && (exceededUpper || exceededLower)) {
      polar = exceededUpper ? EPSILON : Math.PI - EPSILON
      azimuth = -azimuth
      this.camera.up.negate()
      this.updateCameraUp()
    }

    void this.rotateTo(azimuth, polar, false)
    this.update(0)
  }

  /**
   * Zooms by `scale` (above 1 is in) about the point `at`, in canvas-local
   * pixels of a viewport `viewport` in size: what was under `at` on the plane
   * through the orbit target stays under it.
   *
   * An orthographic camera zooms; a perspective one dollies toward the
   * target, by the distance that makes things `scale` times larger there.
   * Either of those alone scales about the middle of the view, so the camera
   * is then trucked by however far the point under `at` moved.
   */
  zoomAt(scale: number, at: { x: number; y: number }, viewport: ViewportSize): void {
    if (!(scale > 0) || !Number.isFinite(scale)) {
      return
    }

    const before = this.#pointOnTargetPlane(at, viewport, this.#zoomBefore)

    if (this.camera instanceof OrthographicCamera) {
      void this.zoomTo(this.camera.zoom * scale, false)
    } else {
      void this.dolly(this.distance * (1 - 1 / scale), false)
    }
    this.update(0)

    const after = this.#pointOnTargetPlane(at, viewport, this.#zoomAfter)
    if (before && after) {
      // `before` now sits `before - after` away from where `at` looks. Both
      // points are on the plane facing the camera, so trucking by that offset —
      // along the camera's right, and down being positive — puts it back.
      const offset = before.sub(after)
      const right = this.#scratchA.setFromMatrixColumn(this.camera.matrixWorld, 0)
      const up = this.#scratchB.setFromMatrixColumn(this.camera.matrixWorld, 1)
      void this.truck(offset.dot(right), -offset.dot(up), false)
      this.update(0)
    }
  }

  /**
   * Pans the view by `dx`, `dy` pixels, so whatever was under the pointer
   * follows it: world-per-pixel at the target's depth, the camera moving the
   * opposite way.
   *
   * `truck(x, y)` moves the camera right by `x` and *down* by `y`, which is
   * why both are negated — a finger moving down drags the scene down.
   */
  panBy(dx: number, dy: number, viewport: ViewportSize): void {
    const perPixel = this.#worldPerPixel(viewport.height)
    void this.truck(-dx * perPixel, -dy * perPixel, false)
    this.update(0)
  }

  /** World units per pixel at the orbit target's depth, for a viewport this tall. */
  #worldPerPixel(height: number): number {
    const camera = this.camera
    if (camera instanceof OrthographicCamera) {
      return (camera.top - camera.bottom) / camera.zoom / Math.max(1, height)
    }
    return (2 * this.distance * Math.tan(((camera.fov / 2) * Math.PI) / 180)) / Math.max(1, height)
  }

  /** The world point under `at` on the plane through the target, facing the camera. */
  #pointOnTargetPlane(
    at: { x: number; y: number },
    viewport: ViewportSize,
    into: Vector3,
  ): Vector3 | null {
    const camera = this.camera
    camera.updateMatrixWorld()
    const target = this.getTarget(this.#scratchA)
    const facing = camera.getWorldDirection(this.#scratchB)
    this.#scratchPlane.setFromNormalAndCoplanarPoint(facing, target)
    this.#scratchPointer.set(
      (at.x / Math.max(1, viewport.width)) * 2 - 1,
      -(at.y / Math.max(1, viewport.height)) * 2 + 1,
    )
    this.#scratchRay.setFromCamera(this.#scratchPointer, camera)
    return this.#scratchRay.ray.intersectPlane(this.#scratchPlane, into)
  }

  #onPointerDown = (event: PointerEvent): void => {
    // Like the base class, hear nothing while disabled: a finger that lands
    // during a section-handle drag would otherwise stay in the map and halve
    // the next one-finger orbit, and its own moves would turn the view.
    if (event.pointerType === 'touch' && this.enabled) {
      this.#touches.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    }
  }

  #onPointerEnd = (event: PointerEvent): void => {
    this.#touches.delete(event.pointerId)
  }

  /**
   * The mouse turns the view by its own `movementX`/`movementY`, as it always
   * has. One finger turns it by the travel between its own successive
   * positions, kept per pointer from `pointerdown` — touch pointer events
   * carry no useful movement, and the base class's touch rotation is switched
   * off with the rest of its rotation, so without this a one-finger drag did
   * nothing at all.
   */
  #onPointerMove = (event: PointerEvent): void => {
    const element = this.#domElement
    if (!element) {
      return
    }

    // The viewport is read per move rather than cached in the constructor,
    // since the element is usually still unlaid-out then; and only while
    // turning, because this listener hears every move on the page and the read
    // can force a layout.
    if (this.currentAction === CameraControls.ACTION.ROTATE) {
      this.orbitBy(event.movementX, event.movementY, viewportMin(element))
      return
    }

    const last = this.#touches.get(event.pointerId)
    if (!last) {
      return
    }
    const dx = event.clientX - last.clientX
    const dy = event.clientY - last.clientY
    last.clientX = event.clientX
    last.clientY = event.clientY

    if (this.currentAction === CameraControls.ACTION.TOUCH_ROTATE) {
      // Several fingers turn the view by their centroid's travel: each finger's
      // move shifts it by that move over the finger count. Turning by every
      // finger's own move would orbit twice as fast with two fingers together.
      const fingers = this.#touches.size
      this.orbitBy(dx / fingers, dy / fingers, viewportMin(element))
    }
  }

  #onCadWheel = (event: WheelEvent, element: HTMLElement): void => {
    event.preventDefault()

    if (event.ctrlKey) {
      // Trackpad pinch arrives as a wheel event with ctrlKey set.
      void this.zoom(-event.deltaY * FUSION_PINCH_ZOOM_SCALE, false)
    } else if (this.#shiftPressed) {
      const scale = orbitScale(viewportMin(element))

      void this.rotate(
        event.deltaX * scale * FUSION_ROTATE_SCALE,
        event.deltaY * scale * FUSION_ROTATE_SCALE,
        false,
      )
    } else {
      void this.truck(event.deltaX * FUSION_TRUCK_SCALE, event.deltaY * FUSION_TRUCK_SCALE, false)
    }

    this.update(0)
    this.dispatchEvent({ type: 'control' })
  }

  #onModifierChange = (event: KeyboardEvent): void => {
    this.#setModifiers(event.shiftKey, event.ctrlKey)
  }

  #onWindowBlur = (): void => {
    this.#setModifiers(false, false)
  }

  #setModifiers(shift: boolean, ctrl: boolean): void {
    if (this.#shiftPressed === shift && this.#ctrlPressed === ctrl) {
      return
    }

    this.#shiftPressed = shift
    this.#ctrlPressed = ctrl
    this.applyScheme(this.#scheme)
  }
}
