import { describe, expect, it } from 'vitest'
import {
  BOX_ENVELOPE,
  defaultStock,
  echoesStock,
  fixedBoxCheck,
  NO_FIRST_FOLDER,
  parseStock,
  placedAlong,
  sameStock,
  stockEdited,
  stockRequest,
  TILTED_FIRST_FOLDER,
  type FixedStock,
} from '../../src/inputs/stock'
import { fromInput, toInput } from '../../src/units/units'

describe('stock inputs', () => {
  it('uses legacy inch and metric defaults in canonical millimetres, with round stock upright', () => {
    expect(defaultStock()).toMatchObject({ oversizeX: 0.762, oversizeZBottom: 6.35, snapZ: 6.35 })
    expect(defaultStock('automaticFlatBar', 'mm')).toMatchObject({
      oversizeX: 0.5,
      oversizeZBottom: 5,
      snapZ: 5,
    })
    expect(defaultStock('automaticRoundStock')).toMatchObject({
      radialOversize: 0.762,
      axialOversize: 0.762,
      gripStock: 6.35,
      verticalAxis: true,
    })
    expect(fromInput('length', 0.03, 'in')).toBe(0.762)
    expect(toInput('length', 6.35, 'in')).toBe(0.25)
  })

  it('accepts omitted automatic figures and explicit zero without filling either in', () => {
    expect(parseStock({ mode: 'automaticFlatBar' })).toEqual({ mode: 'automaticFlatBar' })
    expect(
      parseStock({
        mode: 'automaticRoundStock',
        gripStock: 0,
        lengthRoundToNearest: 0,
        verticalAxis: true,
      }),
    ).toEqual({
      mode: 'automaticRoundStock',
      gripStock: 0,
      lengthRoundToNearest: 0,
      verticalAxis: true,
    })
  })

  it.each([-1, 763, Infinity, NaN, null, '6.35'])(
    'rejects invalid automatic figures: %s',
    (oversizeX) => {
      expect(typeof parseStock({ mode: 'automaticFlatBar', oversizeX })).toBe('string')
    },
  )

  it('rejects legacy wire names and mixed sizing modes instead of silently discarding them', () => {
    expect(typeof parseStock({ mode: 'automaticFlatBar', xOversize: 1 })).toBe('string')
    expect(
      typeof parseStock({
        mode: 'fixedCylinder',
        diameter: 10,
        length: 20,
        position: 'modelCentered',
        oversizeX: 2,
      }),
    ).toBe('string')
    expect(typeof parseStock({ mode: 'automaticRoundStock', verticalAxis: 'true' })).toBe('string')
  })

  it('takes a fixed box in model axes that fits the envelope some way round', () => {
    const stock = {
      mode: 'fixedBox',
      dimensions: { x: 1270, y: 2032, z: 762 },
      position: 'offsetFromBottom',
      positionOffset: -10,
    }
    expect(parseStock(stock)).toEqual(stock)
    // Which side is the thickness is the first folder's to say (`stockRequest`).
    expect(parseStock({ ...stock, dimensions: { x: 100, y: 100, z: 763 } })).toMatchObject({
      dimensions: { z: 763 },
    })
    expect(typeof parseStock({ ...stock, dimensions: { x: 1271, y: 1271, z: 100 } })).toBe('string')
    expect(typeof parseStock({ ...stock, dimensions: { x: 0, y: 10, z: 20 } })).toBe('string')
  })

  it('checks the cylinder’s diameter × diameter × length envelope and position', () => {
    const stock = {
      mode: 'fixedCylinder',
      diameter: 762,
      length: 2032,
      position: 'offsetFromTop',
      positionOffset: 2032,
    }
    expect(parseStock(stock)).toEqual(stock)
    expect(typeof parseStock({ ...stock, diameter: 763 })).toBe('string')
    expect(typeof parseStock({ ...stock, positionOffset: 2033 })).toBe('string')
    expect(typeof parseStock({ ...stock, position: 'offset_from_top' })).toBe('string')
  })

  it('compares values rather than property order, including nested dimensions', () => {
    expect(
      sameStock(
        { mode: 'fixedBox', position: 'modelCentered', dimensions: { x: 1, y: 2, z: 3 } },
        { dimensions: { z: 3, y: 2, x: 1 }, position: 'modelCentered', mode: 'fixedBox' },
      ),
    ).toBe(true)
    expect(sameStock(defaultStock(), defaultStock('automaticRoundStock'))).toBe(false)
  })
})

const vec = (x: number, y: number, z: number) => ({ x, y, z })
const box = (
  x: number,
  y: number,
  z: number,
  position: FixedStock['position'] = 'modelCentered',
  positionOffset?: number,
): FixedStock => ({
  mode: 'fixedBox',
  dimensions: { x, y, z },
  position,
  ...(positionOffset === undefined ? {} : { positionOffset }),
})

describe('a fixed box sent in the first setup’s frame', () => {
  it.each([
    ['+X', vec(1, 0, 0), { x: 2, y: 3, z: 1 }],
    ['−X', vec(-1, 0, 0), { x: 2, y: 3, z: 1 }],
    ['+Y', vec(0, 1, 0), { x: 1, y: 3, z: 2 }],
    ['−Y', vec(0, -1, 0), { x: 1, y: 3, z: 2 }],
    ['+Z', vec(0, 0, 1), { x: 1, y: 2, z: 3 }],
    ['−Z', vec(0, 0, -1), { x: 1, y: 2, z: 3 }],
  ])('facing %s, its thickness is the side along it', (_name, first, dimensions) => {
    expect(stockRequest(box(1, 2, 3), first)).toEqual(box(dimensions.x, dimensions.y, dimensions.z))
  })

  it('sends the 203.2 × 31.75 × 82.55 box of a part first set up facing −Y as 203.2 × 82.55 × 31.75', () => {
    expect(stockRequest(box(203.2, 31.75, 82.55), vec(0, -1, 0))).toEqual(box(203.2, 82.55, 31.75))
  })

  it('keeps the position and its offset: top and bottom are along the first direction already', () => {
    expect(stockRequest(box(1, 2, 3, 'offsetFromTop', 1.5), vec(-1, 0, 0))).toEqual(
      box(2, 3, 1, 'offsetFromTop', 1.5),
    )
    expect(stockRequest(box(1, 2, 3, 'offsetFromBottom', -2), vec(0, 1, 0))).toEqual(
      box(1, 3, 2, 'offsetFromBottom', -2),
    )
  })

  it('reads a direction a hair off its axis as along it', () => {
    expect(stockRequest(box(1, 2, 3), vec(1e-12, -1, 0))).toEqual(box(1, 3, 2))
  })

  it('can’t be sent without a first folder, or with one facing off the axes', () => {
    expect(stockRequest(box(1, 2, 3), null)).toBe(NO_FIRST_FOLDER)
    expect(stockRequest(box(1, 2, 3), vec(0, Math.SQRT1_2, Math.SQRT1_2))).toBe(TILTED_FIRST_FOLDER)
  })

  it('applies the envelope in that frame: 30 in along the direction, 80 × 50 in across it', () => {
    expect(stockRequest(box(100, 763, 100), vec(0, 0, 1))).toEqual(box(100, 763, 100))
    expect(stockRequest(box(100, 763, 100), vec(0, 1, 0))).toBe(BOX_ENVELOPE)
  })

  it('sends any other stock as it is, with or without a first folder', () => {
    expect(stockRequest(defaultStock(), null)).toEqual(defaultStock())
    const cylinder = {
      mode: 'fixedCylinder' as const,
      diameter: 10,
      length: 20,
      position: 'modelCentered' as const,
    }
    expect(stockRequest(cylinder, vec(0, 0.6, 0.8))).toEqual(cylinder)
  })
})

describe('a calculation echoing the stock it was sent', () => {
  const frame = (axis: { x: number; y: number; z: number }) => ({
    location: vec(0, 0, 0),
    axis,
    refDirection: vec(1, 0, 0),
  })
  const envelope = (input: unknown, axis?: { x: number; y: number; z: number }) => ({
    input,
    resolved: axis ? { lower: vec(0, 0, 0), upper: vec(1, 1, 1), frame: frame(axis) } : null,
  })

  it('echoes a fixed box turned into the frame Toolpath placed it in', () => {
    const policy = box(203.2, 31.75, 82.55)
    expect(echoesStock(policy, envelope(box(203.2, 82.55, 31.75), vec(0, -1, 0)))).toBe(true)
    // The box as stored, in model axes, is not what was sent.
    expect(echoesStock(policy, envelope(policy, vec(0, -1, 0)))).toBe(false)
    // Placed along another axis than it was turned for.
    expect(echoesStock(policy, envelope(box(203.2, 82.55, 31.75), vec(0, 0, 1)))).toBe(false)
  })

  it('with no placement to read, takes the box turned for any of the part’s axes', () => {
    const policy = box(203.2, 31.75, 82.55)
    expect(echoesStock(policy, envelope(box(203.2, 82.55, 31.75)))).toBe(true)
    expect(echoesStock(policy, envelope(box(82.55, 203.2, 31.75)))).toBe(false)
  })

  it('compares any other stock as it is', () => {
    expect(echoesStock(defaultStock(), envelope(defaultStock()))).toBe(true)
    expect(echoesStock(defaultStock(), envelope(defaultStock('automaticRoundStock')))).toBe(false)
    expect(echoesStock(defaultStock(), undefined)).toBe(false)
  })

  it('reads the shown stock as edited until a calculation echoes it', () => {
    const policy = box(203.2, 31.75, 82.55)
    const baseline = { stock: envelope(box(203.2, 82.55, 31.75), vec(0, -1, 0)) }
    expect(stockEdited(policy, baseline)).toBe(false)
    expect(stockEdited(box(203.2, 31.75, 90), baseline)).toBe(true)
    expect(stockEdited(null, baseline)).toBe(false)
  })
})

describe('a fixed box held for Apply', () => {
  const size = { length: 203.2, width: 30.48, height: 76.2 }

  it('says why it can’t be sent, which Apply waits on', () => {
    expect(fixedBoxCheck(box(210, 40, 80), null, size, 'mm')).toEqual({
      problem: NO_FIRST_FOLDER,
      applyReason: NO_FIRST_FOLDER,
    })
    expect(fixedBoxCheck(box(210, 40, 80), vec(0.6, 0, 0.8), size, 'mm')).toEqual({
      problem: TILTED_FIRST_FOLDER,
      applyReason: TILTED_FIRST_FOLDER,
    })
    expect(fixedBoxCheck(box(210, 763, 80), vec(0, -1, 0), size, 'mm')).toEqual({
      problem: BOX_ENVELOPE,
      applyReason: 'Fix the stock first',
    })
  })

  it('says how far the part stands outside it, along the axis it stands out most', () => {
    expect(fixedBoxCheck(box(200, 31.75, 82.55), vec(0, -1, 0), size, 'mm')).toEqual({
      problem: 'The part stands 1.6 mm outside the box along X.',
      applyReason: 'Fix the stock first',
    })
    // Offset from the top along −Y: the box's top 2 mm beyond the part's −Y face, 31.75 deep,
    // leaves 0.73 mm of the part out past the box's bottom.
    expect(
      fixedBoxCheck(box(210, 31.75, 82.55, 'offsetFromTop', 2), vec(0, -1, 0), size, 'mm'),
    ).toEqual({
      problem: 'The part stands 0.73 mm outside the box along Y.',
      applyReason: 'Fix the stock first',
    })
  })

  it('fits a box that encloses the part, and notes a box Toolpath turns', () => {
    expect(fixedBoxCheck(box(203.2, 31.75, 82.55), vec(0, -1, 0), size, 'mm')).toBeNull()
    expect(fixedBoxCheck(box(82.55, 31.75, 203.2), vec(0, -1, 0), size, 'mm')).toEqual({
      note: expect.stringContaining('quarter turn'),
    })
  })

  it('checks no fit without the part’s size, and nothing of other stock', () => {
    expect(fixedBoxCheck(box(1, 1, 1), vec(0, 0, 1), null, 'mm')).toBeNull()
    expect(fixedBoxCheck(defaultStock(), null, size, 'mm')).toBeNull()
    expect(fixedBoxCheck(null, null, size, 'mm')).toBeNull()
  })
})

describe('the direction a calculation placed its stock along', () => {
  const resolvedCylinder = (axis: { x: number; y: number; z: number }) => ({
    shape: 'cylinder',
    origin: vec(0, 0, 0),
    axis,
    diameter: 10,
    length: 20,
  })
  const fixedCylinder = {
    mode: 'fixedCylinder',
    diameter: 10,
    length: 20,
    position: 'modelCentered',
  }
  const upright = { mode: 'automaticRoundStock', verticalAxis: true }

  it('reads a box’s frame z', () => {
    const frame = { location: vec(0, 0, 0), axis: vec(0, -1, 0), refDirection: vec(1, 0, 0) }
    expect(
      placedAlong({
        input: defaultStock(),
        resolved: { lower: vec(0, 0, 0), upper: vec(1, 1, 1), frame },
      }),
    ).toEqual(vec(0, -1, 0))
  })

  it('reads the axis of a cylinder stood along the direction, snapped onto X, Y or Z', () => {
    expect(
      placedAlong({ input: fixedCylinder, resolved: resolvedCylinder(vec(0, -1, 0)) }),
    ).toEqual(vec(0, -1, 0))
    expect(placedAlong({ input: upright, resolved: resolvedCylinder(vec(1e-12, 0, 1)) })).toEqual(
      vec(0, 0, 1),
    )
    expect(
      placedAlong({
        input: upright,
        resolved: resolvedCylinder(vec(0, Math.SQRT1_2, Math.SQRT1_2)),
      }),
    ).toBeNull()
  })

  it('reads none from a lying round bar, whose axis is the part’s long side', () => {
    const lying = resolvedCylinder(vec(1, 0, 0))
    expect(placedAlong({ input: { mode: 'automaticRoundStock' }, resolved: lying })).toBeNull()
    expect(
      placedAlong({ input: { mode: 'automaticRoundStock', verticalAxis: false }, resolved: lying }),
    ).toBeNull()
    expect(placedAlong({ input: defaultStock(), resolved: null })).toBeNull()
  })
})
