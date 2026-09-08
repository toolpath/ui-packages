/**
 * What holds a tool, and what that decides.
 *
 * Two rules here refuse rather than assume, and both refuse for the same
 * reason: the unchecked case is a cutter falling out of a spindle.
 */

import { describe, expect, it } from 'vitest'

import {
  canHold,
  colletFitsHolder,
  defaultStickout,
  gripRanges,
  gripsAnyShank,
  gripsShank,
  holdBand,
  holderTakesTool,
  maxStickout,
  stickoutLimits,
  type Collet,
  type Holder,
  type StickoutTool,
} from '../src/index.js'

const bare: Holder = {
  noseDiameter: null,
  noseLength: null,
  bodyDiameter: null,
  bodyLength: null,
  projection: null,
  flangeDiameter: null,
  gaugeLength: null,
  colletSeries: null,
  colletProtrusion: null,
}

const chuck: Holder = { ...bare, clamping: 'collet', colletSeries: 'ER16', taper: 'BT30' }
const shrink: Holder = { ...bare, clamping: 'shrink', boreDiameter: 12, taper: 'BT30' }

const er16: Collet = { series: 'ER16', clampMin: 5.5, clampMax: 6, clampLength: 27.5 }
const er20: Collet = { series: 'ER20', clampMin: 9, clampMax: 10, clampLength: 30 }

const tool = { geometry: { DC: 6, OAL: 57, LCF: 13, SFDM: 6 } }
const sized: StickoutTool = { unitSystem: 'millimeters', geometry: tool.geometry }

describe('which collet goes in which holder', () => {
  it('needs the series to match exactly', () => {
    // A series is a mechanical interface, not a size class: an ER16 collet
    // does not go in an ER20 nose.
    expect(colletFitsHolder(er16, chuck)).toBe(true)
    expect(colletFitsHolder(er20, chuck)).toBe(false)
  })

  it('puts no collet in a holder that grips the shank itself', () => {
    expect(colletFitsHolder(er16, shrink)).toBe(false)
  })

  it('grips a shank inside its published span', () => {
    expect(gripsShank(er16, 6)).toBe(true)
    expect(gripsShank(er16, 5)).toBe(false)
    expect(gripsShank(er16, 6.5)).toBe(false)
  })

  it('is not defeated by a conversion’s last bit', () => {
    // 3/8" is 9.525 on the collet's sheet and 9.524999999999999 on the tool's.
    // Strict, 350 tools in the scraped catalog had no collet in the crib.
    const threeEighths: Collet = { ...er16, clampMin: 9.525, clampMax: 9.525, clampLength: 27.5 }
    expect(gripsShank(threeEighths, 9.524999999999999)).toBe(true)
  })
})

describe('whether a holder takes a tool', () => {
  it('takes it through a collet that fits both', () => {
    expect(holderTakesTool(chuck, er16, tool)).toBe(true)
    expect(holderTakesTool(chuck, er20, tool)).toBe(false)
    expect(holderTakesTool(chuck, null, tool)).toBe(false)
  })

  it('takes one nominal diameter in a bore, not a range', () => {
    // A shrink-fit holder bored for 12 mm does not hold a 10 mm shank at all,
    // and treating the bore as an upper bound would put a tool in a holder
    // that drops it.
    expect(holderTakesTool(shrink, null, { geometry: { SFDM: 12 } })).toBe(true)
    expect(holderTakesTool(shrink, null, { geometry: { SFDM: 10 } })).toBe(false)
    expect(holderTakesTool(shrink, er16, { geometry: { SFDM: 12 } })).toBe(false)
  })

  it('refuses a tool whose shank nobody stated', () => {
    // The one place the domain differs from "what is not stated is not
    // checked".
    expect(holderTakesTool(chuck, er16, { geometry: { DC: 6, OAL: 57 } })).toBe(false)
  })

  it('puts nothing but a tap in a square-drive collet', () => {
    // A tap collet's bore carries a square, so a shank test alone says yes to
    // an end mill of that diameter — held by nothing. The square is the
    // vendor's own published dimension; a collet that states none is unchanged.
    const tapCollet: Collet = {
      series: 'ER16',
      clampMin: 6.477,
      clampMax: 6.477,
      clampLength: 18,
      squareSize: 4.851,
    }
    const tap = { form: 'tap right hand', geometry: { SFDM: 6.477, OAL: 70 } }
    const mill = { form: 'flat end mill', geometry: { SFDM: 6.477, OAL: 70 } }

    expect(holderTakesTool(chuck, tapCollet, tap)).toBe(true)
    expect(holderTakesTool(chuck, tapCollet, mill)).toBe(false)
    // An unstated form is nobody having said, and nobody-has-said does not go
    // in a square bore.
    expect(holderTakesTool(chuck, tapCollet, { geometry: { SFDM: 6.477 } })).toBe(false)
    // A tap in a plain round collet is how most shops tap. Refusing it would be
    // this package inventing a policy no vendor stated.
    const round: Collet = { ...tapCollet, squareSize: null }
    expect(holderTakesTool(chuck, round, tap)).toBe(true)
    expect(holderTakesTool(chuck, round, mill)).toBe(true)
  })

  it('refuses a holder that does not say how it clamps', () => {
    // A drawing hands over nine numbers and must not have to invent a clamping
    // mode. Absent means nobody has said, and nobody-has-said refuses.
    expect(holderTakesTool(bare, er16, tool)).toBe(false)
    expect(holderTakesTool(bare, null, tool)).toBe(false)
    expect(colletFitsHolder(er16, bare)).toBe(false)
  })
})

describe('the furthest a tool can stand out', () => {
  it('is the overall length less what the collet has to grip', () => {
    expect(maxStickout(tool, er16)).toBeCloseTo(29.5, 9)
  })

  it('answers null rather than guessing where the grip is unpublished', () => {
    // REGO-FIX's powRgrip line publishes no grip length. A guessed maximum is
    // exactly the number somebody would use to decide a deep pocket is
    // reachable.
    expect(maxStickout(tool, { ...er16, clampLength: null })).toBeNull()
    expect(maxStickout(tool, null)).toBeNull()
    expect(maxStickout({ geometry: { SFDM: 6 } }, er16)).toBeNull()
  })

  it('answers null where the grip would leave nothing out', () => {
    expect(maxStickout({ geometry: { OAL: 20 } }, { ...er16, clampLength: 20 })).toBeNull()
  })
})

describe('how well the holder has hold', () => {
  const thresholds = { good: 1 / 3, least: 1 / 4 }

  it('bands by the share of the overall length left in the holder', () => {
    // OAL 57: a third held is a stickout of 38, a quarter held is 42.75.
    expect(holdBand(tool, 19, thresholds)).toBe('good')
    expect(holdBand(tool, 38, thresholds)).toBe('good')
    expect(holdBand(tool, 40, thresholds)).toBe('medium')
    expect(holdBand(tool, 44, thresholds)).toBe('bad')
  })

  it('says nothing where the tool states no overall length', () => {
    expect(holdBand({ geometry: { SFDM: 6 } }, 19, thresholds)).toBeNull()
    expect(holdBand({ geometry: { OAL: 0 } }, 19, thresholds)).toBeNull()
  })
})

describe('the collet-shaped way into the range', () => {
  it('maps a collet onto the grip length the range asks for', () => {
    // All a collet was ever contributing. The arithmetic is `stickout.ts`'s.
    const withGrip = stickoutLimits(sized, er16)!
    const withoutGrip = stickoutLimits(sized, null)!
    expect(withGrip.limitedBy).toBe('collet')
    expect(withGrip.max).toBeCloseTo(29.5, 9)
    // Without a published grip only the clamping rule and the hold share cap,
    // and on this tool the hold share is the tighter of the two: 57 × 2/3 is
    // 38 against the clamping rule's 57 − 3×6 = 39.
    expect(withoutGrip.limitedBy).toBe('hold')
    expect(withoutGrip.max).toBeCloseTo(38, 9)
  })

  it('starts an assembly at the setup length, not the bare flutes', () => {
    // A bore assembly read `minStickout` while an otherwise identical collet
    // assembly read the floor and the step — a fifth reading of the one number.
    expect(defaultStickout(sized, er16)).toBe(stickoutLimits(sized, er16)!.setup)
    expect(defaultStickout(sized, null)).toBe(stickoutLimits(sized, null)!.setup)
  })

  it('falls back to the raw maximum for a tool with no known head', () => {
    const headless = { unitSystem: 'millimeters', geometry: { OAL: 57, SFDM: 6 } } as const
    expect(stickoutLimits(headless, er16)).toBeNull()
    expect(defaultStickout(headless, er16)).toBeCloseTo(29.5, 9)
  })
})

describe('what a crib can grip', () => {
  const holders = [chuck, shrink, { ...bare, clamping: 'collet' as const, colletSeries: 'ER20' }]
  const collets = [er16, er20]

  it('reduces every rule to a set of diameters', () => {
    // Asked tool by tool it is holders × collets × tools, which on a real
    // catalog is tens of millions of comparisons per keystroke.
    const ranges = gripRanges(holders, collets)
    expect(ranges.spans).toEqual([
      [5.5, 6],
      [9, 10],
    ])
    expect(ranges.bores).toEqual([12])
  })

  it('narrows to one spindle interface', () => {
    // The third holder states no taper, so it is not offered for BT30.
    const ranges = gripRanges(holders, collets, { taper: 'BT30' })
    expect(ranges.spans).toEqual([[5.5, 6]])
    expect(ranges.bores).toEqual([12])
  })

  it('narrows to one collet family, and drops every bore with it', () => {
    // A bore holder takes one nominal diameter, so it can never satisfy a
    // request for a particular collet series.
    const ranges = gripRanges(holders, collets, { colletSeries: 'ER20' })
    expect(ranges.spans).toEqual([[9, 10]])
    expect(ranges.bores).toEqual([])
  })

  it('contributes nothing for a holder that states no clamping', () => {
    expect(gripRanges([bare], collets)).toEqual({ spans: [], bores: [] })
  })

  it('answers whether anything holds a shank', () => {
    const ranges = gripRanges(holders, collets)
    expect(gripsAnyShank(ranges, 6)).toBe(true)
    expect(gripsAnyShank(ranges, 12)).toBe(true)
    expect(gripsAnyShank(ranges, 7)).toBe(false)
    expect(canHold(ranges, tool)).toBe(true)
    expect(canHold(ranges, { geometry: { DC: 6 } })).toBe(false)
  })

  it('answers the same as asking the holder itself, down to the last bit', () => {
    // The filter and the exact check are one question asked two ways, and the
    // fast one used to be the strict one: a 3/8" shank converts to
    // 9.524999999999999 and missed a collet whose sheet says 9.525, so the crib
    // reported no holder for a tool `holderTakesTool` plainly accepts.
    const shank = (3 / 8) * 25.4
    const threeEighths: Collet = { ...er20, clampMin: 9.525, clampMax: 9.525 }
    const nose: Holder = { ...bare, clamping: 'collet', colletSeries: 'ER20' }
    const ranges = gripRanges([nose], [threeEighths])

    expect(gripsShank(threeEighths, shank)).toBe(true)
    expect(gripsAnyShank(ranges, shank)).toBe(true)
    expect(canHold(ranges, { geometry: { SFDM: shank } })).toBe(
      holderTakesTool(nose, threeEighths, { geometry: { SFDM: shank } }),
    )
  })

  it('agrees with the holder on a bore measured in inches too', () => {
    // The same last bit, on the path that compares one diameter rather than a
    // span: a ½" bore is 12.7 on the holder's sheet and 12.699999999999999 on
    // the tool's.
    const half = (1 / 2) * 25.4
    const bore: Holder = { ...bare, clamping: 'shrink', boreDiameter: 12.7 }
    const ranges = gripRanges([bore], [])

    expect(gripsAnyShank(ranges, half)).toBe(true)
    expect(canHold(ranges, { geometry: { SFDM: half } })).toBe(
      holderTakesTool(bore, null, { geometry: { SFDM: half } }),
    )
    // Still one diameter and not an upper bound.
    expect(gripsAnyShank(ranges, 10)).toBe(false)
  })
})
