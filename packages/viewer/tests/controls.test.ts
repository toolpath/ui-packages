import CameraControls from 'camera-controls'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { OrthographicCamera } from 'three'
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
