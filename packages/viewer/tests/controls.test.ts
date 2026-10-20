import CameraControls from 'camera-controls'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { OrthographicCamera, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { ExtendedCameraControls } from '../src/render/controls.js'

class TestRect {
  x: number
  y: number
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number

  constructor(x = 0, y = 0, width = 1, height = 1) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.left = x
    this.top = y
    this.right = x + width
    this.bottom = y + height
  }
}

class TestDocument extends EventTarget {
  defaultView = new EventTarget()
  pointerLockElement: Element | null = null

  exitPointerLock(): void {}
}

class TestElement extends EventTarget {
  readonly ownerDocument = new TestDocument()
  readonly style = { touchAction: '', userSelect: '', webkitUserSelect: '' }
  clientWidth = 600
  clientHeight = 400

  setAttribute(): void {}
  removeAttribute(): void {}
  getBoundingClientRect(): DOMRect {
    return new DOMRect(0, 0, this.clientWidth, this.clientHeight)
  }
}

const keyboardEvent = (shiftKey: boolean, ctrlKey: boolean) => {
  const event = new Event('keydown') as KeyboardEvent
  Object.defineProperties(event, {
    shiftKey: { value: shiftKey },
    ctrlKey: { value: ctrlKey },
  })
  return event
}

const wheelEvent = ({ ctrlKey = false }: { ctrlKey?: boolean } = {}) => {
  const event = new Event('wheel', { cancelable: true }) as WheelEvent
  Object.defineProperties(event, {
    clientX: { value: 300 },
    clientY: { value: 200 },
    ctrlKey: { value: ctrlKey },
    deltaX: { value: 10 },
    deltaY: { value: 10 },
    deltaMode: { value: 0 },
  })
  return event
}

const originalDomRect = globalThis.DOMRect

beforeAll(() => {
  Object.assign(globalThis, { DOMRect: TestRect })
})

afterAll(() => {
  Object.assign(globalThis, { DOMRect: originalDomRect })
})

const createControls = () => {
  const element = new TestElement()
  const camera = new OrthographicCamera(-1, 1, 1, -1)
  camera.position.set(1, -1, 1)
  const controls = new ExtendedCameraControls(camera, element as unknown as HTMLElement)
  controls.attach()
  return { controls, element }
}

describe('ExtendedCameraControls preset lifecycle', () => {
  it('reapplies SolidWorks modifiers and clears them on window blur', () => {
    const { controls, element } = createControls()
    controls.applyScheme('solidworks')

    expect(controls.mouseButtons.middle).toBe(CameraControls.ACTION.ROTATE)

    element.ownerDocument.defaultView.dispatchEvent(keyboardEvent(false, true))
    expect(controls.mouseButtons.middle).toBe(CameraControls.ACTION.TRUCK)

    element.ownerDocument.defaultView.dispatchEvent(keyboardEvent(true, true))
    expect(controls.mouseButtons.middle).toBe(CameraControls.ACTION.ZOOM)

    element.ownerDocument.defaultView.dispatchEvent(new Event('blur'))
    expect(controls.mouseButtons.middle).toBe(CameraControls.ACTION.ROTATE)

    controls.dispose()
  })

  it('removes the custom CAD wheel listener when switching away from Fusion', () => {
    const { controls, element } = createControls()
    const truck = vi.spyOn(controls, 'truck')

    controls.applyScheme('fusion')
    element.dispatchEvent(wheelEvent())
    expect(truck).toHaveBeenCalledOnce()

    controls.applyScheme('toolpath')
    truck.mockClear()
    element.dispatchEvent(wheelEvent())
    expect(truck).not.toHaveBeenCalled()

    controls.dispose()
  })

  it.each(['fusion', 'inventor'] as const)(
    '%s pans, orbits, and pinch-zooms with its custom wheel listener',
    (scheme) => {
      const { controls, element } = createControls()
      const truck = vi.spyOn(controls, 'truck')
      const rotate = vi.spyOn(controls, 'rotate')
      const zoom = vi.spyOn(controls, 'zoom')
      controls.applyScheme(scheme)

      const pan = wheelEvent()
      element.dispatchEvent(pan)
      expect(pan.defaultPrevented).toBe(true)
      expect(truck).toHaveBeenCalledOnce()
      expect(rotate).not.toHaveBeenCalled()
      expect(zoom).not.toHaveBeenCalled()

      truck.mockClear()
      element.ownerDocument.defaultView.dispatchEvent(keyboardEvent(true, false))
      const orbit = wheelEvent()
      element.dispatchEvent(orbit)
      expect(orbit.defaultPrevented).toBe(true)
      expect(truck).not.toHaveBeenCalled()
      expect(rotate).toHaveBeenCalledOnce()
      expect(zoom).not.toHaveBeenCalled()

      rotate.mockClear()
      const pinch = wheelEvent({ ctrlKey: true })
      element.dispatchEvent(pinch)
      expect(pinch.defaultPrevented).toBe(true)
      expect(truck).not.toHaveBeenCalled()
      expect(rotate).not.toHaveBeenCalled()
      expect(zoom).toHaveBeenCalledOnce()

      controls.dispose()
    },
  )

  it('does not retain the custom wheel listener after disposal', () => {
    const { controls, element } = createControls()
    const truck = vi.spyOn(controls, 'truck')

    controls.applyScheme('inventor')
    controls.dispose()
    element.dispatchEvent(wheelEvent())

    expect(truck).not.toHaveBeenCalled()
  })
})

const pointerEvent = (type: string, fields: Record<string, number | string>) => {
  const event = new Event(type, { cancelable: true }) as PointerEvent
  Object.defineProperties(
    event,
    Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }])),
  )
  return event
}

/** `orbitBy`'s scale: half a turn across the shorter side of the 600 x 400 test element. */
const VIEWPORT = { width: 600, height: 400 }

/** The world point under `at` on the plane through the target, facing the camera. */
const underPointer = (
  controls: ExtendedCameraControls,
  camera: OrthographicCamera | PerspectiveCamera,
  at: { x: number; y: number },
): Vector3 => {
  camera.updateMatrixWorld()
  const target = controls.getTarget(new Vector3())
  const plane = new Plane().setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new Vector3()),
    target,
  )
  const raycaster = new Raycaster()
  raycaster.setFromCamera(
    new Vector2((at.x / VIEWPORT.width) * 2 - 1, -(at.y / VIEWPORT.height) * 2 + 1),
    camera,
  )
  const hit = raycaster.ray.intersectPlane(plane, new Vector3())
  if (!hit) throw new Error('the pointer does not reach the target plane')
  return hit
}

/** Where a world point is drawn, in pixels of {@link VIEWPORT}. */
const onScreen = (point: Vector3, camera: OrthographicCamera | PerspectiveCamera) => {
  camera.updateMatrixWorld()
  const ndc = point.clone().project(camera)
  return { x: ((ndc.x + 1) / 2) * VIEWPORT.width, y: ((1 - ndc.y) / 2) * VIEWPORT.height }
}

const cameras = {
  orthographic: () => {
    const camera = new OrthographicCamera(-300, 300, 200, -200, 0.1, 10000)
    camera.position.set(100, -100, 100)
    return camera
  },
  perspective: () => {
    const camera = new PerspectiveCamera(45, VIEWPORT.width / VIEWPORT.height, 0.1, 10000)
    camera.position.set(100, -100, 100)
    return camera
  },
}

describe('ExtendedCameraControls without an element', () => {
  it('constructs, attaches and disposes with nothing to listen on', () => {
    const camera = cameras.orthographic()
    const controls = new ExtendedCameraControls(camera)

    expect(() => controls.attach()).not.toThrow()
    expect(() => controls.applyScheme('fusion')).not.toThrow()
    expect(() => controls.dispose()).not.toThrow()
  })

  it('still re-derives the up vector under free orbit', () => {
    // Free orbit's up vector is not a listener, so a canvas with nothing to
    // listen on keeps it: orbiting over the top carries on rather than sticking
    // at the pole, which is what moves `up` off Z.
    const camera = cameras.orthographic()
    camera.up.set(0, 0, 1)
    const controls = new ExtendedCameraControls(camera)
    controls.updateCameraUp()
    controls.attach()

    for (let step = 0; step < 10; step += 1) controls.orbitBy(0, 40, 400)
    expect(camera.up.z).toBeLessThan(0.9)
    controls.dispose()
  })
})

describe('ExtendedCameraControls.orbitBy', () => {
  it('turns the camera exactly as a mouse drag does, for a recorded drag', () => {
    const recorded = [
      [3, -1],
      [7, 2],
      [12, 5],
      [-4, 9],
      [0, -14],
      [21, 3],
    ] as const

    const { controls: dragged, element } = createControls()
    const camera = cameras.orthographic()
    const driven = new ExtendedCameraControls(camera)
    driven.attach()

    element.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: 300,
        clientY: 200,
      }),
    )
    expect(dragged.currentAction).toBe(CameraControls.ACTION.ROTATE)

    for (const [movementX, movementY] of recorded) {
      element.ownerDocument.dispatchEvent(
        pointerEvent('pointermove', {
          pointerId: 1,
          pointerType: 'mouse',
          buttons: 1,
          clientX: 300,
          clientY: 200,
          movementX,
          movementY,
        }),
      )
      driven.orbitBy(movementX, movementY, Math.min(element.clientWidth, element.clientHeight))
    }

    expect(dragged.azimuthAngle).toBeCloseTo(driven.azimuthAngle, 10)
    expect(dragged.polarAngle).toBeCloseTo(driven.polarAngle, 10)
    expect(dragged.azimuthAngle).not.toBeCloseTo(0, 2)
    dragged.dispose()
    driven.dispose()
  })

  it('turns the camera with one finger, from its own travel', () => {
    const { controls, element } = createControls()
    const before = controls.azimuthAngle
    const touch = { pointerId: 9, pointerType: 'touch', buttons: 1 }

    element.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 300, clientY: 200 }))
    expect(controls.currentAction).toBe(CameraControls.ACTION.TOUCH_ROTATE)
    element.ownerDocument.dispatchEvent(
      pointerEvent('pointermove', { ...touch, clientX: 340, clientY: 200 }),
    )

    // 40 px across a 400 px short side is a tenth of a half turn.
    expect(before - controls.azimuthAngle).toBeCloseTo(Math.PI / 10, 6)
    controls.dispose()
  })
})

describe('ExtendedCameraControls.zoomAt', () => {
  it.each(['orthographic', 'perspective'] as const)(
    'keeps the point under the fingers there, with a %s camera',
    (kind) => {
      for (const scale of [1.5, 0.6]) {
        const camera = cameras[kind]()
        const controls = new ExtendedCameraControls(camera)
        controls.attach()
        controls.update(0)

        const at = { x: 450, y: 110 }
        const anchor = underPointer(controls, camera, at)
        controls.zoomAt(scale, at, VIEWPORT)
        const drawn = onScreen(anchor, camera)

        expect(Math.hypot(drawn.x - at.x, drawn.y - at.y)).toBeLessThan(1)
        controls.dispose()
      }
    },
  )

  it.each(['orthographic', 'perspective'] as const)('zooms in, with a %s camera', (kind) => {
    const camera = cameras[kind]()
    const controls = new ExtendedCameraControls(camera)
    controls.attach()
    controls.update(0)
    const zoom = camera.zoom
    const distance = controls.distance

    controls.zoomAt(1.5, { x: 300, y: 200 }, VIEWPORT)

    if (kind === 'orthographic') expect(camera.zoom).toBeCloseTo(zoom * 1.5, 6)
    else expect(controls.distance).toBeCloseTo(distance / 1.5, 6)
    controls.dispose()
  })
})

describe('ExtendedCameraControls.panBy', () => {
  it.each(['orthographic', 'perspective'] as const)(
    'moves the target by half the visible width for half the viewport, with a %s camera',
    (kind) => {
      const camera = cameras[kind]()
      const controls = new ExtendedCameraControls(camera)
      controls.attach()
      controls.update(0)

      const left = underPointer(controls, camera, { x: 0, y: VIEWPORT.height / 2 })
      const right = underPointer(controls, camera, { x: VIEWPORT.width, y: VIEWPORT.height / 2 })
      const visibleWidth = left.distanceTo(right)
      const before = controls.getTarget(new Vector3())

      controls.panBy(VIEWPORT.width / 2, 0, VIEWPORT)
      const after = controls.getTarget(new Vector3())

      expect(after.distanceTo(before)).toBeCloseTo(visibleWidth / 2, 6)
      // The scene follows the finger to the right, so the camera went left.
      const rightward = new Vector3().subVectors(right, left).normalize()
      expect(new Vector3().subVectors(after, before).dot(rightward)).toBeLessThan(0)
      controls.dispose()
    },
  )
})
