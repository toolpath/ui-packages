import { parametricHolder, type RotatingToolAssembly } from '@toolpath/tool-support'
import { describe, expect, it } from 'vitest'
import { HOLDER_HEADROOM, assemblyOutline, extentFor } from '../src/geometry/index.js'
import type { Drawable } from '../src/geometry/index.js'
import { tool } from './fixtures.js'

/**
 * A ⌀6 end mill in a holder that flares to a ⌀46 flange — the case the zoom
 * exists for. The stack is 25 mm of tool below the nose and another 80 mm of
 * holder above it, and the widest thing on it is 30 mm above the cut.
 */
const holder = parametricHolder(
  {
    noseDiameter: 28,
    noseLength: 30,
    bodyDiameter: null,
    bodyLength: null,
    projection: 55,
    flangeDiameter: 46,
    gaugeLength: 80,
  },
  { colletSeries: 'PG6' },
)

const assembly: RotatingToolAssembly = { tool: tool(), holder, collet: null, stickout: 25 }

const outlineOf = (of: Drawable) => {
  const outline = assemblyOutline(of)
  if (outline === null) {
    throw new Error('the fixture must be drawable')
  }
  return outline
}

describe('how much of the stack a sheet is framed to', () => {
  it('frames the whole assembly by default, and says so by answering the outline', () => {
    const outline = outlineOf(assembly)

    expect(extentFor(outline, assembly)).toBe(outline)
    expect(extentFor(outline, assembly, 'assembly')).toBe(outline)
  })

  it('cuts a little above the holder nose, at the length below it', () => {
    const outline = outlineOf(assembly)
    const zoomed = extentFor(outline, assembly, 'tool')

    // 25 mm of tool below the nose, and 15% of it again of holder above.
    expect(zoomed.height).toBeCloseTo(25 * (1 + HOLDER_HEADROOM), 6)
    // Which is a fraction of the 105 mm the whole assembly is drawn over.
    expect(outline.height).toBe(105)
  })

  /**
   * **The across axis is where a zoom on an assembly is won.** The flange is
   * the widest thing on the stack and it is above the cut, so a sheet framed
   * to the working end is as wide as the holder nose and not as wide as the
   * flange — three times the scale across, on a panel of any shape.
   */
  it('measures its width below the cut, not over the whole stack', () => {
    const outline = outlineOf(assembly)
    const zoomed = extentFor(outline, assembly, 'tool')

    expect(outline.radius).toBe(23)
    expect(zoomed.radius).toBe(14)
  })

  it('cuts at the stickout where no holder is drawn', () => {
    const alone = { ...assembly, holder: null, stickout: 19 }
    const outline = outlineOf(alone)
    const zoomed = extentFor(outline, alone, 'tool')

    expect(zoomed.height).toBeCloseTo(19 * (1 + HOLDER_HEADROOM), 6)
    expect(zoomed.radius).toBe(3)
  })

  /**
   * Nothing to zoom to is drawn as it always was, rather than refused: a
   * caller hands the same prop to every drawing in a list, and one tool in it
   * is drawn on its own.
   */
  it('frames the whole stack for a tool drawn on its own', () => {
    const outline = outlineOf(tool())

    expect(extentFor(outline, tool(), 'tool')).toBe(outline)
  })

  it('frames the whole stack where the cut is already past the top of it', () => {
    // A tool stood out almost its whole length: the sheet ends at its overall
    // length, and the cut plus its headroom falls past that.
    const nearly = { ...assembly, holder: null, stickout: 55 }
    const outline = outlineOf(nearly)

    expect(outline.height).toBe(57)
    expect(extentFor(outline, nearly, 'tool')).toBe(outline)
  })
})
