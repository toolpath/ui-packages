import { describe, expect, it, vi } from 'vitest'
import {
  type TouchControls,
  applyTouchOps,
  createFingerTracker,
  createTouchOps,
  createTouchOrbit,
  holdInvalidate,
  localPoint,
  type TouchPoint,
} from '../src/render/touch-orbit.js'

const finger = (id: number, x: number, y: number): TouchPoint => ({ id, x, y })

describe('createTouchOrbit', () => {
  it('orbits by one finger’s travel, from the second update on', () => {
    const orbit = createTouchOrbit()

    expect(orbit.update([finger(1, 100, 100)])).toEqual([])
    expect(orbit.update([finger(1, 110, 95)])).toEqual([{ kind: 'orbit', dx: 10, dy: -5 }])
    expect(orbit.update([finger(1, 130, 95)])).toEqual([{ kind: 'orbit', dx: 20, dy: 0 }])
    expect(orbit.update([finger(1, 130, 95)])).toEqual([])
  })

  it('zooms in by the spread’s ratio about the centroid when two fingers part', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 100, 100), finger(2, 200, 100)])

    expect(orbit.update([finger(1, 50, 100), finger(2, 250, 100)])).toEqual([
      { kind: 'zoom', scale: 2, x: 150, y: 100 },
    ])
  })

  it('zooms out when they close', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 50, 100), finger(2, 250, 100)])

    const [zoom] = orbit.update([finger(1, 100, 100), finger(2, 200, 100)])
    expect(zoom).toEqual({ kind: 'zoom', scale: 0.5, x: 150, y: 100 })
  })

  it('pans by the centroid’s travel when two fingers move together', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 100, 100), finger(2, 200, 100)])

    expect(orbit.update([finger(1, 130, 140), finger(2, 230, 140)])).toEqual([
      { kind: 'pan', dx: 30, dy: 40 },
    ])
  })

  it('pairs two fingers by id, in whatever order they arrive', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(2, 200, 100), finger(1, 100, 100)])

    expect(orbit.update([finger(1, 110, 100), finger(2, 210, 100)])).toEqual([
      { kind: 'pan', dx: 10, dy: 0 },
    ])
  })

  it('starts again, rather than jumping, when one of two fingers lifts', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 100, 100), finger(2, 200, 100)])
    orbit.update([finger(1, 110, 100), finger(2, 210, 100)])

    // The remaining finger is 100 px from the old centroid; that is not a drag.
    expect(orbit.update([finger(2, 210, 100)])).toEqual([])
    expect(orbit.update([finger(2, 215, 100)])).toEqual([{ kind: 'orbit', dx: 5, dy: 0 }])
  })

  it('ignores a third finger, and picks up again when it lifts', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 100, 100), finger(2, 200, 100)])

    expect(orbit.update([finger(1, 100, 100), finger(2, 200, 100), finger(3, 150, 50)])).toEqual([])
    expect(orbit.update([finger(1, 120, 100), finger(2, 220, 100), finger(3, 170, 50)])).toEqual([])
    expect(orbit.update([finger(1, 120, 100), finger(2, 220, 100)])).toEqual([])
    expect(orbit.update([finger(1, 125, 100), finger(2, 225, 100)])).toEqual([
      { kind: 'pan', dx: 5, dy: 0 },
    ])
  })

  it('forgets its baseline on reset', () => {
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 100, 100)])
    orbit.reset()

    expect(orbit.update([finger(1, 150, 100)])).toEqual([])
  })
})

describe('createFingerTracker', () => {
  it('keeps the fingers that started and have not ended', () => {
    const fingers = createFingerTracker()

    expect(fingers.update('start', [finger(1, 0, 0)], [finger(1, 0, 0)])).toEqual([finger(1, 0, 0)])
    expect(
      fingers.update('start', [finger(2, 50, 0)], [finger(1, 1, 0), finger(2, 50, 0)]),
    ).toEqual([finger(1, 1, 0), finger(2, 50, 0)])
    expect(fingers.update('end', [finger(1, 2, 0)], [finger(2, 51, 0)])).toEqual([finger(2, 51, 0)])
  })

  it('ignores a finger the event reports that never started here', () => {
    // After an interruption iOS can report a finger in `touches` that it never
    // ended; it is not one of this gesture's.
    const fingers = createFingerTracker()
    fingers.update('start', [finger(1, 0, 0)], [finger(1, 0, 0), finger(9, 300, 300)])

    expect(
      fingers.update('move', [finger(1, 5, 0)], [finger(1, 5, 0), finger(9, 300, 300)]),
    ).toEqual([finger(1, 5, 0)])
  })

  it('drops every changed finger on a cancel', () => {
    const fingers = createFingerTracker()
    fingers.update('start', [finger(1, 0, 0), finger(2, 9, 9)], [])

    expect(fingers.update('cancel', [finger(1, 0, 0), finger(2, 9, 9)], [])).toEqual([])
  })
})

describe('createTouchOps', () => {
  it('merges what arrived since the last frame into one move of each kind', () => {
    const ops = createTouchOps()
    ops.push([{ kind: 'orbit', dx: 3, dy: 1 }])
    ops.push([{ kind: 'orbit', dx: 4, dy: -2 }])
    ops.push([
      { kind: 'zoom', scale: 1.1, x: 10, y: 10 },
      { kind: 'pan', dx: 1, dy: 2 },
    ])
    ops.push([
      { kind: 'zoom', scale: 2, x: 20, y: 30 },
      { kind: 'pan', dx: 3, dy: 4 },
    ])

    const merged = ops.take()
    expect(merged).toEqual([
      { kind: 'orbit', dx: 7, dy: -1 },
      { kind: 'pan', dx: 4, dy: 6 },
      { kind: 'zoom', scale: expect.closeTo(2.2, 10), x: 20, y: 30 },
    ])
    expect(ops.take()).toEqual([])
  })
})

describe('applyTouchOps', () => {
  const controls = (enabled: boolean): TouchControls => ({
    enabled,
    orbitBy: vi.fn(),
    zoomAt: vi.fn(),
    panBy: vi.fn(),
  })
  const size = { width: 400, height: 300 }

  it('moves the camera by each operation', () => {
    const on = controls(true)
    const moved = applyTouchOps(
      [
        { kind: 'orbit', dx: 3, dy: 4 },
        { kind: 'pan', dx: 1, dy: 2 },
        { kind: 'zoom', scale: 1.5, x: 10, y: 20 },
      ],
      on,
      size,
      createTouchOrbit(),
    )

    expect(moved).toBe(true)
    expect(on.orbitBy).toHaveBeenCalledWith(3, 4, 300)
    expect(on.panBy).toHaveBeenCalledWith(1, 2, size)
    expect(on.zoomAt).toHaveBeenCalledWith(1.5, { x: 10, y: 20 }, size)
  })

  it('with the controls off, applies nothing and starts the orbit afresh', () => {
    const off = controls(false)
    const orbit = createTouchOrbit()
    orbit.update([finger(1, 0, 0)])

    expect(applyTouchOps([{ kind: 'orbit', dx: 3, dy: 4 }], off, size, orbit)).toBe(false)
    expect(off.orbitBy).not.toHaveBeenCalled()
    // Forgotten: the next update is a baseline, not a move from (0, 0).
    expect(orbit.update([finger(1, 50, 50)])).toEqual([])
  })

  it('reports nothing done when there was nothing to do', () => {
    expect(applyTouchOps([], controls(true), size, createTouchOrbit())).toBe(false)
  })
})

describe('a lost finger', () => {
  it('is forgotten when the next gesture starts without it', () => {
    const fingers = createFingerTracker()
    fingers.update('start', [finger(1, 10, 10)], [finger(1, 10, 10)])
    // Finger 1's end never arrives.
    expect(fingers.update('start', [finger(2, 50, 50)], [finger(2, 50, 50)])).toEqual([
      finger(2, 50, 50),
    ])
  })

  it('is kept while it is still down, as a second finger joins', () => {
    const fingers = createFingerTracker()
    fingers.update('start', [finger(1, 10, 10)], [finger(1, 10, 10)])
    expect(
      fingers.update('start', [finger(2, 50, 50)], [finger(1, 10, 10), finger(2, 50, 50)]),
    ).toEqual([finger(1, 10, 10), finger(2, 50, 50)])
  })
})

describe('localPoint', () => {
  it('makes a page position local to the canvas, with a numeric id', () => {
    expect(localPoint({ identifier: '3', pageX: 130, pageY: 260 }, { x: 30, y: 60 })).toEqual(
      finger(3, 100, 200),
    )
  })
})

describe('holdInvalidate', () => {
  it('clears the slot it filled', () => {
    const slot = { invalidate: null as (() => void) | null }
    const release = holdInvalidate(slot, () => {})
    release()
    expect(slot.invalidate).toBeNull()
  })

  it("leaves a newer canvas's invalidate in place", () => {
    const slot = { invalidate: null as (() => void) | null }
    const releaseOld = holdInvalidate(slot, () => {})
    const newer = () => {}
    holdInvalidate(slot, newer)

    releaseOld()

    expect(slot.invalidate).toBe(newer)
  })
})
