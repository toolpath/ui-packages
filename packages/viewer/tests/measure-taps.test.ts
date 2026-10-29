import { describe, expect, it } from 'vitest'
import { classifyTap, countFingers } from '../src/render/measure-taps.js'
import { VIEW_CUBE_HALF_PX } from '../src/render/view-cube.js'

const viewport = { width: 400, height: 800 }
const viewCube = { margin: [60, 60] as const }
/** The cube's centre, `margin` in from the top right corner. */
const cube = { x: 340, y: 60 }
const tap = {
  measuring: true,
  fingers: 1,
  pointer: { x: 200, y: 400 },
  viewport,
  viewCube,
}

describe('classifyTap', () => {
  it('is the part’s with one finger, off the cube', () => {
    expect(classifyTap(tap)).toBe('part')
  })

  it('is nothing while the tool is waiting', () => {
    expect(classifyTap({ ...tap, measuring: false })).toBe('none')
  })

  it('is a pinch’s lift when two fingers were down in the gesture', () => {
    expect(classifyTap({ ...tap, fingers: 2 })).toBe('pinch')
  })

  it('is the cube’s on its centre, and up to its corner’s reach', () => {
    expect(classifyTap({ ...tap, pointer: cube })).toBe('cube')
    const reach = VIEW_CUBE_HALF_PX * Math.sqrt(3)
    expect(classifyTap({ ...tap, pointer: { x: cube.x - reach + 1, y: cube.y } })).toBe('cube')
    expect(classifyTap({ ...tap, pointer: { x: cube.x - reach - 2, y: cube.y } })).toBe('part')
  })

  it('reads a pinch before the cube', () => {
    expect(classifyTap({ ...tap, fingers: 2, pointer: cube })).toBe('pinch')
  })

  it('is the part’s where the cube would be, with no cube', () => {
    expect(classifyTap({ ...tap, pointer: cube, viewCube: null })).toBe('part')
  })
})

describe('countFingers', () => {
  it('keeps the most fingers down until a gesture’s first finger lands', () => {
    const fingers = countFingers()
    fingers.land(1)
    fingers.land(2)
    fingers.land(1)
    expect(fingers.most()).toBe(1)
    fingers.land(2)
    fingers.land(3)
    expect(fingers.most()).toBe(3)
  })
})
