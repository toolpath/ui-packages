import { describe, expect, it } from 'vitest'
import { normalizePartReport } from '../src/engine/normalize.js'
import { withoutFeatures } from '../src/model/without-features.js'
import type { PartModel } from '../src/model/types.js'
import { buildPick } from '../src/render/picking.js'
import { directionHighlights } from '../src/render/direction-highlights.js'
import { cubeModel, loadReportFixture } from './fixtures.js'

/** The cube's +Z face reading of region 1, and its +Z wall reading of region 2. */
const TOP_FACE = '8d551bf6db7931e8'
const TOP_WALL = '44f9e9d0eccaea'

/** A click on region 1 of the cube, from +Z. */
const clickTop = (model: PartModel) => {
  const top = model.candidateDirections.findIndex((direction) => direction.z === 1)
  const triangle = model.regions.find((region) => region.idx === 1)!.triangles.start
  return buildPick({
    model,
    region: 1,
    triangleIndex: triangle,
    point: [0, 0, 0],
    normal: [0, 0, 1],
    activeDirection: top,
  })
}

describe('withoutFeatures', () => {
  it('leaves a feature out of the features and of every face it held', () => {
    const model = cubeModel()
    const cut = withoutFeatures(model, [TOP_FACE])

    expect(cut.features.map((feature) => feature.tag)).not.toContain(TOP_FACE)
    expect(cut.features).toHaveLength(model.features.length - 1)
    expect(cut.regionIndex.featuresForRegion(1)).not.toContain(TOP_FACE)
    expect(cut.regionIndex.featuresForRegion(1)).toEqual(
      model.regionIndex.featuresForRegion(1).filter((tag) => tag !== TOP_FACE),
    )
    expect(cut.regionIndex.regionsForFeature(TOP_FACE)).toEqual([])
    // The faces and their triangles are the part's still.
    expect(cut.regions).toBe(model.regions)
    expect(cut.regionIndex.regionForTriangle(0)).toBe(model.regionIndex.regionForTriangle(0))
  })

  it('sends a pick to the face’s other owners', () => {
    const model = cubeModel()
    expect(clickTop(model).best).toBe(TOP_FACE)
    const after = clickTop(withoutFeatures(model, [TOP_FACE]))
    expect(after.owners).not.toContain(TOP_FACE)
    expect(after.best).not.toBe(TOP_FACE)
  })

  it('paints no direction for a face only the features left out held', () => {
    const model = cubeModel()
    const top = model.candidateDirections.findIndex((direction) => direction.z === 1)
    const holders = model.features.filter(
      (feature) => feature.regionIdxs.includes(2) && feature.machiningDirection.z === 1,
    )
    const cut = withoutFeatures(
      model,
      holders.map((feature) => feature.tag),
    )
    expect(directionHighlights(model, top).map((each) => each.region)).toContain(2)
    expect(directionHighlights(cut, top).map((each) => each.region)).not.toContain(2)
    expect(holders.map((feature) => feature.tag)).toContain(TOP_WALL)
  })

  it('reads tags in any case, passes over one it does not hold, and keeps the model when none go', () => {
    const model = cubeModel()
    expect(withoutFeatures(model, [TOP_FACE.toUpperCase()]).features).toHaveLength(
      model.features.length - 1,
    )
    expect(withoutFeatures(model, ['ffffffffffffffff'])).toBe(model)
    expect(withoutFeatures(model, [])).toBe(model)
  })

  it('is what normalizePartReport makes with the option', () => {
    const report = loadReportFixture('local-0.3.0-cube')
    const cut = normalizePartReport(report, { withoutFeatures: [TOP_FACE] })
    expect(cut.features).toEqual(withoutFeatures(normalizePartReport(report), [TOP_FACE]).features)
    expect(cut.regionIndex.featuresForRegion(1)).not.toContain(TOP_FACE)
  })
})
