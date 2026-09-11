import { describe, expect, it } from 'vitest'
import { TAP_SLOP, movedFar, trackDoubleTaps } from '../src/render/tap.js'

/**
 * The whole distinction the viewport rests on: a press that ends where it
 * started is a click on a face, and one that travelled is the end of an orbit.
 */
describe('movedFar', () => {
  const at = (clientX: number, clientY: number) => ({ clientX, clientY })

  it('lets a hand shake without turning a click into a drag', () => {
    expect(movedFar(at(100, 100), at(102, 101))).toBe(false)
  })

  it('calls a real drag a drag, in any direction', () => {
    expect(movedFar(at(100, 100), at(140, 100))).toBe(true)
    expect(movedFar(at(100, 100), at(100, 60))).toBe(true)
    expect(movedFar(at(100, 100), at(70, 70))).toBe(true)
  })

  it('measures the distance rather than either axis', () => {
    // Three pixels each way is more than four pixels of travel, and a slop that
    // compared axes separately would call this a click.
    expect(movedFar(at(0, 0), at(3, 3))).toBe(true)
    expect(TAP_SLOP).toBeGreaterThan(0)
  })
})

describe('pairing presses into a double tap by hand', () => {
  /*
   * `dblclick` fires for the primary button only, so the middle-button
   * re-frame has to be assembled from single presses.
   */
  const at = (x: number, y: number, timeStamp: number) => ({ clientX: x, clientY: y, timeStamp })

  it('pairs two presses in the same place, close enough together', () => {
    const doubles = trackDoubleTaps()

    expect(doubles.isDouble(at(10, 10, 0))).toBe(false)
    expect(doubles.isDouble(at(10, 10, 200))).toBe(true)
  })

  it('does not pair two presses too far apart in time', () => {
    const doubles = trackDoubleTaps()

    doubles.isDouble(at(10, 10, 0))
    expect(doubles.isDouble(at(10, 10, 600))).toBe(false)
  })

  it('forgets the waiting press when the caller says the pair was broken', () => {
    /*
     * Clicking a face, pressing something in a panel and clicking the same face
     * again is three gestures, and the clock cannot tell it from two: it lands
     * well inside the window and at the same place. The caller can see the
     * pointer leave, so it is the caller that says so.
     */
    const doubles = trackDoubleTaps()

    doubles.isDouble(at(10, 10, 0))
    doubles.reset()

    expect(doubles.isDouble(at(10, 10, 100))).toBe(false)
  })

  it('still pairs the presses that follow a reset', () => {
    const doubles = trackDoubleTaps()

    doubles.reset()
    expect(doubles.isDouble(at(10, 10, 0))).toBe(false)
    expect(doubles.isDouble(at(10, 10, 100))).toBe(true)
  })

  it('does not pair two presses too far apart on screen', () => {
    // Two quick clicks at opposite corners are two clicks that happened to be
    // quick, not one gesture — re-framing there is somebody else's view lost.
    const doubles = trackDoubleTaps()

    doubles.isDouble(at(10, 10, 0))
    expect(doubles.isDouble(at(400, 300, 100))).toBe(false)
  })

  it('reads three presses as one double and one single, not two doubles', () => {
    const doubles = trackDoubleTaps()

    expect(doubles.isDouble(at(0, 0, 0))).toBe(false)
    expect(doubles.isDouble(at(0, 0, 100))).toBe(true)
    expect(doubles.isDouble(at(0, 0, 200))).toBe(false)
  })
})
