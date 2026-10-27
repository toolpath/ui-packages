import { describe, expect, it } from 'vitest'
import {
  featureSheet,
  invalidFeatureTags,
  isCutterlessTslot,
  isNoReading,
  isSharpCorneredFillet,
  unplannableFeatureTags,
} from '../../src/model/feature-sheet.js'
import { clearanceFit, readPinch } from '../../src/model/pinch.js'

/**
 * Synthetic datasheets, shaped as the Engine sends them (API 1.12.1). The
 * cutter band is measured at two tolerances: 0.01 mm (`ignore`) and 0.02 mm
 * (`deviate`). A tool in a corner grows with tolerance; one in a gap does not.
 */
const tolerance = { atolIgnore: 0.01, atolDeviate: 0.02, atolMax: 0.05 }

/** A pocket with 3 mm inside corners: the widest tool reads 6.1 at 0.01 and 6.2 at 0.02. */
const pocket = (over: Record<string, unknown> = {}, facts: Record<string, unknown> = {}) => ({
  zMin: -20,
  zMax: 0,
  extendedZMax: 0,
  hasWall: true,
  hasFloor: true,
  toleranceBand: tolerance,
  pinchPoints: [
    { center: { x: 10, y: 10 }, diameter: 6.1 },
    { center: { x: 40, y: 10 }, diameter: 6.1 },
  ],
  facts: {
    kind: 'Pocket',
    cd: { ignore: { min: 6.1, max: 40 }, deviate: { min: 6.2, max: 40 } },
    filletRadius: 0,
    ...facts,
  },
  ...over,
})

describe('clearanceFit: taking the tolerance out of the widest tool', () => {
  it('runs the two measurements back to zero tolerance', () => {
    const fit = clearanceFit(pocket())
    // growth = (6.2 − 6.1) / (0.02 − 0.01) = 10; slack = 10 × 0.01 = 0.1
    expect(fit).toMatchObject({ strict: 6.1, loose: 6.2, resolved: true })
    expect(fit?.slack).toBeCloseTo(0.1)
    expect(fit?.bandPath).toBe('facts.cd')
  })

  it('is unresolved, with no slack, when a figure is missing or the tolerances do not rise', () => {
    const noDeviate = pocket({}, { cd: { ignore: { min: 6.1, max: 40 } } })
    expect(clearanceFit(noDeviate)).toMatchObject({ slack: 0, resolved: false })
    const flat = pocket({ toleranceBand: { atolIgnore: 0.02, atolDeviate: 0.02 } })
    expect(clearanceFit(flat)).toMatchObject({ slack: 0, resolved: false })
  })

  it('takes no slack off a gap, where the tool does not grow with tolerance', () => {
    const gap = pocket(
      {},
      { cd: { ignore: { min: 6.1, max: 40 }, deviate: { min: 6.1, max: 40 } } },
    )
    expect(clearanceFit(gap)?.slack).toBe(0)
  })

  it('reads a chamfer’s band under its three-axis facts', () => {
    const chamfer = pocket(
      {},
      { kind: 'Chamfer', cd: undefined, three: { cd: { ignore: { min: 2 } } } },
    )
    expect(clearanceFit(chamfer)).toMatchObject({ bandPath: 'facts.three.cd', strict: 2 })
  })

  it('is undefined with no band at all', () => {
    expect(clearanceFit({ facts: { kind: 'Hole' } })).toBeUndefined()
  })
})

describe('featureSheet: the figures the rules read', () => {
  it('derives the inside corner radius and the pinch discs with the slack taken out', () => {
    const sheet = featureSheet(pocket())
    expect(sheet.kind).toBe('Pocket')
    expect(sheet.cornerRadius).toBeCloseTo(3.0)
    expect(sheet.pinchDiameter).toBeCloseTo(6.0)
    expect(sheet.pinchPlaces).toBe(2)
    expect(sheet.maxTool).toBe(6.1)
    expect(sheet.sharpCorners).toBeUndefined()
    expect(sheet.noToolFits).toBeUndefined()
    expect(sheet.cornerRadiusUnresolved).toBeUndefined()
  })

  it('calls a corner sharp under a hundredth, and remembers where', () => {
    const sharp = pocket(
      { pinchPoints: [{ center: { x: 1, y: 2 }, diameter: 0.1 }] },
      { cd: { ignore: { min: 0.1, max: 40 }, deviate: { min: 0.2, max: 40 } } },
    )
    const sheet = featureSheet(sharp)
    expect(sheet.cornerRadius).toBeCloseTo(0)
    expect(sheet.sharpCorners).toEqual([{ x: 1, y: 2 }])
    // A zero-wide disc is the sharp corner itself, not a tool.
    expect(sheet.pinchDiameter).toBeUndefined()
  })

  it('says no tool fits when the band’s largest tool is nothing, and is then not sharp', () => {
    const cramped = pocket(
      {},
      { cd: { ignore: { min: 0, max: '-inf' }, deviate: { min: 0, max: '-inf' } } },
    )
    const sheet = featureSheet(cramped)
    expect(sheet.noToolFits).toBe(true)
    expect(sheet.sharpCorners).toBeUndefined()
    expect(featureSheet(pocket({}, { cd: { ignore: { min: 0.05, max: 0.05 } } })).noToolFits).toBe(
      true,
    )
  })

  it('marks the clearance unresolved when measured at one tolerance only', () => {
    const sheet = featureSheet(pocket({}, { cd: { ignore: { min: 6.1, max: 40 } } }))
    expect(sheet.cornerRadius).toBeCloseTo(3.05)
    expect(sheet.cornerRadiusUnresolved).toBe(true)
  })

  it('gives a hole its bore, tip and thread, and no corner radius', () => {
    const hole = {
      zMin: -30,
      zMax: 0,
      extendedZMax: 0,
      hasWall: true,
      toleranceBand: tolerance,
      facts: {
        kind: 'Hole',
        diameter: 5,
        fullConeDeg: 118,
        cd: { ignore: { min: 5, max: 5 }, deviate: { min: 5, max: 5 } },
        threading: { spec: { basicDiameter: 6, threadPitch: 1 } },
      },
    }
    const sheet = featureSheet(hole)
    expect(sheet).toMatchObject({
      diameter: 5,
      tipAngle: 118,
      threading: { basicDiameter: 6, threadPitch: 1 },
    })
    expect(sheet.cornerRadius).toBeUndefined()
    expect(sheet.pinchDiameter).toBeUndefined()
  })

  it('leaves out what a kind does not report rather than sending zeros', () => {
    const sheet = featureSheet({ facts: { kind: 'Face' } })
    expect(sheet).toEqual({ kind: 'Face' })
  })

  it('says a circular wall stands on a floor where its facts do, and gives it no bore', () => {
    const circular = (standsOnAFloor: boolean) => ({
      facts: { kind: 'CircularWall', diameter: 8, standsOnAFloor },
    })
    expect(featureSheet(circular(true))).toEqual({ kind: 'CircularWall', standsOnAFloor: true })
    expect(featureSheet(circular(false))).toEqual({ kind: 'CircularWall' })
  })
})

describe('featureSheet: an undercut’s own figures', () => {
  const band = { ignore: { min: 20, max: 24 }, deviate: { min: 20, max: 24 } }

  it('reads a T-slot’s depth and entry, and none of a dovetail’s', () => {
    const sheet = featureSheet({
      zMin: -12,
      zMax: -7,
      facts: {
        kind: 'Tslot',
        isExternal: false,
        isClosed: true,
        undercutDepth: 6,
        maxEntryCd: 8,
        cd: band,
        filletRadius: 0.5,
        // A dovetail's figures on a T-slot are not its own.
        taperDeg: 30,
      },
    })
    expect(sheet.undercut).toEqual({ undercutDepth: 6, maxEntry: 8, isClosed: true })
    expect(sheet.maxTool).toBe(20)
  })

  it('reads a dovetail’s widths and taper, and whether it runs out', () => {
    const sheet = featureSheet({
      facts: {
        kind: 'Dovetail',
        taperDeg: 30,
        filletRadius: 0,
        floorWidth: 16,
        topOpeningWidth: 10,
        bottomOpeningWidth: 15.8,
        isExternal: true,
        cd: band,
        isInvalidGeometry: false,
      },
    })
    expect(sheet.undercut).toEqual({
      taperDeg: 30,
      floorWidth: 16,
      topOpeningWidth: 10,
      isExternal: true,
    })
  })

  it('leaves out a figure sent as an infinity, as nothing limits it', () => {
    const sheet = featureSheet({
      facts: { kind: 'Tslot', undercutDepth: 'inf', maxEntryCd: 'Infinity', cd: band },
    })
    expect(sheet.undercut).toEqual({})
  })

  it('marks an undercut the Engine could not measure, either way it says so', () => {
    const invalid = featureSheet({ facts: { kind: 'Tslot', isInvalidGeometry: true, cd: band } })
    expect(invalid.undercut?.unmeasured).toBe(true)
    const failed = featureSheet({
      facts: { kind: 'Dovetail', cd: { ...band, measurementFailed: true } },
    })
    expect(failed.undercut?.unmeasured).toBe(true)
  })

  it('gives no other kind an undercut', () => {
    expect(featureSheet(pocket()).undercut).toBeUndefined()
  })
})

describe('readPinch: the discs a tool stands in', () => {
  it('takes the slack off every disc and clamps at zero', () => {
    const pinch = readPinch(pocket({ pinchPoints: [{ center: { x: 0, y: 0 }, diameter: 0.05 }] }))
    expect(pinch?.discs[0]?.diameter).toBe(0)
    expect(pinch).toMatchObject({ zMin: -20, zMax: 0 })
  })

  it('is null without z bounds or pinch points', () => {
    expect(readPinch({ zMin: 0, zMax: 1 })).toBeNull()
    expect(readPinch({ pinchPoints: [] })).toBeNull()
  })
})

describe('readings the analysis leaves out', () => {
  it('drops a T-slot whose whole cutter band is zero, however it is spelled', () => {
    const tslot = {
      facts: {
        kind: 'Tslot',
        cd: { ignore: { min: 0, max: '0.0000' }, deviate: { min: 0, max: 0 } },
      },
    }
    expect(isCutterlessTslot(tslot)).toBe(true)
    expect(
      isCutterlessTslot({ facts: { kind: 'Tslot', cd: { ignore: { min: 0, max: 3 } } } }),
    ).toBe(false)
    expect(
      isCutterlessTslot({ facts: { kind: 'Pocket', cd: { ignore: { min: 0, max: 0 } } } }),
    ).toBe(false)
  })

  it('drops a fillet reading that says it has a sharp corner, but not a filleted pocket', () => {
    expect(isSharpCorneredFillet('outer_fillet', { facts: { hasSharpCorner: true } })).toBe(true)
    expect(
      isSharpCorneredFillet('outer_fillet', { facts: { three: { hasSharpCorner: true } } }),
    ).toBe(true)
    expect(isSharpCorneredFillet('outer_fillet', { facts: { hasSharpCorner: false } })).toBe(false)
    expect(isSharpCorneredFillet('filleted_pocket', { facts: { hasSharpCorner: true } })).toBe(
      false,
    )
    expect(isNoReading('inner_fillet', { facts: { hasSharpCorner: true } })).toBe(true)
  })
})

/** A regime as the Engine sends one that admits no tool: both bounds zero. */
const none = { min: 0, max: 0 }

/** A T-slot as the Engine sends one, its blend 0.5 mm, which the band's corner radius keeps. */
const slot = (cd: Record<string, unknown>, facts: Record<string, unknown> = {}) => ({
  facts: {
    kind: 'Tslot',
    isExternal: false,
    isClosed: false,
    maxEntryCd: 0,
    filletRadius: 0.5,
    cd: { ignore: none, deviate: none, effectiveAdaptive: none, terminalCornerRadius: 0.5, ...cd },
    ...facts,
  },
})

describe('features nothing machines', () => {
  it('reads a T-slot the Engine says is invalid, its blend and all', () => {
    const invalid = slot({ measurementFailed: false }, { isInvalidGeometry: true })
    expect(isCutterlessTslot(invalid)).toBe(true)
    expect(isNoReading('undercut_tslot', invalid)).toBe(true)
    expect(featureSheet(invalid)).toMatchObject({
      invalidGeometry: true,
      unplannable: true,
      undercut: { maxEntry: 0, unmeasured: true },
    })
  })

  it('tells a slot whose measurement failed from an invalid one, though both read zero', () => {
    const failed = slot({ measurementFailed: true }, { isInvalidGeometry: false })
    expect(isCutterlessTslot(failed)).toBe(false)
    const sheet = featureSheet(failed)
    expect(sheet.invalidGeometry).toBeUndefined()
    expect(sheet.unplannable).toBe(true)
  })

  it('reads a zero band as invalid on a T-slot from before the Engine said so', () => {
    expect(featureSheet(slot({})).invalidGeometry).toBe(true)
  })

  it('keeps a T-slot a tool fits', () => {
    const sheet = featureSheet(
      slot(
        { ignore: { min: 4, max: 6 }, deviate: { min: 4, max: 6 } },
        { isInvalidGeometry: false },
      ),
    )
    expect(sheet.invalidGeometry).toBeUndefined()
    expect(sheet.unplannable).toBeUndefined()
  })

  it("never reads a dovetail's deprecated flag as invalid geometry, only as a failed measurement", () => {
    const sheet = featureSheet({
      facts: { kind: 'Dovetail', isInvalidGeometry: true, cd: { ignore: { min: 0, max: 8 } } },
    })
    expect(sheet.invalidGeometry).toBeUndefined()
    expect(sheet.unplannable).toBe(true)
  })

  it('reads any other kind that carries the flag as invalid', () => {
    const sheet = featureSheet({
      facts: { kind: 'Pocket', isInvalidGeometry: true, cd: { ignore: { min: 1, max: 4 } } },
    })
    expect(sheet.invalidGeometry).toBe(true)
  })

  it('finds no pass for any kind whose clearance admits no tool, but a chamfer', () => {
    const cramped = { ignore: none, deviate: none, effectiveAdaptive: { min: 0, max: '-inf' } }
    expect(featureSheet({ facts: { kind: 'Pocket', cd: cramped } }).unplannable).toBe(true)
    expect(featureSheet(pocket()).unplannable).toBeUndefined()
    const chamfer = featureSheet({
      facts: { kind: 'Chamfer', cd: { ...cramped, measurementFailed: true } },
    })
    expect(chamfer.unplannable).toBeUndefined()
  })

  it('lists the tags of each, in the order of the sheets', () => {
    const sheets = {
      a1: featureSheet(slot({}, { isInvalidGeometry: true })),
      b2: featureSheet(pocket()),
      c3: featureSheet(slot({ measurementFailed: true }, { isInvalidGeometry: false })),
    }
    expect(invalidFeatureTags(sheets)).toEqual(['a1'])
    expect(unplannableFeatureTags(sheets)).toEqual(['a1', 'c3'])
  })
})
