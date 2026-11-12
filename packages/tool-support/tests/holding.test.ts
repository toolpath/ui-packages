/**
 * What holds a tool, and what that decides.
 *
 * Two rules here refuse rather than assume, and both refuse for the same
 * reason: the unchecked case is a cutter falling out of a spindle.
 */

import { describe, expect, it } from 'vitest'

import {
  canHold,
  clampedShank,
  colletFitsHolder,
  defaultStickout,
  gripRanges,
  gripsAnyShank,
  gripsShank,
  holdBand,
  holderTakesTool,
  maxStickout,
  stickoutLimits,
  MM_PER_INCH,
  type Collet,
  type Extension,
  type Holder,
} from '../src/index.js'
import { cylinder } from '../src/cones.js'
import { shaft, solid } from './tools.js'

const bare: Holder = { layers: [], gaugeLength: null }

const chuck: Holder = { ...bare, clamping: 'collet', colletSeries: 'ER16', taper: 'BT30' }
const shrink: Holder = { ...bare, clamping: 'shrink-fit', boreDiameter: 12, taper: 'BT30' }

const er16: Collet = { series: 'ER16', clampMin: 5.5, clampMax: 6, clampLength: 27.5 }
const er20: Collet = { series: 'ER20', clampMin: 9, clampMax: 10, clampLength: 30 }

const shank = (diameter: number) => solid({ shaft: shaft({ shank: diameter, overallLength: 57 }) })
const tool = { ...shank(6), unitSystem: 'millimeters' as const }

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
    const threeEighths: Collet = { ...er16, clampMin: 9.525, clampMax: 9.525 }
    expect(gripsShank(threeEighths, 9.524999999999999)).toBe(true)
  })

  it('grips the size the collet is named for when the vendor printed it twice', () => {
    // Kennametal 25ER0312, a 5/16 in ER25. Its own row prints CCCX as 0.312 in
    // and 7.938 mm; 7.938 mm is 0.3125 in exactly, so the inch cell is that
    // value at three places and the derived band stops 0.0127 mm short of the
    // shank the collet is sold for. See GRIP_TOLERANCE.
    const er25: Collet = { ...er16, series: 'ER25', clampMin: 6.8834, clampMax: 7.9248 }
    expect(gripsShank(er25, 7.9375)).toBe(true)

    // 32ERSS0281, a sealed 9/32 in ER32: the nominal prints 0.2812 and the band
    // 0.2813, the same four-decimal inch value rounded the other way.
    const er32: Collet = { ...er16, series: 'ER32', clampMin: 7.14502, clampMax: 7.14502 }
    expect(gripsShank(er32, 7.14375)).toBe(true)
  })

  it('still refuses a capacity the vendor undersized on purpose', () => {
    // 40ERSS0312 is named 5/16 in and states 7.874 mm in both unit columns —
    // 0.0635 mm under the shank, five times the widest printing artifact above.
    // All ten sealed ER40 rows of this shape stay refused.
    const sealed: Collet = { ...er16, series: 'ER40', clampMin: 7.874, clampMax: 7.874 }
    expect(gripsShank(sealed, 7.9375)).toBe(false)

    // 40ERSS1000, the widest of them: named 1 in, states 25.24252 mm.
    const inch: Collet = { ...er16, series: 'ER40', clampMin: 25.24252, clampMax: 25.24252 }
    expect(gripsShank(inch, 25.4)).toBe(false)
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
    expect(holderTakesTool(shrink, null, shank(12))).toBe(true)
    expect(holderTakesTool(shrink, null, shank(10))).toBe(false)
    expect(holderTakesTool(shrink, er16, shank(12))).toBe(false)
  })

  it('refuses a tool whose shank nobody stated', () => {
    // The one place the domain differs from "what is not stated is not
    // checked".
    expect(holderTakesTool(chuck, er16, solid())).toBe(false)
  })

  it('refuses a tool whose shank is assumed, as one whose shank nobody stated', () => {
    // A reader's guess at the shank is not a shank: a Fusion entry with no SFDM.
    const assumed = { ...tool, provenance: { shank: 'assumed' as const } }
    const bore6: Holder = { ...bare, clamping: 'bore', boreDiameter: 6 }
    expect(clampedShank({ tool: assumed })).toBeNull()
    expect(holderTakesTool(chuck, er16, assumed)).toBe(false)
    expect(holderTakesTool(bore6, null, assumed)).toBe(false)
    expect(canHold(gripRanges([chuck, bore6], [er16]), assumed)).toBe(false)
    expect(holderTakesTool(chuck, er16, tool)).toBe(true)
    // On an extension the extension's shank is held, whatever the head's shaft.
    const extension: Extension = { systemSize: 'DL06', layers: [cylinder(6, 40)] }
    expect(clampedShank({ tool: assumed, extension })).toEqual({ diameter: 6 })
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
    const mill = solid({ shaft: shaft({ shank: 6.477, overallLength: 70 }) })
    const tap = { ...mill, kind: 'CuttingTap' as const }
    const former = { ...mill, kind: 'FormingTap' as const }

    expect(holderTakesTool(chuck, tapCollet, tap)).toBe(true)
    expect(holderTakesTool(chuck, tapCollet, former)).toBe(true)
    expect(holderTakesTool(chuck, tapCollet, mill)).toBe(false)
    // A tap in a plain round collet is how most shops tap. Refusing it would be
    // this package inventing a policy no vendor stated.
    const { squareSize: _square, ...round } = tapCollet
    expect(holderTakesTool(chuck, round, tap)).toBe(true)
    expect(holderTakesTool(chuck, round, mill)).toBe(true)
    // A collet that says it is a tap collet takes only a tap, square published or not.
    const tapKind: Collet = { ...round, kind: 'tap' }
    expect(holderTakesTool(chuck, tapKind, tap)).toBe(true)
    expect(holderTakesTool(chuck, tapKind, mill)).toBe(false)
    expect(holderTakesTool(chuck, { ...tapCollet, kind: 'tap' }, mill)).toBe(false)
  })

  it('refuses a holder that does not say how it clamps', () => {
    // A drawing hands over nine numbers and must not have to invent a clamping
    // mode. Absent means nobody has said, and nobody-has-said refuses.
    expect(holderTakesTool(bare, er16, tool)).toBe(false)
    expect(holderTakesTool(bare, null, tool)).toBe(false)
    expect(colletFitsHolder(er16, bare)).toBe(false)
  })

  it('takes no tool in, and lists no bore for, a holder with a bore and no clamping', () => {
    // Absent clamping takes no tool, whatever bore is stated beside it.
    const unclamped: Holder = { ...bare, boreDiameter: 12 }
    expect(holderTakesTool(unclamped, null, shank(12))).toBe(false)
    expect(gripRanges([unclamped], []).bores).toEqual([])
  })

  it('takes in a side lock only a shank with a flat or a notch, where the tool states its form', () => {
    const sideLock: Holder = { ...bare, clamping: 'side-lock', boreDiameter: 12 }
    expect(
      holderTakesTool(sideLock, null, solid({ shaft: [cylinder(12, 40)], shankForm: 'weldon' })),
    ).toBe(true)
    expect(
      holderTakesTool(
        sideLock,
        null,
        solid({ shaft: [cylinder(12, 40)], shankForm: 'whistle-notch' }),
      ),
    ).toBe(true)
    expect(
      holderTakesTool(sideLock, null, solid({ shaft: [cylinder(12, 40)], shankForm: 'plain' })),
    ).toBe(false)
    // Nobody having said is taken, as it was before the record carried a form.
    expect(holderTakesTool(sideLock, null, shank(12))).toBe(true)
    expect(holderTakesTool(sideLock, null, shank(10))).toBe(false)
  })

  it('grips each form its bore clamping takes', () => {
    const held = (clamping: Holder['clamping'], shankForm: 'plain' | 'weldon' | 'whistle-notch') =>
      holderTakesTool(
        { ...bare, clamping, boreDiameter: 12 },
        null,
        solid({ shaft: [cylinder(12, 40)], shankForm }),
      )
    expect(held('milling-chuck', 'plain')).toBe(true)
    expect(held('milling-chuck', 'weldon')).toBe(true)
    expect(held('milling-chuck', 'whistle-notch')).toBe(false)
    expect(held('shrink-fit', 'plain')).toBe(true)
    expect(held('shrink-fit', 'weldon')).toBe(false)
    expect(held('hydraulic', 'plain')).toBe(true)
    expect(held('hydraulic', 'weldon')).toBe(true)
    expect(held('hydraulic', 'whistle-notch')).toBe(false)
    expect(held('bore', 'whistle-notch')).toBe(true)
  })

  it('takes a shank through a sleeve in a bore the sleeve’s outside fits', () => {
    // A 20 mm hydraulic chuck with a 20-to-12 reduction sleeve. The sleeve's
    // series is its own; the holder need name none.
    const hydraulic: Holder = { ...bare, clamping: 'hydraulic', boreDiameter: 20 }
    const sleeve: Collet = {
      series: 'HC20',
      kind: 'sleeve',
      outerDiameter: 20,
      clampMin: 12,
      clampMax: 12,
    }
    expect(colletFitsHolder(sleeve, hydraulic)).toBe(true)
    expect(holderTakesTool(hydraulic, sleeve, shank(12))).toBe(true)
    expect(holderTakesTool(hydraulic, sleeve, shank(10))).toBe(false)
    expect(holderTakesTool(hydraulic, null, shank(20))).toBe(true)
    // Not in another bore, a shrink fit's or a collet chuck's, nor with no outside stated.
    expect(colletFitsHolder(sleeve, { ...hydraulic, boreDiameter: 25 })).toBe(false)
    expect(colletFitsHolder(sleeve, { ...hydraulic, clamping: 'shrink-fit' })).toBe(false)
    expect(colletFitsHolder(sleeve, { ...chuck, boreDiameter: 20 })).toBe(false)
    const { outerDiameter: _outside, ...unsized } = sleeve
    expect(colletFitsHolder(unsized, hydraulic)).toBe(false)
    // A collet that is no sleeve still goes only in a collet chuck.
    expect(holderTakesTool(hydraulic, er16, shank(6))).toBe(false)
    expect(gripRanges([hydraulic], [sleeve, er16])).toEqual({ spans: [[12, 12]], bores: [20] })
  })

  it('grips through a hydraulic chuck plus sleeve by the sleeve’s form rule, not the holder’s', () => {
    // The sleeve grips the shank, so it takes plain or Weldon and refuses only
    // a Whistle Notch, in a side lock too, which on its own needs a flat.
    const sleeve: Collet = {
      series: 'HC20',
      kind: 'sleeve',
      outerDiameter: 20,
      clampMin: 12,
      clampMax: 12,
    }
    const held = (clamping: Holder['clamping'], shankForm?: 'plain' | 'weldon' | 'whistle-notch') =>
      holderTakesTool(
        { ...bare, clamping, boreDiameter: 20 },
        sleeve,
        solid({ shaft: [cylinder(12, 40)], ...(shankForm === undefined ? {} : { shankForm }) }),
      )
    expect(held('hydraulic', 'plain')).toBe(true)
    expect(held('hydraulic', 'weldon')).toBe(true)
    expect(held('hydraulic', 'whistle-notch')).toBe(false)
    expect(held('hydraulic')).toBe(true)
    expect(held('side-lock', 'plain')).toBe(true)
    expect(held('side-lock', 'whistle-notch')).toBe(false)
  })

  it('holds a modular head by its extension’s shank, not its own', () => {
    // A ⌀10 DUO-LOCK head screwed onto an extension with a ⌀16 shank.
    const head = solid({ diameter: 10, shaft: [cylinder(10, 40)] })
    const extension: Extension = {
      systemSize: 'DL10',
      shankForm: 'plain',
      layers: [cylinder(16, 80)],
    }
    expect(clampedShank({ tool: head, extension })).toEqual({ diameter: 16, form: 'plain' })
    expect(clampedShank({ tool: head })).toEqual({ diameter: 10 })

    const er32Chuck: Holder = { ...bare, clamping: 'collet', colletSeries: 'ER32' }
    const er32: Collet = { series: 'ER32', clampMin: 15, clampMax: 16 }
    expect(holderTakesTool(er32Chuck, er32, head, extension)).toBe(true)
    expect(holderTakesTool(er32Chuck, er32, head)).toBe(false)

    const bore16: Holder = { ...bare, clamping: 'hydraulic', boreDiameter: 16 }
    expect(holderTakesTool(bore16, null, head, extension)).toBe(true)
    expect(holderTakesTool(bore16, null, head)).toBe(false)

    const ranges = gripRanges([er32Chuck], [er32])
    expect(canHold(ranges, head, extension)).toBe(true)
    expect(canHold(ranges, head)).toBe(false)
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
    const { clampLength: _grip, ...powRgrip } = er16
    expect(maxStickout(tool, powRgrip)).toBeNull()
    expect(maxStickout(tool, null)).toBeNull()
    expect(maxStickout(solid(), er16)).toBeNull()
  })

  it('answers null where the grip would leave nothing out', () => {
    expect(maxStickout(shank(6), { ...er16, clampLength: 57 })).toBeNull()
  })

  it('reads a bore holder’s own grip, and never a collet chuck’s nose', () => {
    expect(maxStickout(tool, { ...shrink, clampLength: 36 })).toBeCloseTo(21, 9)
    expect(maxStickout(tool, shrink)).toBeNull()
    expect(maxStickout(tool, { ...chuck, clampLength: 36 })).toBeNull()
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
    expect(holdBand(solid(), 19, thresholds)).toBeNull()
  })
})

describe('the collet-shaped way into the range', () => {
  it('maps a collet onto the grip length the range asks for', () => {
    // All a collet was ever contributing. The arithmetic is `stickout.ts`'s.
    const withGrip = stickoutLimits(tool, er16)
    const withoutGrip = stickoutLimits(tool, null)
    expect(withGrip.limitedBy).toBe('grip')
    expect(withGrip.max).toBeCloseTo(29.5, 9)
    // Without a published grip only the clamping rule and the hold share cap,
    // and on this tool the hold share is the tighter of the two: 57 × 2/3 is
    // 38 against the clamping rule's 57 − 3×6 = 39.
    expect(withoutGrip.limitedBy).toBe('hold')
    expect(withoutGrip.max).toBeCloseTo(38, 9)
  })

  it('caps the range by a bore holder’s own grip as by a collet’s', () => {
    const limits = stickoutLimits(tool, { ...shrink, clampLength: 36 })
    expect(limits.limitedBy).toBe('grip')
    expect(limits.max).toBeCloseTo(21, 9)
  })

  it('starts an assembly at the setup length, not the bare flutes', () => {
    // A bore assembly read `minStickout` while an otherwise identical collet
    // assembly read the floor and the step — a fifth reading of the one number.
    expect(defaultStickout(tool, er16)).toBe(stickoutLimits(tool, er16).setup)
    expect(defaultStickout(tool, null)).toBe(stickoutLimits(tool, null).setup)
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
    expect(canHold(ranges, solid())).toBe(false)
  })

  it('answers the same as asking the holder itself, down to the last bit', () => {
    // The filter and the exact check are one question asked two ways, and the
    // fast one used to be the strict one: a 3/8" shank converts to
    // 9.524999999999999 and missed a collet whose sheet says 9.525, so the crib
    // reported no holder for a tool `holderTakesTool` plainly accepts.
    const shank = (3 / 8) * MM_PER_INCH
    const threeEighths: Collet = { ...er20, clampMin: 9.525, clampMax: 9.525 }
    const nose: Holder = { ...bare, clamping: 'collet', colletSeries: 'ER20' }
    const ranges = gripRanges([nose], [threeEighths])

    expect(gripsShank(threeEighths, shank)).toBe(true)
    expect(gripsAnyShank(ranges, shank)).toBe(true)
    expect(canHold(ranges, solid({ shaft: [cylinder(shank, 40)] }))).toBe(
      holderTakesTool(nose, threeEighths, solid({ shaft: [cylinder(shank, 40)] })),
    )
  })

  it('agrees with the holder on a bore measured in inches too', () => {
    // The same last bit, on the path that compares one diameter rather than a
    // span: a ½" bore is 12.7 on the holder's sheet and 12.699999999999999 on
    // the tool's.
    const half = (1 / 2) * MM_PER_INCH
    const bore: Holder = { ...bare, clamping: 'shrink-fit', boreDiameter: 12.7 }
    const ranges = gripRanges([bore], [])

    expect(gripsAnyShank(ranges, half)).toBe(true)
    expect(canHold(ranges, shank(half))).toBe(holderTakesTool(bore, null, shank(half)))
    // Still one diameter and not an upper bound.
    expect(gripsAnyShank(ranges, 10)).toBe(false)
  })
})
