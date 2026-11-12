/**
 * The one place a holder meets its gage line, asserted from both sides.
 *
 * `@toolpath/tool-support`'s `trimToGauge` **cuts** a holder's stack at the
 * spindle face, for a sweep or an export; this package **splits** it there and
 * draws the part above as a darker `flange`. Different decisions about the same
 * line, and both have to interpolate the same crossing between the two vertices
 * it falls between — or a holder meets its gage line in two places, and the
 * picture and the trim disagree about the same measurement.
 *
 * That was a note in both files, in both repositories, saying the two must
 * agree. This is the note as a check. It is here rather than in
 * `@toolpath/tool-support` because this is the only package that can see both.
 */

import { describe, expect, it } from 'vitest'

import { measuredHolder, trimToGauge, type MeasuredProfile } from '@toolpath/tool-support'
import { assemblyOutline } from '../src/geometry/index.js'
import { tool } from './fixtures.js'

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

const profile: MeasuredProfile = { points, datum: 'gage-line' }

/**
 * The radius the drawing puts at the gage line: the point the `body` and
 * `flange` segments share.
 *
 * Outline `z` runs up from the tool tip and profile `z` runs toward the nose,
 * so the two frames are opposite and the face lands at `stickout + noseZ`.
 */
const drawnAtGageLine = (holder: MeasuredProfile): number | null => {
  const outline = assemblyOutline({
    tool: tool(),
    holder: measuredHolder(holder),
    collet: null,
    stickout: STICKOUT,
  })
  expect(outline).not.toBeNull()
  const nose = holder.points[holder.points.length - 1]!
  const gage = STICKOUT + nose[0]

  const body = outline!.segments.find((segment) => segment.part === 'body')
  const flange = outline!.segments.find((segment) => segment.part === 'flange')
  if (body === undefined || flange === undefined) {
    return null
  }

  const end = body.points[body.points.length - 1]!
  const start = flange.points[0]!
  // The split shares its meeting point, as every other pair of segments here
  // does. If these ever stop being the same point the silhouette has a gap.
  expect(start).toEqual(end)
  expect(end.z).toBeCloseTo(gage, 9)
  return end.r
}

/** The radius the cut stack ends at: where it meets the spindle face. */
const cutAt = (profile: MeasuredProfile): number =>
  trimToGauge(measuredHolder(profile)).layers.at(-1)!.topDiameter / 2

describe('the cut and the split find the same crossing', () => {
  it('agrees on an interpolated crossing', () => {
    // Two thirds along from r = 20 to r = 24.
    expect(cutAt(profile)).toBeCloseTo(23.333333333333332, 9)
    expect(drawnAtGageLine(profile)).toBeCloseTo(cutAt(profile), 9)
  })

  it('agrees on a vertex that already sits on the face', () => {
    // The other branch of both implementations: no interpolation to do, and
    // the existing vertex is the meeting point.
    const onFace: MeasuredProfile = {
      ...profile,
      points: [
        [-40, 11],
        [0, 24],
        [30, 16],
        [50, 8],
      ],
    }
    expect(cutAt(onFace)).toBe(24)
    expect(drawnAtGageLine(onFace)).toBe(24)
  })

  it('neither cuts a nose-datumed profile', () => {
    // No gauge plane was solved, so there is no line to cut or split on. The
    // cut returns the holder whole and the drawing draws no connection.
    const nosed = measuredHolder({ ...profile, datum: 'nose' })
    expect(trimToGauge(nosed)).toBe(nosed)
    expect(drawnAtGageLine({ ...profile, datum: 'nose' })).toBeNull()
  })

  it('keeps above the face exactly the vertices the cut drops', () => {
    // The two halves are complementary: what the drawing puts in `flange` is
    // every vertex above the spindle face, plus the shared crossing.
    const dropped = points.filter(([z]) => z < 0).length

    const outline = assemblyOutline({
      tool: tool(),
      holder: measuredHolder(profile),
      collet: null,
      stickout: STICKOUT,
    })!
    const flange = outline.segments.find((segment) => segment.part === 'flange')!
    expect(flange.points).toHaveLength(dropped + 1)
    // And the stack the cut keeps is exactly as tall as the body drawn below it.
    const kept = trimToGauge(measuredHolder(profile)).layers
    expect(kept.reduce((total, layer) => total + layer.thickness, 0)).toBeCloseTo(50, 9)
  })
})
