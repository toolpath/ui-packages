import { describe, expect, it } from 'vitest'
import { featureMeasurements, maxBallDiameter } from '../../src/model/feature-details.js'
import type { FeatureSheets } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'

const UP = { x: 0, y: 0, z: 1 }

const feature = (tag: string, over: Partial<DfmFeature> = {}): DfmFeature => ({
  tag,
  featureType: 'pocket',
  machiningDirection: UP,
  regionIdxs: [0],
  number: 0,
  ...over,
})

const rowsOf = (feat: DfmFeature, sheets: FeatureSheets) =>
  featureMeasurements({ features: [feat], feature: feat, sheets, units: 'mm' })

const byKey = (rows: ReturnType<typeof rowsOf>, key: string) => rows.find((row) => row.key === key)

describe('maxBallDiameter: the biggest ball under both limits', () => {
  it('is the diameter where the corner allows a full ball, else twice the corner', () => {
    expect(maxBallDiameter({ fitToolDiameter: 10, fitCornerRadius: 5 })).toBe(10)
    expect(maxBallDiameter({ fitToolDiameter: 10, fitCornerRadius: 2 })).toBe(4)
    expect(maxBallDiameter({ fitToolDiameter: 10, fitCornerRadius: 0 })).toBeUndefined()
    expect(maxBallDiameter({ fitToolDiameter: 10 })).toBeUndefined()
    // A fit with a corner limit and no diameter limit: the ball is the corner's.
    expect(maxBallDiameter({ fitCornerRadius: 0.5 })).toBe(1)
  })
})

describe('featureMeasurements: the tool rows of a surface', () => {
  it('names the biggest bull nose and ball nose, under milling considerations', () => {
    const surface = feature('s', { featureType: 'contour_surface' })
    const rows = rowsOf(surface, { s: { fitToolDiameter: 10, fitCornerRadius: 2 } })
    expect(byKey(rows, 'maxBull')).toMatchObject({
      label: 'Max bull nose',
      value: '⌀ 10 mm · R 2 mm',
      milling: true,
    })
    expect(byKey(rows, 'maxBall')).toMatchObject({
      label: 'Max ball nose',
      value: '⌀ 4 mm',
      milling: true,
    })
    expect(byKey(rows, 'finishTool')?.milling).toBe(true)
  })

  it('reads a fit that limits only the corner: a corner row, a bull nose of any size, a ball to draw', () => {
    const surface = feature('s', { featureType: 'contour_surface' })
    const rows = rowsOf(surface, { s: { fitCornerRadius: 0.5 } })
    expect(byKey(rows, 'fitCornerRadius')).toMatchObject({
      label: 'Max corner radius',
      value: '0.5 mm',
    })
    expect(byKey(rows, 'maxBull')).toMatchObject({ value: 'any ⌀ · R 0.5 mm' })
    expect(byKey(rows, 'maxBull')?.tool).toBeUndefined()
    expect(byKey(rows, 'maxBall')).toMatchObject({ value: '⌀ 1 mm', tool: 'ball' })
  })

  it('leaves out the bull nose where only a ball suits, or where the corner makes the tool a ball', () => {
    const surface = feature('s', { featureType: 'inner_fillet' })
    const ballOnly = rowsOf(surface, {
      s: { fitToolDiameter: 10, fitCornerRadius: 2, ballOnly: true },
    })
    expect(byKey(ballOnly, 'maxBull')).toBeUndefined()
    expect(byKey(ballOnly, 'maxBall')?.value).toBe('⌀ 4 mm')
    const round = rowsOf(surface, { s: { fitToolDiameter: 6, fitCornerRadius: 3 } })
    expect(byKey(round, 'maxBull')).toBeUndefined()
    expect(byKey(round, 'maxBall')?.value).toBe('⌀ 6 mm')
  })
})

describe('featureMeasurements: measurements against machining considerations', () => {
  const pocket = feature('p', { featureType: 'filleted_open_pocket' })
  const sheets: FeatureSheets = {
    p: { zMin: 0, zMax: 8, extendedZMax: 8, cornerRadius: 3, pinchDiameter: 6, filletRadius: 1 },
  }

  it('keeps the feature’s own shape under measurements and the tool and its reach under milling', () => {
    const rows = rowsOf(pocket, sheets)
    const measured = rows.filter((row) => !row.milling).map((row) => row.key)
    const milling = rows.filter((row) => row.milling).map((row) => row.key)
    expect(measured).toEqual(['featureDepth', 'cornerRadius', 'floorFillet'])
    expect(milling).toEqual(['pinch', 'depthBelowTop', 'featureLd', 'topLd'])
  })

  it('reads the minimum radius as a radius, and the max tool as a bull nose on a filleted floor', () => {
    const rows = rowsOf(pocket, sheets)
    expect(byKey(rows, 'cornerRadius')).toMatchObject({ label: 'Minimum radius', value: '3 mm' })
    expect(byKey(rows, 'pinch')).toMatchObject({
      label: 'Max tool diameter',
      value: '⌀ 6 mm · R 1 mm',
    })
  })

  it('marks a sharp corner on the radius row and names no tool for it', () => {
    const rows = rowsOf(pocket, { p: { cornerRadius: 0, sharpCorners: [{ x: 0, y: 0 }] } })
    expect(byKey(rows, 'cornerRadius')?.label).toBe('Minimum radius (sharp)')
    expect(byKey(rows, 'pinch')).toBeUndefined()
  })
})

describe('featureMeasurements: lengths in inches', () => {
  it('writes an inch length to four places, as the rule fields do', () => {
    const hole = feature('h1', { featureType: 'hole' })
    expect(byKey(rowsOf(hole, { h1: { diameter: 0.3175 } }), 'diameter')).toMatchObject({
      value: '0.318 mm',
      alt: '0.0125 in',
    })
  })
})
