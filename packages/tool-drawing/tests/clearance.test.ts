import { describe, expect, it } from 'vitest'
import { assemblyOutline } from '../src/geometry/index.js'
import {
  clipped,
  describeGaps,
  heightAt,
  lastRise,
  tightestGaps,
  wallCorners,
  wallFaceAt,
  wallPath,
  zigzag,
  NO_MARGINS,
} from '../src/clearance/index.js'
import type { ViewerAssembly } from '../src/index.js'

/**
 * Proportions from the committed sample dataset — a BT30 ER16 holder and a
 * ⌀3 end mill — because it is the only dataset with toolholding in it and an
 * invented assembly has proportions no real holder has.
 */
const assembly: ViewerAssembly = {
  tool: {
    form: 'flat end mill',
    label: 'TDMX0300',
    geometry: { DC: 3, LCF: 8, OAL: 50, RE: 0, NOF: 4, SFDM: 6, LBH: 11 },
    provenance: { LBH: 'derived' },
  },
  holder: {
    gaugeLength: 60,
    colletSeries: 'ER16',
    noseDiameter: 34,
    noseLength: 8,
    bodyDiameter: 42,
    bodyLength: 3,
    projection: 11.6,
    flangeDiameter: 46,
    colletProtrusion: 2,
    provenance: {},
  },
  stickout: 25,
}

const curve = { horizontalOffset: [0, 2, 8, 15], verticalOffset: [12, 12, 30, 30] }

/** The material profile the consumer computes and hands over, as a staircase. */
const materialProfile = (
  reach: { horizontalOffset: ReadonlyArray<number>; verticalOffset: ReadonlyArray<number> },
  cuttingRadius: number,
) => {
  const points: Array<{ r: number; z: number }> = [{ r: cuttingRadius, z: 0 }]
  const push = (point: { r: number; z: number }) => {
    const last = points[points.length - 1]
    if (!last || last.r !== point.r || last.z !== point.z) {
      points.push(point)
    }
  }
  let from = 0
  reach.horizontalOffset.forEach((offset, index) => {
    const height = reach.verticalOffset[index] ?? 0
    push({ r: cuttingRadius + from, z: height })
    push({ r: cuttingRadius + offset, z: height })
    from = offset
  })
  return points
}

describe('reading the reach curve', () => {
  /**
   * "Material within h[i] rises to v[i]": everything out to a knot is already
   * as tall as that knot says, so the rise comes at the start of each run.
   */
  it('bounds the material by the next knot, and clamps past the last', () => {
    expect(heightAt(curve, 0)).toBe(12)
    expect(heightAt(curve, 2)).toBe(12)
    expect(heightAt(curve, 2.1)).toBe(30)
    expect(heightAt(curve, 99)).toBe(30)
  })

  it('agrees with the staircase the drawing is drawn from, at every offset', () => {
    const points = materialProfile(curve, 3)
    const drawnHeightAt = (offset: number): number => {
      const r = 3 + offset
      for (let index = 0; index + 1 < points.length; index += 1) {
        const from = points[index]!
        const to = points[index + 1]!
        if (from.z === to.z && from.r <= r && r <= to.r) {
          return from.z
        }
      }
      return points[points.length - 1]!.z
    }
    for (const offset of [0, 0.5, 1.9, 2.1, 5, 7.9, 8.1, 12, 15.5, 40]) {
      expect(drawnHeightAt(offset)).toBe(heightAt(curve, offset))
    }
  })

  it('finds the face of the first wall standing taller than a height', () => {
    expect(wallFaceAt(curve, 0)).toBe(0)
    expect(wallFaceAt(curve, 12)).toBe(2)
    expect(wallFaceAt(curve, 30)).toBeNull()
  })
})

describe('the two tightest points', () => {
  const outline = assemblyOutline(assembly)!

  it('measures up from the material and sideways to the wall, each at its own point', () => {
    const gaps = tightestGaps(outline.segments, curve, 1.5, NO_MARGINS)

    expect(gaps.axial).not.toBeNull()
    // The seated ER16 collet, not the ⌀6 shank: it stands ⌀16 across at 2 mm
    // below the nose, which is 6.5 mm out from a ⌀3 cut — well into the 30 mm
    // wall. The shank is narrower and sits nearer the axis, so it has more.
    expect(gaps.axial!.part).toBe('collet')
    expect(gaps.axial!.wall).toBe(30)
    expect(gaps.axial!.gap).toBeCloseTo(23 - 30, 6)
    expect(gaps.axial!.clears).toBe(false)
  })

  /** A gap exactly the room wanted is a pass, not "0.000 short". */
  it('passes a gap exactly the room the shop asked for', () => {
    const outlineHigh = assemblyOutline({ ...assembly, stickout: 45 })!
    const gaps = tightestGaps(outlineHigh.segments, curve, 1.5, { axial: 0, radial: 0 })
    const exact = tightestGaps(outlineHigh.segments, curve, 1.5, {
      axial: gaps.axial!.gap,
      radial: 0,
    })

    expect(exact.axial!.clears).toBe(true)
  })

  it('says nothing sideways where nothing stands taller than the stack', () => {
    const low = { horizontalOffset: [0, 40], verticalOffset: [1, 1] }
    const gaps = tightestGaps(assemblyOutline(assembly)!.segments, low, 1.5, NO_MARGINS)

    expect(gaps.radial).toBeNull()
  })

  /**
   * **The flutes are the cut, so nothing at or below them is swept.**
   *
   * On the axial gap the offset guard already skips them — a flute is at
   * exactly the cutting radius, so its offset is zero. Sideways there is no
   * such guard: the flutes sit exactly on the wall face at the bottom of the
   * cut, which measures as zero room, and swept they would drown every real
   * clearance the stack has. This curve has a ledge wide enough for the shank
   * to stand clear in, so the difference shows.
   */
  it('never measures the tip or the flutes', () => {
    // A wide, low ledge: nothing stands taller than the collet, so the shank
    // standing in the ledge is the only part with a wall beside it.
    const ledge = { horizontalOffset: [0, 10, 20], verticalOffset: [5, 5, 20] }
    const gaps = tightestGaps(outline.segments, ledge, 1.5, NO_MARGINS)

    expect(gaps.axial!.part).not.toBe('flutes')
    expect(gaps.axial!.part).not.toBe('tip')
    // The shank standing in the ledge: 10 mm of ledge plus the 1.5 mm of cut,
    // less the shank's own 3 mm radius. Swept, the flutes would report zero
    // here and the whole clearance would read as none.
    expect(gaps.radial).not.toBeNull()
    expect(gaps.radial!.part).toBe('shank')
    expect(gaps.radial!.gap).toBeCloseTo(8.5, 6)
  })
})

describe('the caption’s sentence', () => {
  const format = (mm: number) => `${String(Math.round(mm * 100) / 100)} mm`

  it('says how much room there is, where, and how much was wanted', () => {
    const gaps = tightestGaps(assemblyOutline(assembly)!.segments, curve, 1.5, NO_MARGINS)

    expect(describeGaps(gaps, NO_MARGINS, format)).toMatch(
      /tightest: 7 mm into the wall at the collet/,
    )
  })

  it('says nothing where nothing was swept', () => {
    expect(describeGaps({ axial: null, radial: null }, NO_MARGINS, format)).toBeNull()
  })
})

describe('the wall’s corners', () => {
  /**
   * Both ends of every run, so a step draws as a step. Keeping only the point
   * where a new height begins drew a diagonal ramp across the run and the rise
   * after it: a square step read as a chamfer.
   */
  it('keeps both ends of every run and drops noise', () => {
    const corners = wallCorners(
      [
        { r: 3, z: 0 },
        { r: 3, z: 12 },
        { r: 5, z: 12 },
        { r: 5, z: 12.0000001 },
        { r: 11, z: 30 },
      ],
      0.001,
    )

    expect(corners).toEqual([
      { r: 3, z: 0 },
      { r: 3, z: 12 },
      { r: 5, z: 12 },
      { r: 11, z: 30 },
    ])
  })

  it('closes the last run at the end of the profile', () => {
    const corners = wallCorners(
      [
        { r: 3, z: 0 },
        { r: 3, z: 12 },
        { r: 9, z: 12 },
      ],
      0.001,
    )

    expect(corners.at(-1)).toEqual({ r: 9, z: 12 })
  })

  it('finds the outermost rise, past which the material says nothing new', () => {
    expect(
      lastRise([
        { r: 3, z: 0 },
        { r: 3, z: 12 },
        { r: 5, z: 12 },
        { r: 5, z: 30 },
        { r: 40, z: 30 },
      ]),
    ).toBe(5)
  })
})

describe('the wall as a path', () => {
  const identity = { toX: (r: number) => r, toY: (_r: number, z: number) => z }

  /**
   * A fillet is sampled as a run of close corners and reads as the arc it is;
   * a wall is one big rise and keeps its corner sharp (Paul, 2026-08-30, after
   * chords made a fillet read as a chamfer).
   */
  it('splines through a fillet’s close corners and keeps a wall’s corner sharp', () => {
    const fillet = wallPath(
      [
        { r: 3, z: 0 },
        { r: 3.1, z: 0.2 },
        { r: 3.2, z: 0.5 },
        { r: 3.3, z: 0.9 },
        { r: 3.4, z: 1.4 },
      ],
      { run: 1, rise: 1 },
      identity,
    )
    expect(fillet).toContain('C')

    const wall = wallPath(
      [
        { r: 3, z: 0 },
        { r: 3, z: 30 },
        { r: 20, z: 30 },
      ],
      { run: 1, rise: 1 },
      identity,
    )
    expect(wall).not.toContain('C')
    expect(wall).toBe('M3.00,0.00 L3.00,30.00 L20.00,30.00')
  })

  it('draws nothing from no points', () => {
    expect(wallPath([], { run: 1, rise: 1 }, identity)).toBe('')
  })
})

describe('how far out the material is drawn', () => {
  it('stops at the edge it is given, and closes the run there', () => {
    const cut = clipped(
      [
        { r: 3, z: 0 },
        { r: 3, z: 12 },
        { r: 40, z: 12 },
      ],
      10,
      100,
    )

    expect(cut.at(-1)).toEqual({ r: 10, z: 12 })
    expect(cut.every((each) => each.r <= 10)).toBe(true)
  })

  it('never draws material taller than the drawing', () => {
    const cut = clipped(
      [
        { r: 3, z: 0 },
        { r: 3, z: 90 },
      ],
      10,
      40,
    )

    expect(Math.max(...cut.map((each) => each.z))).toBe(40)
  })

  /** The break says the material carries on past where the drawing stops. */
  it('breaks the edge as a saw-tooth that starts and ends on the line', () => {
    const teeth = zigzag(10, 30, 0, 0.5, 8)

    expect(teeth).toHaveLength(9)
    expect(teeth[0]).toEqual({ r: 10, z: 30 })
    expect(teeth.at(-1)).toEqual({ r: 10, z: 0 })
    expect(teeth.slice(1, -1).some((each) => each.r !== 10)).toBe(true)
  })
})
