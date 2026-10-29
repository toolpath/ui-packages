// @vitest-environment jsdom
/*
 * The measure tool's taps on React Native, as fiber's native canvas sends
 * them: a `pointerdown` as each finger lands, with the fingers down, and a
 * `click` for each lift that barely moved. What a tap is on is
 * `underPointer`'s to find (stubbed here); which taps pick is the input's.
 */
import { act, render } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeasuredPart, PointerHandlers, PointerShown } from '../src/render/measure-under.js'
import { DOUBLE_TAP_MS } from '../src/render/tap.js'

/** The canvas's listeners, for the test to call as fiber would. */
const canvas = vi.hoisted(() => ({
  listeners: new Map<string, (event: object) => void>(),
  addEventListener(type: string, listener: (event: object) => void) {
    this.listeners.set(type, listener)
  },
  removeEventListener(type: string) {
    this.listeners.delete(type)
  },
}))
// The same for the canvas's life, as fiber's is.
const three = vi.hoisted(() => ({
  gl: { domElement: canvas },
  camera: {},
  size: { width: 400, height: 800 },
  scene: {},
}))
/** What the next tap lands on: face 3, at a point in world space; null for nothing. */
const landing = vi.hoisted(() => ({ found: true as boolean }))
const HIT = vi.hoisted(() => [1, 2, 3] as const)

vi.mock('@react-three/fiber', () => ({ useThree: () => three }))
vi.mock('../src/render/part-surfaces.js', () => ({ partSurfaces: () => [] }))
vi.mock('../src/render/edge-corners.js', () => ({ zoomedReach: () => 1 }))
vi.mock('../src/render/measure-under.js', async () => {
  const { Vector3: Point } = await import('three')
  return {
    cutSampler: () => () => null,
    partSphere: () => null,
    underPointer: () =>
      landing.found
        ? {
            under: { on: { face: { kind: 'face', region: 3, point: [0, 0, 0] } }, snap: null },
            line: null,
            at: new Point(...HIT),
          }
        : null,
  }
})

const { useMeasurePointer } = await import('../src/measure-pointer.native.js')

const PART = {
  model: {},
  geometry: {},
  surfaceFor: () => null,
  holes: {},
} as unknown as MeasuredPart

const handlersFor = (points: boolean): RefObject<PointerHandlers> => ({
  current: {
    onPick: vi.fn(),
    onClear: vi.fn(),
    onDrop: vi.fn(() => false),
    onDouble: vi.fn(),
    format: String,
    viewCube: { margin: [60, 60] },
    points,
    keep: false,
  },
})

const Measuring = ({
  handlers,
  shown,
  measured = 1,
}: {
  handlers: RefObject<PointerHandlers>
  shown: RefObject<PointerShown | null>
  measured?: number
}) => {
  shown.current = useMeasurePointer(PART, handlers, true, measured)
  return null
}

const send = (type: string, event: object) =>
  act(() => canvas.listeners.get(type)!({ type, ...event }))

/** A finger lands, with `down` fingers down then. */
const land = (down: number) => send('pointerdown', { touches: Array.from({ length: down }) })
/** A lift that barely moved, at `at` ms, on the middle of the part. */
const tap = (at: number) =>
  send('click', { offsetX: 200, offsetY: 400, pageX: 200, pageY: 500, timestamp: at })

const mount = (points = false) => {
  const handlers = handlersFor(points)
  const shown = createRef<PointerShown | null>() as RefObject<PointerShown | null>
  const view = render(<Measuring handlers={handlers} shown={shown} />)
  const again = (measured: number) =>
    view.rerender(<Measuring handlers={handlers} shown={shown} measured={measured} />)
  return { handlers: handlers.current, shown, again }
}

describe('the measure tool’s taps on React Native', () => {
  beforeEach(() => {
    landing.found = true
  })

  it('picks with the tap after a two-finger pan that sent no click', () => {
    const { handlers } = mount()
    land(1)
    land(2)
    // The pan moved: no click as the fingers lift.
    land(1)
    tap(1000)
    expect(handlers.onPick).toHaveBeenCalledTimes(1)
  })

  it('picks nothing as a pinch lifts, though each finger sends a click', () => {
    const { handlers } = mount()
    land(1)
    land(2)
    tap(1000)
    tap(1050)
    expect(handlers.onPick).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'takes a double tap as the view’s, picking once (points: %s)',
    (points) => {
      const { handlers } = mount(points)
      land(1)
      tap(1000)
      land(1)
      tap(1000 + DOUBLE_TAP_MS / 2)
      expect(handlers.onPick).toHaveBeenCalledTimes(1)
      // A tap well after is a pick of its own.
      land(1)
      tap(1000 + DOUBLE_TAP_MS * 3)
      expect(handlers.onPick).toHaveBeenCalledTimes(2)
    },
  )

  it('aims the orbit at the point a double tap lands on', () => {
    const { handlers } = mount()
    land(1)
    tap(1000)
    land(1)
    tap(1000 + DOUBLE_TAP_MS / 2)
    expect(handlers.onDouble).toHaveBeenCalledTimes(1)
    expect(vi.mocked(handlers.onDouble).mock.calls[0]?.[0]).toEqual(new Vector3(...HIT))
  })

  it('pairs no taps across a pinch', () => {
    const { handlers } = mount()
    land(1)
    tap(1000)
    land(2)
    tap(1050)
    land(1)
    tap(1100)
    expect(handlers.onDouble).not.toHaveBeenCalled()
    expect(handlers.onPick).toHaveBeenCalledTimes(2)
  })

  it('leaves a tap on the view cube to the cube', () => {
    const { handlers } = mount()
    land(1)
    send('click', { offsetX: 340, offsetY: 60, pageX: 340, pageY: 160, timestamp: 1000 })
    expect(handlers.onPick).not.toHaveBeenCalled()
    expect(handlers.onClear).not.toHaveBeenCalled()
  })

  it('clears with a tap off the part', () => {
    const { handlers } = mount()
    landing.found = false
    land(1)
    tap(1000)
    expect(handlers.onClear).toHaveBeenCalledTimes(1)
    expect(handlers.onPick).not.toHaveBeenCalled()
  })

  it('keeps what was tapped painted until nothing is measured', () => {
    const { shown, again } = mount()
    land(1)
    tap(1000)
    expect(shown.current).toEqual({ region: 3, edge: null })
    again(1)
    expect(shown.current).toEqual({ region: 3, edge: null })
    // Drawn again, as the tool is when the measurements are cleared.
    again(0)
    expect(shown.current).toBeNull()
  })
})
