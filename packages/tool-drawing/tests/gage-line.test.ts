/**
 * The one place a holder meets its gage line, asserted from both sides.
 *
 * `@toolpath/tool-support`'s `belowGageLine` **trims** a measured silhouette at
 * the spindle face; this package's `profileSegments` **splits** it there and
 * draws the upper half as a darker `flange`. Different decisions about the same
 * line, and both have to interpolate the same crossing between the two vertices
 * it falls between — or a holder meets its gage line in two places, and the
 * picture and the trim disagree about the same measurement.
 *
 * That was a note in both files, in both repositories, saying the two must
 * agree. This is the note as a check. It is here rather than in
 * `@toolpath/tool-support` because this is the only package that can see both.
 */

import { describe, expect, it } from 'vitest'

import { belowGageLine } from '@toolpath/tool-support'
import { assemblyOutline } from '../src/geometry/index.js'
import type { ViewerAssembly, ViewerHolderProfile } from '../src/geometry/index.js'

const tool: ViewerAssembly['tool'] = {
  form: 'flat end mill',
  geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6 },
}

const STICKOUT = 19

/**
 * A BT30-shaped stack, with the gage line falling **between** two vertices so
 * the crossing has to be interpolated rather than found. The taper runs from
 * `z = -40` up to a flange at `z = 2`, which puts `z = 0` two thirds of the way
 * along the run from `[-10, 20]` to `[2, 24]`.
 */
const points: ReadonlyArray<readonly [number, number]> = [
  [-40, 11],
  [-10, 20],
  [2, 24],
  [2, 16],
  [30, 16],
  [30, 8],
  [50, 8],
]

const profile: ViewerHolderProfile = {
  points,
  datum: 'gage-line',
  colletSeries: 'PG6',
  colletProtrusion: null,
}

/**
 * The radius the drawing puts at the gage line: the point the `body` and
 * `flange` segments share.
 *
 * Outline `z` runs up from the tool tip and profile `z` runs toward the nose,
 * so the two frames are opposite and the face lands at `stickout + noseZ`.
 */
const drawnAtGageLine = (holder: ViewerHolderProfile): number | null => {
  const outline = assemblyOutline({ tool, holder, stickout: STICKOUT })
  expect(outline).not.toBeNull()
  const nose = holder.points[holder.points.length - 1]!
  const gage = STICKOUT + nose[0]

  const body = outline!.segments.find((segment) => segment.part === 'body')
  const flange = outline!.segments.find((segment) => segment.part === 'flange')
  if (body === undefined || flange === undefined) return null

  const end = body.points[body.points.length - 1]!
  const start = flange.points[0]!
  // The split shares its meeting point, as every other pair of segments here
  // does. If these ever stop being the same point the silhouette has a gap.
  expect(start).toEqual(end)
  expect(end.z).toBeCloseTo(gage, 9)
  return end.r
}

describe('the trim and the split find the same crossing', () => {
  it('agrees on an interpolated crossing', () => {
    const trimmed = belowGageLine(profile)
    expect(trimmed[0]![0]).toBe(0)
    // Two thirds along from r = 20 to r = 24.
    expect(trimmed[0]![1]).toBeCloseTo(23.333333333333332, 9)
    expect(drawnAtGageLine(profile)).toBeCloseTo(trimmed[0]![1], 9)
  })

  it('agrees on a vertex that already sits on the face', () => {
    // The other branch of both implementations: no interpolation to do, and
    // the existing vertex is the meeting point.
    const onFace: ViewerHolderProfile = {
      ...profile,
      points: [
        [-40, 11],
        [0, 24],
        [30, 16],
        [50, 8],
      ],
    }
    const trimmed = belowGageLine(onFace)
    expect(trimmed[0]).toEqual([0, 24])
    expect(drawnAtGageLine(onFace)).toBe(24)
  })

  it('neither cuts a nose-datumed profile', () => {
    // No gauge plane was solved, so there is no line to cut or split on. The
    // trim returns the profile whole and the drawing draws one segment.
    const nosed: ViewerHolderProfile = { ...profile, datum: 'nose' }
    expect(belowGageLine(nosed)).toBe(nosed.points)
    expect(drawnAtGageLine(nosed)).toBeNull()
  })

  it('keeps the same vertices below the face that the trim drops', () => {
    // The two halves are complementary: what the drawing puts in `flange` is
    // exactly what the trim removes, plus the shared crossing.
    const trimmed = belowGageLine(profile)
    const dropped = points.length - (trimmed.length - 1)

    const outline = assemblyOutline({ tool, holder: profile, stickout: STICKOUT })!
    const flange = outline.segments.find((segment) => segment.part === 'flange')!
    expect(flange.points).toHaveLength(dropped + 1)
  })
})
