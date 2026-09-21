import { describe, expect, it } from 'vitest'
import { directionHighlights } from '../src/render/direction-highlights.js'
import { directionColor } from '../src/render/theme.js'
import { cubeModel } from './fixtures.js'

describe('directionHighlights', () => {
  it('paints each shared region once and is independent of feature array order', () => {
    const model = cubeModel()
    const colors = directionHighlights(model)
    expect(colors.length).toBeGreaterThan(0)
    expect(new Set(colors.map((entry) => entry.region)).size).toBe(colors.length)
    expect(directionHighlights({ ...model, features: [...model.features].reverse() })).toEqual(
      colors,
    )
  })

  it('scopes the wash to reachable regions and uses the arrow palette', () => {
    const model = cubeModel()
    const colors = directionHighlights(model, 0)
    expect(colors.length).toBeGreaterThan(0)
    expect(colors.every((entry) => entry.color === directionColor(0))).toBe(true)
    const direction = model.candidateDirections[0]!
    const reachable = new Set(
      model.features
        .filter(
          (feature) =>
            feature.machiningDirection.x === direction.x &&
            feature.machiningDirection.y === direction.y &&
            feature.machiningDirection.z === direction.z,
        )
        .flatMap((feature) => feature.regionIdxs),
    )
    expect(new Set(colors.map((entry) => entry.region))).toEqual(reachable)
    expect(directionHighlights(model, 100)).toEqual([])
  })

  it('does not invent a color for an unmatched machining direction', () => {
    expect(directionHighlights({ ...cubeModel(), candidateDirections: [] })).toEqual([])
  })

  it('prefers a specific feature to a profile sharing the same face', () => {
    const model = cubeModel()
    const face = model.features.find(
      (feature) => feature.featureType === 'face' && feature.machiningDirection.z === 1,
    )!
    const index = model.candidateDirections.findIndex((direction) => direction.z === 1)
    for (const region of face.regionIdxs) {
      expect(directionHighlights(model).find((entry) => entry.region === region)?.color).toBe(
        directionColor(index),
      )
    }
  })
})
