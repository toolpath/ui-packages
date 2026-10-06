import { describe, expect, it } from 'vitest'
import type { FeatureProfile, ReachCurve } from '../../src/model/reach.js'
import { offsetUnder, readingAt } from '../../src/reach/reading.js'
import { sectionGeometry } from '../../src/reach/section-geometry.js'
import {
  FLOOR_STRIP,
  HEADING_CHAR_PX,
  SECTION_MAX_H,
  SECTION_PAD,
  WALL_LABEL_GAP_X,
} from '../../src/reach/section-layout.js'

const curve: ReachCurve = { offsets: [2, 5, 10], heights: [1, 4, 6] }
const pocket: FeatureProfile = { across: null, depth: null, through: false }

describe('sectionGeometry', () => {
  it('puts the wall at offset zero and the floor at height zero', () => {
    const geometry = sectionGeometry(curve, pocket, 400)
    expect(geometry.y(0)).toBe(geometry.floorY)
    expect(geometry.x(0)).toBeGreaterThan(SECTION_PAD.left)
    expect(geometry.right).toBeLessThanOrEqual(400 - SECTION_PAD.right)
  })

  it('holds a tall section to its most height', () => {
    const tall: ReachCurve = { offsets: [1, 2], heights: [50, 200] }
    const geometry = sectionGeometry(tall, pocket, 400)
    expect(geometry.height).toBe(SECTION_MAX_H + SECTION_PAD.top + SECTION_PAD.bottom)
  })

  it('breaks off a feature too wide to draw to scale', () => {
    const wide: FeatureProfile = {
      across: { width: 500, kind: 'clearance' },
      depth: 3,
      through: false,
    }
    expect(sectionGeometry(curve, wide, 400).featureCut).toBe(true)
    expect(sectionGeometry(curve, pocket, 400).featureCut).toBe(false)
  })

  it('runs a through feature down past the floor', () => {
    const through: FeatureProfile = { ...pocket, through: true }
    const geometry = sectionGeometry(curve, through, 400)
    expect(geometry.featureBottomY).toBe(geometry.floorY + FLOOR_STRIP)
  })

  it('cuts a long level tail, and says it did', () => {
    const long: ReachCurve = { offsets: [2, 5, 100], heights: [1, 4, 4] }
    const geometry = sectionGeometry(long, pocket, 400)
    expect(geometry.cut).toBe(true)
    expect(geometry.last).toBeLessThan(100)
  })

  it('writes no step so near the wall that its label would cover the 0', () => {
    // As a part showed it: material from 0.128 mm out, stepping up again from 8.128.
    const near: ReachCurve = { offsets: [0.128, 8.128, 31.75], heights: [0, 7, 10] }
    const geometry = sectionGeometry(near, pocket, 480)
    const at = geometry.across.map((riser) => riser.at)
    expect(at).not.toContain(0.128)
    expect(at).toContain(8.128)
    for (const riser of geometry.across) {
      expect(geometry.x(riser.at) - geometry.x(0)).toBeGreaterThanOrEqual(WALL_LABEL_GAP_X)
    }
  })

  it('keeps the feature heading inside the drawing over a narrow feature', () => {
    const narrow: FeatureProfile = {
      across: { width: 0.1, kind: 'diameter' },
      depth: 7,
      through: true,
    }
    const geometry = sectionGeometry(curve, narrow, 480)
    expect(geometry.featureHeading).toBe('THROUGH FEATURE')
    const halfWidth = (geometry.featureHeading.length * HEADING_CHAR_PX) / 2
    // Moved right just enough to start where the feature does.
    expect(geometry.featureHeadingX).toBeCloseTo(SECTION_PAD.left + halfWidth)
  })

  it('centres the feature heading over a feature wide enough to hold it', () => {
    const geometry = sectionGeometry(curve, pocket, 480)
    expect(geometry.featureHeadingX).toBe((SECTION_PAD.left + geometry.x(0)) / 2)
  })

  it('leaves out a wall height that the feature depth label would cover', () => {
    const deep: FeatureProfile = { ...pocket, depth: 4 }
    expect(sectionGeometry(curve, pocket, 400).up).toContain(4)
    expect(sectionGeometry(curve, deep, 400).up).not.toContain(4)
  })
})

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
