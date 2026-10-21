import { describe, expect, it } from 'vitest'
import { sectionGeometry, type FeatureProfile, type ReachCurve } from '@toolpath/dfm'
import { offsetUnder, readingAt } from '../../src/dfm-reach-chart/reading'

const curve: ReachCurve = { offsets: [2, 5, 10], heights: [1, 4, 6] }
const pocket: FeatureProfile = { across: null, depth: null, through: false }

describe('offsetUnder: the pointer over the walls', () => {
  const geometry = sectionGeometry(curve, pocket, 400)
  const box = { left: 0, width: 400 }

  it('reads the offset under the pointer', () => {
    expect(offsetUnder(geometry.x(3), box, geometry)).toBeCloseTo(3)
  })

  it('reads the same where the drawing is shown at another size', () => {
    expect(offsetUnder(geometry.x(3) / 2, { left: 0, width: 200 }, geometry)).toBeCloseTo(3)
  })

  it('reads nothing inside the feature or past the right edge', () => {
    expect(offsetUnder(geometry.x(-1), box, geometry)).toBeNull()
    expect(offsetUnder(geometry.right + 1, box, geometry)).toBeNull()
  })
})

describe('readingAt', () => {
  it('reads the height within an offset of the wall', () => {
    expect(readingAt(curve, 3)).toEqual({ offset: 3, height: 4, past: false })
  })

  it('reads a knot as its own height', () => {
    expect(readingAt(curve, 5).height).toBe(4)
  })

  it('marks a reading past the last offset the Engine read', () => {
    expect(readingAt(curve, 12)).toEqual({ offset: 12, height: 6, past: true })
  })

  it('does not call a reading past a cut past the last reading', () => {
    // Drawn to 14.7 mm, read to 100 mm: 15 mm is past the drawing, not past the reading.
    const long: ReachCurve = { offsets: [2, 5, 100], heights: [1, 4, 4] }
    expect(sectionGeometry(long, pocket, 400).last).toBeLessThan(15)
    expect(readingAt(long, 15)).toEqual({ offset: 15, height: 4, past: false })
  })
})
