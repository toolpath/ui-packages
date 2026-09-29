import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BANANA_GAP, bananaFrameBounds, bananaPosition } from '../src/render/banana.js'

const box = (min: readonly [number, number, number], max: readonly [number, number, number]) =>
  new Box3(new Vector3(...min), new Vector3(...max))

describe('banana placement', () => {
  it('stands on the part ground and clears its right side', () => {
    const part = box([-10, -20, 5], [30, 20, 45])
    const banana = box([-4, -3, 0], [4, 3, 100])
    const position = bananaPosition(part, banana)

    expect(position.x + banana.min.x).toBeCloseTo(part.max.x + 40 * BANANA_GAP)
    expect(position.y + (banana.min.y + banana.max.y) / 2).toBeCloseTo(0)
    expect(position.z + banana.min.z).toBe(part.min.z)
  })

  it('returns bounds that contain both objects for explicit framing', () => {
    const part = box([0, 0, 0], [10, 10, 10])
    const banana = box([0, 0, 0], [2, 2, 2])
    const bounds = bananaFrameBounds(part, banana, new Vector3(20, 0, 0))

    expect(bounds.min.toArray()).toEqual([0, 0, 0])
    expect(bounds.max.toArray()).toEqual([22, 10, 10])
  })
})
