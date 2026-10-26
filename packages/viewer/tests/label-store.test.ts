import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createLabelStore } from '../src/render/label-store.js'

const SIZE = { width: 400, height: 200 }

/** Looking down -Z at the origin, 400 x 200 world units across: one unit a pixel. */
const camera = () => {
  const view = new OrthographicCamera(-200, 200, 100, -100, 0.1, 1000)
  view.position.set(0, 0, 100)
  view.updateMatrixWorld()
  return view
}

const label = { text: '12.00 mm', kind: 'distance' }

describe('label projection', () => {
  it('places a label in layout pixels from the top-left corner', () => {
    const store = createLabelStore()
    store.set('a', { ...label, position: [50, 25, 0] })
    store.project(camera(), SIZE)

    const [projected] = store.getSnapshot()
    expect(projected).toMatchObject({ id: 'a', visible: true, text: '12.00 mm', kind: 'distance' })
    expect(projected!.x).toBeCloseTo(250, 6)
    expect(projected!.y).toBeCloseTo(75, 6)
  })

  it('takes a Vector3 as well as a tuple', () => {
    const store = createLabelStore()
    store.set('a', { ...label, position: new Vector3(-200, 100, 0) })
    store.project(camera(), SIZE)

    expect(store.getSnapshot()[0]).toMatchObject({ x: 0, y: 0, visible: true })
  })

  it('hides a label more than 10 % outside the view, and keeps one just past the edge', () => {
    const store = createLabelStore()
    // 10 % of the 400-unit width is 40 units past the right edge at 200.
    store.set('near', { ...label, position: [230, 0, 0] })
    store.set('far', { ...label, position: [250, 0, 0] })
    store.set('below', { ...label, position: [0, -125, 0] })
    store.project(camera(), SIZE)

    const visible = Object.fromEntries(
      store.getSnapshot().map((entry) => [entry.id, entry.visible]),
    )
    expect(visible).toEqual({ near: true, far: false, below: false })
  })

  it('hides a label behind the camera', () => {
    const view = new PerspectiveCamera(50, 2, 0.1, 1000)
    view.position.set(0, 0, 100)
    view.updateMatrixWorld()
    const store = createLabelStore()
    store.set('front', { ...label, position: [0, 0, 0] })
    store.set('behind', { ...label, position: [0, 0, 200] })
    store.project(view, SIZE)

    const visible = Object.fromEntries(
      store.getSnapshot().map((entry) => [entry.id, entry.visible]),
    )
    expect(visible).toEqual({ front: true, behind: false })
  })
})

describe('label notification', () => {
  it('notifies the first projection, and not a second with nothing changed', () => {
    const store = createLabelStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set('a', { ...label, position: [0, 0, 0] })

    store.project(camera(), SIZE)
    store.project(camera(), SIZE)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('keeps the same snapshot while nothing changes', () => {
    const store = createLabelStore()
    store.set('a', { ...label, position: [0, 0, 0] })
    store.project(camera(), SIZE)
    const first = store.getSnapshot()

    store.project(camera(), SIZE)
    expect(store.getSnapshot()).toBe(first)
  })

  it('ignores a move under half a pixel and notifies one of half a pixel or more', () => {
    const store = createLabelStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const view = camera()
    store.set('a', { ...label, position: [0, 0, 0] })
    store.project(view, SIZE)
    listener.mockClear()

    view.position.x = 0.3
    view.updateMatrixWorld()
    store.project(view, SIZE)
    expect(listener).not.toHaveBeenCalled()

    view.position.x = 0.6
    view.updateMatrixWorld()
    store.project(view, SIZE)
    expect(listener).toHaveBeenCalledOnce()
    // Measured from what was last notified, so a slow drift still arrives.
    expect(store.getSnapshot()[0]!.x).toBeCloseTo(199.4, 6)
  })

  it('notifies a change of visibility, content, and which labels there are', () => {
    const store = createLabelStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const view = camera()
    store.set('a', { ...label, position: [0, 0, 0] })
    store.project(view, SIZE)

    store.set('a', { ...label, text: '13.00 mm', position: [0, 0, 0] })
    store.project(view, SIZE)
    expect(store.getSnapshot()[0]!.text).toBe('13.00 mm')

    store.set('a', { ...label, text: '13.00 mm', position: [400, 0, 0] })
    store.project(view, SIZE)
    expect(store.getSnapshot()[0]!.visible).toBe(false)

    store.set('b', { ...label, position: [0, 0, 0] })
    store.project(view, SIZE)
    store.remove('b')
    store.project(view, SIZE)
    expect(store.getSnapshot().map((entry) => entry.id)).toEqual(['a'])

    expect(listener).toHaveBeenCalledTimes(5)
  })

  it('notifies a change of accessibility hint', () => {
    const store = createLabelStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const view = camera()
    store.set('a', { ...label, position: [0, 0, 0] })
    store.project(view, SIZE)

    store.set('a', { ...label, accessibilityHint: 'Copies it', position: [0, 0, 0] })
    store.project(view, SIZE)

    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot()[0]!.accessibilityHint).toBe('Copies it')
  })

  it('stops notifying a listener that unsubscribed', () => {
    const store = createLabelStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.set('a', { ...label, position: [0, 0, 0] })
    store.project(camera(), SIZE)

    expect(listener).not.toHaveBeenCalled()
  })
})
