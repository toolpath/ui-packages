/**
 * The quantity that had four answers.
 *
 * A ⌀1 in end mill — `OAL` 5, `LCF` 1.25, `SFDM` 1, all in inches and stated
 * here in millimetres — was the tool the four disagreed on. The table in
 * `stickout.ts` records what each produced; these are the cases that keep them
 * from coming back.
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CLAMPING,
  DEFAULT_STICKOUT_POLICY,
  HELD_SHARE,
  clampShortfall,
  clampWanted,
  headLength,
  heldDiameter,
  minStickout,
  setupStickout,
  stickoutCeiling,
  stickoutRange,
  type StickoutPolicy,
} from '../src/index.js'
import { cylinder } from '../src/cones.js'
import { shaft, solid } from './tools.js'

const inches = (value: number) => value * 25.4

/** The ⌀1 in end mill the four readings disagreed about. */
const endmill = solid({
  unitSystem: 'inches',
  diameter: inches(1),
  fluteLength: inches(1.25),
  shaft: shaft({ shank: inches(1), overallLength: inches(5), fluteLength: inches(1.25) }),
})

const metric = solid({
  unitSystem: 'millimeters',
  diameter: 6,
  fluteLength: 13,
  shaft: shaft({ shank: 6, overallLength: 57 }),
})

/** The metric end mill with a section of this diameter running this far past its flutes. */
const sectioned = (diameter: number, length: number) =>
  solid({ ...metric, shaft: shaft({ shank: 6, overallLength: 57, neck: { diameter, length } }) })

describe('what a shop keeps clamped', () => {
  it('prefers the manufacturer’s own LSCN to a rule of thumb', () => {
    // Five Seco end mills want between 4 and 6 diameters clamped against the
    // 3×D rule, and the difference is most of a tool's reach.
    expect(clampWanted(solid({ shaft: [cylinder(10, 40)], shankClampMin: 55 }))).toBe(55)
    expect(clampWanted(solid({ shaft: [cylinder(10, 40)] }))).toBe(30)
  })

  it('falls back to the rule where a shop turns the vendor’s number off', () => {
    expect(
      clampWanted(solid({ shaft: [cylinder(10, 40)], shankClampMin: 55 }), {
        vendorSpec: false,
        perDiameter: 3,
      }),
    ).toBe(30)
  })

  it('measures the multiple against the shank, not the cut', () => {
    // A keyseat cutter 22 mm across on a ⌀12 shank is clamped on 12: the
    // holder grips the shank.
    const keyseat = solid({ kind: 'KeyseatCutter', diameter: 22, shaft: [cylinder(12, 40)] })
    expect(heldDiameter(keyseat)).toBe(12)
    expect(clampWanted(keyseat)).toBe(36)
    // The cut stands in only where no shank is stated.
    expect(heldDiameter(solid({ diameter: 22 }))).toBe(22)
  })

  it('says nothing where the rule asks for nothing', () => {
    expect(
      clampWanted(solid({ shaft: [cylinder(10, 40)] }), { vendorSpec: true, perDiameter: 0 }),
    ).toBeNull()
  })

  it('starts the shank past the flutes and past a reduced section', () => {
    // A chuck closes on neither.
    expect(headLength(solid())).toBe(13)
    expect(headLength(sectioned(5, 12))).toBe(25)
  })

  it('reports the shank the rule asked for and the tool has not got', () => {
    // 3×10 = 30 wanted, and 40 − 13 = 27 of shank exists.
    expect(clampShortfall(solid({ shaft: shaft({ shank: 10, overallLength: 40 }) }))).toBe(3)
    expect(clampShortfall(solid({ shaft: shaft({ shank: 10, overallLength: 60 }) }))).toBeNull()
  })

  it('reads a relief as wide as the shank as plain shank', () => {
    // 3×8 = 24 wanted: 90 − 40 = 50 of shank with no neck or one as wide as
    // the shank, and 90 − 40 − 30 = 20 behind a narrower neck.
    const drill = { kind: 'DrillBit', diameter: 8, fluteLength: 40 } as const
    const relieved = (diameter: number) =>
      solid({
        ...drill,
        shaft: shaft({
          shank: 8,
          overallLength: 90,
          fluteLength: 40,
          neck: { length: 30, diameter },
        }),
      })
    expect(
      clampShortfall(
        solid({ ...drill, shaft: shaft({ shank: 8, overallLength: 90, fluteLength: 40 }) }),
      ),
    ).toBeNull()
    expect(clampShortfall(relieved(8))).toBeNull()
    expect(clampShortfall(relieved(6))).toBe(4)
  })
})

describe('the one stickout', () => {
  it('holds min ≤ setup ≤ max, which is the whole invariant', () => {
    // A drawn stickout can never exceed the length a table prints beside it.
    for (const tool of [endmill, metric]) {
      const range = stickoutRange(tool)
      expect(range.min).toBeLessThanOrEqual(range.setup)
      expect(range.setup).toBeLessThanOrEqual(range.max!)
    }
  })

  it('takes the tightest of the three caps and says which', () => {
    // On the ⌀1 in end mill: clamp is OAL − 3×SFDM = 2 in, hold is
    // OAL × (1 − 1/3) = 3.333 in. The clamping rule is tighter, and the two
    // used to cap different numbers in different files with nothing comparing
    // them.
    const range = stickoutRange(endmill)
    expect(range.limitedBy).toBe('clamp')
    expect(range.max).toBeCloseTo(inches(2), 1)
  })

  it('lets a collet’s published grip win where it is tighter still', () => {
    const range = stickoutRange(endmill, { grip: inches(4) })
    expect(range.limitedBy).toBe('grip')
    expect(range.max).toBeCloseTo(inches(1.25), 1)
  })

  it('sets up at the flutes, floored and stepped', () => {
    // The reading that got reverted once, because the floor and the step never
    // reached the build and the answer came out as the bare flute length.
    // Flutes are 1.25 in; the floor is half an inch and the step an eighth, so
    // the nearest eighth at or above the flutes is 1.25 in itself.
    const range = stickoutRange(endmill)
    expect(range.setup).toBeCloseTo(inches(1.25), 1)
  })

  it('lifts a short tool to the floor rather than 6 mm out', () => {
    // Nobody sets a tool up 6 mm out. A ⌀0.096 in drill with 0.669 in of flute
    // comes out at 0.750 — flutes, up to the half-inch floor, onto the next
    // eighth — against 0.669 with no floor and no step.
    const drill = solid({
      kind: 'DrillBit',
      unitSystem: 'inches',
      diameter: inches(0.096),
      fluteLength: inches(0.669),
      shaft: shaft({
        shank: inches(0.157),
        overallLength: inches(2.283),
        fluteLength: inches(0.669),
      }),
    })
    expect(stickoutRange(drill).setup).toBeCloseTo(inches(0.75), 1)
  })

  it('caps that drill at the hold share, not at the clamping rule', () => {
    // Recorded because the prose this example came from quotes 1.812 in — the
    // clamping cap, `OAL − 3×SFDM`. On this tool the hold share is tighter:
    // `OAL × 2/3` is 1.522 in, and the tightest cap is the one that wins. The
    // two capping different numbers in different files is the defect this
    // module exists to close, so which one wins is worth pinning.
    const drill = solid({
      kind: 'DrillBit',
      unitSystem: 'inches',
      diameter: inches(0.096),
      fluteLength: inches(0.669),
      shaft: shaft({
        shank: inches(0.157),
        overallLength: inches(2.283),
        fluteLength: inches(0.669),
      }),
    })
    const range = stickoutRange(drill)
    expect(range.limitedBy).toBe('hold')
    expect(range.max).toBeCloseTo(inches(1.522), 1)
    // The clamping rule would have allowed more.
    expect(inches(2.283) - 3 * inches(0.157)).toBeCloseTo(inches(1.812), 1)
  })

  it('steps up rather than down when the nearest step falls short', () => {
    // A feature needing more than the nearest step gets the one above it: a
    // stickout that lands under what is needed does not reach.
    const range = stickoutRange(metric, { required: 20 })
    expect(range.setup).toBeGreaterThanOrEqual(20)
    expect(range.setup % 3).toBeCloseTo(0, 9)
  })

  it('counts the step in the tool’s own unit system', () => {
    // An eighth of an inch for an inch tool, 3 mm for a metric one, keyed by
    // the one unit vocabulary rather than a pair of its own.
    expect(DEFAULT_STICKOUT_POLICY.step.inches).toBeCloseTo(3.175, 9)
    expect(DEFAULT_STICKOUT_POLICY.step.millimeters).toBe(3)
    expect(stickoutRange(metric).setup % 3).toBeCloseTo(0, 9)
  })

  it('stands the tool out to its neck, not its flutes', () => {
    // A collet must not close on a neck, so the shoulder is the least it can
    // stand out.
    const necked = sectioned(5, 12)
    expect(minStickout(necked)).toBe(25)
    expect(minStickout(metric)).toBe(13)
  })

  it('stands the tool out past a shoulder wider than the shank', () => {
    // Nothing clamps on a shoulder either, so it pushes the holder face back as
    // a neck does, and the setup no longer lands on it.
    const shouldered = sectioned(8, 12)
    expect(minStickout(shouldered)).toBe(25)
    expect(stickoutRange(metric).setup).toBeLessThan(25)
    expect(stickoutRange(shouldered).setup).toBeGreaterThanOrEqual(25)
  })

  it('counts what headLength counts, and not a relief as wide as the shank', () => {
    const asWide = sectioned(6, 12)
    expect(minStickout(asWide)).toBe(headLength(asWide))
    expect(minStickout(asWide)).toBe(13)
    expect(minStickout(sectioned(5, 12))).toBe(headLength(sectioned(5, 12)))
  })

  it('steps a tool that does not say its unit system as the millimetres it is stored in', () => {
    const { unitSystem: _unit, ...unstated } = metric
    expect(stickoutRange(unstated).setup).toBe(stickoutRange(metric).setup)
  })

  it('collapses onto the minimum and says so where no rule can be met', () => {
    // A tool the rule cannot hold at any depth is gripped as short as the grip
    // allows, and a control should say why rather than refuse.
    const stubby = {
      ...metric,
      fluteLength: 16,
      shaft: shaft({ shank: 6, overallLength: 20, fluteLength: 16 }),
    }
    const range = stickoutRange(stubby)
    expect(range.gripShort).toBe(true)
    expect(range.max).toBe(range.min)
    expect(range.setup).toBe(range.min)
  })

  it('leaves the range unbounded where the tool states no shaft', () => {
    // An unbounded range, not a bound of nothing.
    const { shaft: _shaft, ...open } = metric
    const range = stickoutRange(open)
    expect(range.max).toBeNull()
    expect(range.limitedBy).toBeNull()
    expect(range.grip).toBeNull()
  })

  it('is the same function behind LBH and behind the ceiling', () => {
    // Every other number is this one with more arguments. Two readings that
    // used to be computed apart are now definitionally the same call.
    expect(setupStickout(endmill)).toBe(stickoutRange(endmill).setup)
    expect(stickoutCeiling(endmill)).toBe(stickoutRange(endmill).max)
  })

  it('honours a shop’s own policy over the default', () => {
    const strict: StickoutPolicy = {
      heldShare: 0.5,
      least: 0,
      step: { inches: 0, millimeters: 0 },
    }
    const range = stickoutRange(metric, { policy: strict })
    expect(range.limitedBy).toBe('hold')
    expect(range.max).toBeCloseTo(28.5, 9)
    // No floor and no step: the bare flute length, which is the result that
    // got this reading reverted the first time.
    expect(range.setup).toBe(13)
  })

  it('names the held share once', () => {
    expect(HELD_SHARE).toBeCloseTo(1 / 3, 12)
    expect(DEFAULT_STICKOUT_POLICY.heldShare).toBe(HELD_SHARE)
    expect(DEFAULT_CLAMPING).toEqual({ vendorSpec: true, perDiameter: 3 })
  })
})
