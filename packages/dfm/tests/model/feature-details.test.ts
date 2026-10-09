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

describe('featureMeasurements: an undercut', () => {
  const tslot = feature('t', { featureType: 'undercut_filleted_tslot' })
  // A wall reading on the slot's cutter band, as `featureSheet` makes for a slot with walls.
  const tslotSheet = {
    kind: 'Tslot',
    zMin: -12,
    zMax: -7,
    extendedZMax: 0,
    maxTool: 20,
    filletRadius: 0.5,
    cornerRadius: 10,
    undercut: { undercutDepth: 6, maxEntry: 8 },
  }

  it('gives a T-slot its width and depth, and the cutter and shaft it takes', () => {
    const rows = rowsOf(tslot, { t: tslotSheet })
    expect(rows.filter((row) => !row.milling).map((row) => row.key)).toEqual([
      'undercutWidth',
      'undercutDepth',
      'floorFillet',
    ])
    expect(rows.filter((row) => row.milling).map((row) => row.key)).toEqual([
      'undercutCutter',
      'maxShaft',
      'depthBelowTop',
      'topLd',
    ])
    expect(byKey(rows, 'undercutWidth')).toMatchObject({ label: 'Undercut width', value: '5 mm' })
    expect(byKey(rows, 'undercutDepth')).toMatchObject({ label: 'Undercut depth', value: '6 mm' })
    expect(byKey(rows, 'undercutCutter')).toMatchObject({
      label: 'Max cutting diameter',
      value: '⌀ 20 mm · R 0.5 mm',
    })
    expect(byKey(rows, 'maxShaft')).toMatchObject({ label: 'Max shaft diameter', value: '⌀ 8 mm' })
  })

  it('takes the L/D to the top of the part over the cutter’s head', () => {
    // L = 0 − (−12) = 12, D = 20.
    expect(byKey(rowsOf(tslot, { t: tslotSheet }), 'topLd')).toMatchObject({
      label: 'L/D to top of part',
      value: '0.600',
    })
  })

  it('reads no wall corner, wall tool or feature L/D off the cutter band', () => {
    const keys = rowsOf(tslot, { t: tslotSheet }).map((row) => row.key)
    for (const key of ['featureDepth', 'cornerRadius', 'pinch', 'featureLd'])
      expect(keys).not.toContain(key)
  })

  it('keeps the shaft narrow enough for the head to reach the back of the groove', () => {
    // An open slot: the head is the band's 20, and 20 − 2 × 6 = 8 holds the shaft as the entry does.
    const reaching = rowsOf(tslot, {
      t: { ...tslotSheet, undercut: { undercutDepth: 6, maxEntry: 30 } },
    })
    expect(byKey(reaching, 'maxShaft')?.value).toBe('⌀ 8 mm')
  })

  it('brings a closed slot’s head down through its opening, and its shaft in under that', () => {
    // A ring groove in a bore, as UDH3's: the band and the entry both 14.4, the undercut 0.254.
    const ring = {
      ...tslotSheet,
      maxTool: 14.5,
      undercut: { undercutDepth: 0.254, maxEntry: 14.4, isClosed: true as const },
    }
    const rows = rowsOf(tslot, { t: ring })
    expect(byKey(rows, 'undercutCutter')?.value).toBe('⌀ 14.4 mm · R 0.5 mm')
    // 14.4 − 2 × 0.254 = 13.892: a head and shaft the same size reach no undercut at all.
    expect(byKey(rows, 'maxShaft')?.value).toBe('⌀ 13.892 mm')
    // L = 12, D = 14.4.
    expect(byKey(rows, 'topLd')?.value).toBe('0.833')
  })

  it('says when nothing limits the shaft, and when nothing fits through', () => {
    const open = rowsOf(tslot, { t: { ...tslotSheet, undercut: {} } })
    expect(byKey(open, 'maxShaft')?.value).toBe('No limit')
    // Nothing comes through the opening, so no cutter does: no shaft, and no L/D over a head it cannot carry.
    const shut = rowsOf(tslot, { t: { ...tslotSheet, undercut: { maxEntry: 0 } } })
    expect(byKey(shut, 'undercutCutter')?.value).toBe('None fits')
    for (const key of ['maxShaft', 'topLd']) expect(byKey(shut, key)).toBeUndefined()
  })

  it('gives a dovetail its widths, depth and angle, and its cutter at that angle', () => {
    const dovetail = feature('d', { featureType: 'undercut_dovetail' })
    const rows = rowsOf(dovetail, {
      d: {
        kind: 'Dovetail',
        zMin: -6,
        zMax: 0,
        extendedZMax: 0,
        maxTool: 16,
        undercut: { taperDeg: 30, floorWidth: 16, topOpeningWidth: 10 },
      },
    })
    expect(rows.filter((row) => !row.milling).map((row) => row.key)).toEqual([
      'featureDepth',
      'floorWidth',
      'openingWidth',
      'undercutDepth',
      'taper',
    ])
    // (16 − 10) / 2: each side overhangs by half the difference.
    expect(byKey(rows, 'undercutDepth')?.value).toBe('3 mm')
    expect(byKey(rows, 'taper')?.value).toBe('30° from the tool axis')
    expect(byKey(rows, 'undercutCutter')).toMatchObject({
      label: 'Max cutting diameter',
      value: '⌀ 16 mm · 30°',
    })
    expect(byKey(rows, 'maxShaft')?.value).toBe('⌀ 10 mm')
  })

  it('offers no cutter where the head cannot reach past a shaft, or is next to no tool', () => {
    // A closed slot 1 wide with a 0.6 undercut: 1 − 2 × 0.6 leaves no shaft.
    const deep = rowsOf(tslot, {
      t: { ...tslotSheet, undercut: { undercutDepth: 0.6, maxEntry: 1, isClosed: true } },
    })
    expect(byKey(deep, 'undercutCutter')?.value).toBe('None fits')
    for (const key of ['maxShaft', 'topLd']) expect(byKey(deep, key)).toBeUndefined()
    // An opening of 0.02 mm drops in no head worth the name.
    const pinhole = rowsOf(tslot, {
      t: { ...tslotSheet, undercut: { undercutDepth: 0.01, maxEntry: 0.02, isClosed: true } },
    })
    expect(byKey(pinhole, 'undercutCutter')?.value).toBe('None fits')
  })

  it('gives no shaft where no cutter fits the groove at all', () => {
    const rows = rowsOf(tslot, { t: { ...tslotSheet, noToolFits: true } })
    expect(byKey(rows, 'undercutCutter')?.value).toBe('None fits')
    expect(byKey(rows, 'maxShaft')).toBeUndefined()
  })

  it('keeps a dovetail’s shaft narrow enough for the head to reach under the overhang', () => {
    const dovetail = feature('d', { featureType: 'undercut_dovetail' })
    // Floor 16, top 10: 3 each side. A 12 head leaves 12 − 6 = 6 for the shaft, not the opening's 10.
    const rows = rowsOf(dovetail, {
      d: { kind: 'Dovetail', maxTool: 12, undercut: { floorWidth: 16, topOpeningWidth: 10 } },
    })
    expect(byKey(rows, 'maxShaft')?.value).toBe('⌀ 6 mm')
  })

  it('gives a dovetail that runs out no single depth', () => {
    const dovetail = feature('d', { featureType: 'undercut_dovetail' })
    const rows = rowsOf(dovetail, {
      d: { kind: 'Dovetail', undercut: { floorWidth: 16, topOpeningWidth: 10, isExternal: true } },
    })
    expect(byKey(rows, 'undercutDepth')).toBeUndefined()
  })

  it('offers no cutter for one the Engine could not measure', () => {
    const rows = rowsOf(tslot, {
      t: { ...tslotSheet, undercut: { maxEntry: 0, unmeasured: true } },
    })
    expect(byKey(rows, 'undercutCutter')).toMatchObject({ value: 'Not measured', milling: true })
    for (const key of ['maxShaft', 'topLd']) expect(byKey(rows, key)).toBeUndefined()
  })

  it('writes the cutter in inches too', () => {
    const rows = featureMeasurements({
      features: [tslot],
      feature: tslot,
      sheets: { t: tslotSheet },
      units: 'inch',
    })
    expect(byKey(rows, 'undercutCutter')).toMatchObject({
      value: '⌀ 0.787 in · R 0.02 in',
      alt: '⌀ 20 mm · R 0.5 mm',
    })
  })
})

describe('featureMeasurements: lengths in inches', () => {
  it('writes an inch length to a thousandth, as the other measured figures are', () => {
    const hole = feature('h1', { featureType: 'hole' })
    expect(byKey(rowsOf(hole, { h1: { diameter: 11.684 } }), 'diameter')).toMatchObject({
      value: '11.684 mm',
      alt: '0.46 in',
    })
  })
})

describe('featureMeasurements: how inches are written', () => {
  const hole = feature('h', { featureType: 'blind_hole' })
  const sheets: FeatureSheets = { h: { diameter: 12.7, zMin: -25.4, zMax: 0 } }

  it('writes `in` by default, and the inch mark when asked', () => {
    const inches = (inchMark?: boolean) =>
      byKey(
        featureMeasurements({ features: [hole], feature: hole, sheets, units: 'inch', inchMark }),
        'diameter',
      )?.value
    expect(inches()).toBe('0.5 in')
    expect(inches(true)).toBe('0.5"')
  })
})
