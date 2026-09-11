import { describe, expect, it } from 'vitest'
import {
  ORBIT_TARGET_FADE_MS,
  ORBIT_TARGET_PIXELS,
  ORBIT_TARGET_RING_PIXELS,
  ORBIT_TARGET_RING_WIDTH,
  orbitTargetOpacity,
} from '../src/render/target.js'

describe('orbitTargetOpacity', () => {
  it('is full while something is still holding it up', () => {
    // A drag in progress, or a flash inside its window, both arrive negative.
    expect(orbitTargetOpacity(-1)).toBe(1)
    expect(orbitTargetOpacity(-ORBIT_TARGET_FADE_MS)).toBe(1)
    expect(orbitTargetOpacity(0)).toBe(1)
  })

  it('fades to nothing across the window, and stays there', () => {
    expect(orbitTargetOpacity(ORBIT_TARGET_FADE_MS / 2)).toBeCloseTo(0.5)
    expect(orbitTargetOpacity(ORBIT_TARGET_FADE_MS)).toBe(0)
    expect(orbitTargetOpacity(ORBIT_TARGET_FADE_MS * 10)).toBe(0)
  })

  it('never leaves the range a material can take', () => {
    for (const since of [-1e9, -1, 0, 1, 250, 999, 1000, 1e9]) {
      const opacity = orbitTargetOpacity(since)
      expect(opacity).toBeGreaterThanOrEqual(0)
      expect(opacity).toBeLessThanOrEqual(1)
    }
  })

  it('goes straight out rather than dividing by zero', () => {
    // A consumer of the curve could ask for no fade at all; the frame that runs
    // next must get a number rather than `NaN`, which a material takes silently
    // and then renders as nothing at all.
    expect(orbitTargetOpacity(1, 0)).toBe(0)
    expect(orbitTargetOpacity(0, 0)).toBe(1)
  })
})

describe('the two circles', () => {
  it('leaves the dot room inside the ring', () => {
    // A ring drawn close around the dot is a blob at the size either of them
    // actually appears, and the gap between them is the whole shape.
    const inner = ORBIT_TARGET_RING_PIXELS * (1 - ORBIT_TARGET_RING_WIDTH)
    expect(inner).toBeGreaterThan(ORBIT_TARGET_PIXELS * 2)
  })

  it('keeps the ring thin enough to read as a ring', () => {
    expect(ORBIT_TARGET_RING_WIDTH).toBeGreaterThan(0)
    expect(ORBIT_TARGET_RING_WIDTH).toBeLessThan(0.5)
  })
})
