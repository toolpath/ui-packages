import { describe, expect, it } from 'vitest'
import { frameFor } from '../src/index.js'
import type { Box, Extent } from '../src/index.js'

/** A long thin tool: 100 mm of ⌀4. The shape the old frame handled worst. */
const thin: Extent = { height: 100, radius: 2 }

/**
 * The four numbers of a viewBox, so a test can assert on measurements rather
 * than on the string that carries them.
 */
const viewBox = (frame: { viewBox: string }) => {
  const [minX, minY, width, height] = frame.viewBox.split(' ').map(Number)
  return { minX: minX!, minY: minY!, width: width!, height: height! }
}

/**
 * What `preserveAspectRatio="xMidYMid meet"` will actually render the viewBox
 * at. The frame is only honest if this equals the `scale` it reports.
 */
const renderedScale = (frame: { viewBox: string }, box: Box) => {
  const view = viewBox(frame)
  return Math.min(box.width / view.width, box.height / view.height)
}

describe('the frame a drawing gets', () => {
  it('draws along the long axis of a wide box, at the ratio that fits the length', () => {
    const box = { width: 1032, height: 232 }
    const frame = frameFor(thin, box)

    expect(frame.orientation).toBe('horizontal')
    // 1000 px of room over 100 mm of tool, against 200 px over 4 mm across.
    expect(frame.scale).toBe(10)
    expect(viewBox(frame)).toEqual({ minX: -1.6, minY: -3.6, width: 103.2, height: 7.2 })
  })

  it('turns the same tool upright in a tall box, and frames it identically', () => {
    const box = { width: 232, height: 1032 }
    const frame = frameFor(thin, box)

    expect(frame.orientation).toBe('vertical')
    expect(frame.scale).toBe(10)
    // The same frame, transposed: nothing about the fit changed but the axis.
    expect(viewBox(frame)).toEqual({ minX: -3.6, minY: -1.6, width: 7.2, height: 103.2 })
  })

  it('breaks the tie in a square box toward the width', () => {
    const frame = frameFor(thin, { width: 432, height: 432 })

    expect(frame.orientation).toBe('horizontal')
    expect(frame.scale).toBe(4)
    expect(viewBox(frame)).toEqual({ minX: -4, minY: -6, width: 108, height: 12 })
  })

  it('frames against a plain landscape sheet before the panel has been measured', () => {
    const frame = frameFor(thin, { width: 0, height: 0 })

    expect(frame.orientation).toBe('horizontal')
    // The 640 x 240 default, less padding: 608 px of room over 100 mm.
    expect(frame.scale).toBe(6.08)
    expect(Object.values(viewBox(frame)).every(Number.isFinite)).toBe(true)
    expect(frame.fontSize).toBeGreaterThan(0)
  })

  it('takes a caller-supplied default box for the unmeasured case', () => {
    const frame = frameFor(
      thin,
      { width: 0, height: 0 },
      { defaultBox: { width: 232, height: 1032 } },
    )

    expect(frame.orientation).toBe('vertical')
    expect(frame.scale).toBe(10)
  })

  it('treats a box with no height as unmeasured rather than as a panel of no size', () => {
    expect(frameFor(thin, { width: 1032, height: 0 }).scale).toBe(6.08)
  })
})

/**
 * **Defect 1.** The old frame multiplied the tool's length by the panel's
 * aspect ratio, so a wide panel bought a wide *sheet* and `meet` then shrank
 * the drawing to fit the height. A 58 mm drill got a 312 mm-wide viewBox and
 * roughly 85% of the panel rendered empty.
 */
describe('the scale absorbs the panel’s shape, not the frame', () => {
  it('spends a wide panel on scale rather than on an empty sheet', () => {
    const box = { width: 1450, height: 297 }
    const drill: Extent = { height: 58, radius: 2 }
    const frame = frameFor(drill, box)
    const view = viewBox(frame)

    // The sheet is the tool plus its margins — not the 312 mm the panel's
    // aspect ratio used to buy.
    expect(view.width).toBeCloseTo(58 + (2 * 16) / frame.scale, 3)
    expect(view.width).toBeLessThan(62)
    // And the tool spans the panel's length, less the padding.
    expect(drill.height * frame.scale).toBeCloseTo(1450 - 32, 9)
  })

  it('reports the scale the browser will actually render at', () => {
    for (const box of [
      { width: 1450, height: 297 },
      { width: 232, height: 1032 },
      { width: 432, height: 432 },
      { width: 100, height: 60 },
    ]) {
      const frame = frameFor(thin, box)
      expect(renderedScale(frame, box)).toBeCloseTo(frame.scale, 4)
    }
  })

  it('is the smaller of the two fitting ratios, whichever one binds', () => {
    // A stubby tool: wider than it is long, so the across-axis binds.
    const stubby: Extent = { height: 10, radius: 30 }
    const frame = frameFor(stubby, { width: 1032, height: 232 })

    expect(frame.scale).toBe(200 / 60)
    expect(frame.scale).toBeLessThan(1000 / 10)
  })

  /**
   * The viewBox is rounded to four decimal places, so it reads as a
   * measurement rather than as float noise. The cost is that the reported
   * `scale` is exact only to within that rounding — a part in a million on a
   * hundred-millimetre tool, or about a hundred nanometres of model space.
   * Stated here so it is a known bound rather than a surprise in phase 4,
   * where a dimension figure is placed against these numbers.
   */
  it('rounds the viewBox to four places, and says what that costs the scale', () => {
    const box = { width: 1450, height: 297 }
    const frame = frameFor({ height: 58, radius: 2 }, box)

    for (const value of Object.values(viewBox(frame))) {
      expect(value).toBe(Math.round(value * 1e4) / 1e4)
    }
    expect(Math.abs(renderedScale(frame, box) - frame.scale) / frame.scale).toBeLessThan(1e-6)
  })

  it('draws at life size when there is no content to fit', () => {
    const frame = frameFor({ height: 0, radius: 0 }, { width: 1032, height: 232 })

    expect(frame.scale).toBe(1)
    expect(Object.values(viewBox(frame)).every(Number.isFinite)).toBe(true)
  })
})

/**
 * **Defect 2.** Type was sized as `Math.max(1.5, height * 0.018)` — millimetres
 * of tool — so it tracked how long the tool happened to be. On a 58 mm drill
 * that was about four pixels once rendered.
 */
describe('type size tracks the drawing, not the tool', () => {
  it('renders at the same pixel size for tools of wildly different length', () => {
    const box = { width: 1032, height: 232 }
    const short = frameFor({ height: 100, radius: 2 }, box)
    const long = frameFor({ height: 400, radius: 2 }, box)

    expect(long.scale).not.toBe(short.scale)
    expect(long.fontSize).not.toBe(short.fontSize)
    // In millimetres they differ, because the scale does. On screen they do not.
    expect(short.fontSize * short.scale).toBeCloseTo(10.44, 9)
    expect(long.fontSize * long.scale).toBeCloseTo(10.44, 9)
  })

  it('holds type to a readable range at both extremes of panel size', () => {
    const huge = frameFor(thin, { width: 4000, height: 4000 })
    const tiny = frameFor(thin, { width: 100, height: 60 })

    expect(huge.fontSize * huge.scale).toBeCloseTo(14, 9)
    expect(tiny.fontSize * tiny.scale).toBeCloseTo(9, 9)
  })
})

/**
 * `toX` and `toY` are the only things in the package that know which way the
 * axis runs, so everything downstream is written once. These assert the two
 * orientations place the same tool the same way, differing only in the axis.
 */
describe('the axis sense lives only in toX and toY', () => {
  const wide = frameFor(thin, { width: 1032, height: 232 })
  const tall = frameFor(thin, { width: 232, height: 1032 })

  it('puts the tip at the origin in both orientations', () => {
    expect([wide.toX(0, 0), wide.toY(0, 0)]).toEqual([0, 0])
    expect([tall.toX(0, 0), tall.toY(0, 0)]).toEqual([0, 100])
  })

  it('runs a horizontal tool left to right, tip first', () => {
    expect(wide.toX(0, 100)).toBe(100)
    expect(wide.toY(2, 0)).toBe(2)
    expect(wide.toY(-2, 0)).toBe(-2)
  })

  it('runs a vertical tool bottom to top, tip down', () => {
    expect(tall.toY(0, 100)).toBe(0)
    expect(tall.toY(0, 0)).toBe(100)
    expect(tall.toX(2, 0)).toBe(2)
  })

  it('spans the same distances along and across the axis either way', () => {
    const alongWide = wide.toX(0, thin.height) - wide.toX(0, 0)
    const alongTall = tall.toY(0, 0) - tall.toY(0, thin.height)
    expect(alongWide).toBe(thin.height)
    expect(alongTall).toBe(thin.height)

    const acrossWide = wide.toY(thin.radius, 0) - wide.toY(-thin.radius, 0)
    const acrossTall = tall.toX(thin.radius, 0) - tall.toX(-thin.radius, 0)
    expect(acrossWide).toBe(thin.radius * 2)
    expect(acrossTall).toBe(thin.radius * 2)
  })

  it('maps the content corners inside the viewBox in both orientations', () => {
    for (const frame of [wide, tall]) {
      const view = viewBox(frame)
      for (const [r, z] of [
        [-thin.radius, 0],
        [thin.radius, 0],
        [-thin.radius, thin.height],
        [thin.radius, thin.height],
      ]) {
        const x = frame.toX(r!, z!)
        const y = frame.toY(r!, z!)
        expect(x).toBeGreaterThanOrEqual(view.minX)
        expect(x).toBeLessThanOrEqual(view.minX + view.width)
        expect(y).toBeGreaterThanOrEqual(view.minY)
        expect(y).toBeLessThanOrEqual(view.minY + view.height)
      }
    }
  })
})

describe('padding', () => {
  it('is pixels of chrome, so it does not grow with the tool', () => {
    const box = { width: 1032, height: 232 }
    const short = frameFor({ height: 100, radius: 2 }, box, { padding: 20 })
    const long = frameFor({ height: 400, radius: 2 }, box, { padding: 20 })

    expect((viewBox(short).width - 100) * short.scale).toBeCloseTo(40, 2)
    expect((viewBox(long).width - 400) * long.scale).toBeCloseTo(40, 2)
  })

  it('leaves room to draw in even when it would swallow the box', () => {
    const frame = frameFor(thin, { width: 20, height: 20 }, { padding: 200 })

    expect(frame.scale).toBeGreaterThan(0)
    expect(Number.isFinite(frame.scale)).toBe(true)
  })
})

/**
 * **Annotation gives way before the drawing does.**
 *
 * Chrome is a request, not a claim. Five dimension figures on both flanks of a
 * tool in a narrow panel asked for 429 px of a 400 px axis; `px - chrome` went
 * negative, the fitting ratio fell to a fortieth of a pixel per millimetre, and
 * the drawing came out as a twelve-metre viewBox with metre-tall figures
 * stacked off the sheet. The frame caps what it grants and reports what it
 * granted, so a caller places against the room the margin really has.
 */
describe('chrome that will not fit', () => {
  const narrow = { width: 400, height: 1200 }
  const greedy = { padding: { minus: 300, plus: 300, along: 16 } }

  it('scales the request back rather than starving the content', () => {
    const frame = frameFor(thin, narrow, greedy)

    // 600 px asked of a 400 px axis; 60% of it granted, split as asked.
    expect(frame.padding.minus).toBe(120)
    expect(frame.padding.plus).toBe(120)
    expect(frame.padding.along).toBe(16)
  })

  it('keeps the scale the length can use, instead of collapsing it', () => {
    const frame = frameFor(thin, narrow, greedy)

    // Bound by the length: 1168 px of room over 100 mm. Uncapped this fell to
    // 0.25 px/mm, and every number downstream of it with it.
    expect(frame.scale).toBeCloseTo(11.68, 6)
    expect(renderedScale(frame, narrow)).toBeCloseTo(frame.scale, 4)
  })

  it('grants a request that fits in full', () => {
    const frame = frameFor(thin, { width: 1032, height: 232 }, { padding: 16 })

    expect(frame.padding).toEqual({ minus: 16, plus: 16, along: 16 })
  })

  it('reports asymmetric chrome as asked when there is room for it', () => {
    const frame = frameFor(
      thin,
      { width: 232, height: 1032 },
      {
        padding: { minus: 60, plus: 10, along: 16 },
      },
    )

    expect(frame.padding).toEqual({ minus: 60, plus: 10, along: 16 })
    // The tool sits off centre by the difference, which is the whole point of
    // the seam widening: each flank gets what its own bands need.
    const view = viewBox(frame)
    expect(Math.abs(view.minX)).toBeGreaterThan(Math.abs(view.minX + view.width))
  })
})
