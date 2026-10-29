import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExplodeMotion, type ExplodeMotionOptions } from '../src/model/explode-motion.js'

/** A frame clock the test advances by hand. */
const clock = () => {
  const frames = new Map<number, (timestamp: number) => void>()
  let next = 0
  let now = 0
  const options: ExplodeMotionOptions = {
    reducedMotion: () => false,
    requestFrame: (callback) => {
      frames.set(++next, callback)
      return next
    },
    cancelFrame: (handle) => {
      frames.delete(handle)
    },
  }
  return {
    options,
    pending: () => frames.size,
    /** Runs the frames due, `ms` after the last. */
    tick: (ms = 16) => {
      now += ms
      const due = [...frames.values()]
      frames.clear()
      for (const frame of due) {
        frame(now)
      }
    },
    /** Frames until nothing is scheduled, or a frame budget runs out. */
    settle: (ms = 16, budget = 1000) => {
      for (let i = 0; i < budget && frames.size > 0; i += 1) {
        now += ms
        const due = [...frames.values()]
        frames.clear()
        for (const frame of due) {
          frame(now)
        }
      }
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createExplodeMotion', () => {
  it('waits a frame before moving, then eases over the real time elapsed', () => {
    const time = clock()
    const motion = createExplodeMotion(0, { ...time.options, durationMs: 1000 })
    motion.moveTo(1)
    expect(motion.getSnapshot()).toMatchObject({ mode: 'waiting', active: false, amount: 0 })
    time.tick()
    expect(motion.getSnapshot()).toMatchObject({ mode: 'moving', active: true })
    // Two long frames cover the move: slow rendering changes the frame count, not the duration.
    time.tick(500)
    expect(motion.value).toBeCloseTo(0.5)
    time.tick(500)
    expect(motion.value).toBe(1)
    expect(motion.getSnapshot()).toMatchObject({ mode: 'idle', active: true, amount: 1 })
    expect(time.pending()).toBe(0)
  })

  it('holds a move until every holder releases, without counting the wait', () => {
    const time = clock()
    const motion = createExplodeMotion(0, { ...time.options, durationMs: 100 })
    const first = motion.hold()
    const second = motion.hold()
    expect(motion.getSnapshot().preparing).toBe(true)
    motion.moveTo(1)
    time.tick()
    expect(time.pending()).toBe(0)
    first()
    // Releasing twice is one release.
    first()
    time.tick(5000)
    expect(motion.getSnapshot()).toMatchObject({ mode: 'waiting', amount: 0, preparing: true })
    second()
    expect(motion.getSnapshot().preparing).toBe(false)
    time.tick()
    expect(motion.getSnapshot().mode).toBe('moving')
    time.tick(50)
    expect(motion.value).toBeCloseTo(0.5)
    time.settle()
    expect(motion.value).toBe(1)
  })

  it('jumps once ready under reduced motion, or when asked to', () => {
    const time = clock()
    const reduced = createExplodeMotion(0, { ...time.options, reducedMotion: () => true })
    const release = reduced.hold()
    reduced.moveTo(1)
    time.tick()
    expect(reduced.value).toBe(0)
    release()
    time.tick()
    expect(reduced.getSnapshot()).toMatchObject({ amount: 1, mode: 'idle' })
    const asked = createExplodeMotion(1, time.options)
    asked.moveTo(0, { immediate: true })
    time.tick()
    expect(asked.getSnapshot()).toMatchObject({ amount: 0, mode: 'idle', active: false })
  })

  it('stops for a set, and reverses from where it is', () => {
    const time = clock()
    const motion = createExplodeMotion(0, { ...time.options, durationMs: 1000 })
    motion.moveTo(1)
    time.tick()
    time.tick(500)
    const halfway = motion.value
    motion.moveTo(0)
    time.tick()
    time.tick(250)
    expect(motion.value).toBeLessThan(halfway)
    expect(motion.value).toBeGreaterThan(0)
    motion.set(0.3)
    expect(motion.getSnapshot()).toMatchObject({ amount: 0.3, mode: 'idle', active: true })
    expect(time.pending()).toBe(0)
    motion.set(2)
    expect(motion.value).toBe(1)
  })

  it('tells every listener each frame, and readouts at most ten times a second', () => {
    const time = clock()
    const motion = createExplodeMotion(0, { ...time.options, durationMs: 1000 })
    const listener = vi.fn()
    motion.subscribe(listener)
    motion.moveTo(1)
    time.tick()
    const snapshots = new Set([motion.getSnapshot()])
    listener.mockClear()
    for (let frame = 0; frame < 10; frame += 1) {
      time.tick(16)
      snapshots.add(motion.getSnapshot())
    }
    expect(listener).toHaveBeenCalledTimes(10)
    // 160 ms of frames: the readout changed once, not ten times.
    expect(snapshots.size).toBe(2)
  })

  it('pauses while the tab is hidden, and leaves the hidden time out', () => {
    const events = new EventTarget()
    const page = {
      hidden: false,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    }
    vi.stubGlobal('document', page)
    const time = clock()
    const motion = createExplodeMotion(0, { ...time.options, durationMs: 1000 })
    motion.moveTo(1)
    time.tick()
    time.tick(250)
    const before = motion.value
    page.hidden = true
    events.dispatchEvent(new Event('visibilitychange'))
    expect(time.pending()).toBe(0)
    page.hidden = false
    events.dispatchEvent(new Event('visibilitychange'))
    // The first frame back counts from itself, not from before the tab was hidden.
    time.tick(60_000)
    expect(motion.value).toBeCloseTo(before)
    time.tick(250)
    expect(motion.value).toBeGreaterThan(before)
    expect(motion.value).toBeLessThan(1)
  })
})
