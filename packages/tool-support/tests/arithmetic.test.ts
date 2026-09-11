/**
 * The four functions that had two copies each.
 *
 * Every one of them carried a note in both files saying the copies must agree,
 * and nothing was watching whether they did. These are the tests the one
 * implementation gets instead of the note.
 */

import { describe, expect, it } from 'vitest'

import {
  belowGageLine,
  hasNeck,
  heightAt,
  shankOf,
  type HolderProfile,
  type ProfilePoint,
  type ReachCurve,
} from '../src/index.js'

const tool = (geometry: Readonly<Record<string, number>>) => ({ geometry })

describe('whether a tool has a neck', () => {
  it('needs a shoulder past the flutes, narrower than the shank', () => {
    expect(
      hasNeck(tool({ DC: 6, LCF: 13, SFDM: 6, 'shoulder-length': 25, 'shoulder-diameter': 5 })),
    ).toBe(true)
  })

  it('is not a neck where the shoulder stops at the flutes', () => {
    // 171 Destiny end mills state a shoulder narrower than the cut whose
    // shoulder length equals the flute length. There is no section to draw or
    // to sweep, so there is no neck.
    expect(
      hasNeck(tool({ DC: 6, LCF: 13, SFDM: 6, 'shoulder-length': 13, 'shoulder-diameter': 5 })),
    ).toBe(false)
  })

  it('is not a neck where the relief is as wide as the shank', () => {
    // Still a relief a drawing shows, but a collet closes on it, so the tool
    // does not have to stand out to it.
    expect(
      hasNeck(tool({ DC: 6, LCF: 13, SFDM: 6, 'shoulder-length': 25, 'shoulder-diameter': 6 })),
    ).toBe(false)
  })

  it('measures the relief against the cut where no shank is stated', () => {
    // `SFDM ?? DC`: a tool with no stated shank is measured against its cutting
    // diameter, and one with neither is taken at its word that the shoulder is
    // a neck — there is nothing left to contradict it with.
    expect(hasNeck(tool({ DC: 6, LCF: 13, 'shoulder-length': 25, 'shoulder-diameter': 5 }))).toBe(
      true,
    )
    expect(hasNeck(tool({ LCF: 13, 'shoulder-length': 25, 'shoulder-diameter': 5 }))).toBe(true)
  })

  it('says no where the vendor states no shoulder at all', () => {
    expect(hasNeck(tool({ DC: 6, LCF: 13, SFDM: 6 }))).toBe(false)
    expect(hasNeck(tool({ DC: 6, SFDM: 6, 'shoulder-length': 25, 'shoulder-diameter': 5 }))).toBe(
      false,
    )
  })

  it('is not fooled by a conversion’s last bit', () => {
    // 3/8" is 9.525 on one sheet and 9.524999999999999 on another. Strict, a
    // relief and a shank of the same nominal size read as a neck.
    expect(
      hasNeck(
        tool({
          DC: 9.525,
          LCF: 13,
          SFDM: 9.525,
          'shoulder-length': 25,
          'shoulder-diameter': 9.524999999999999,
        }),
      ),
    ).toBe(false)
  })
})

describe('whether the shank is reduced', () => {
  it('needs a real relief: narrower than the cut, and with a length', () => {
    expect(shankOf(tool({ DC: 6, LCF: 13, 'shoulder-length': 25, 'shoulder-diameter': 5 }))).toBe(
      'reduced',
    )
  })

  it('is full where the shoulder length stops at the flutes', () => {
    // The 171-tool case again, and the reason this is not simply "narrower than
    // the cut": a shoulder with no section is not a reduced shank.
    expect(shankOf(tool({ DC: 6, LCF: 13, 'shoulder-length': 13, 'shoulder-diameter': 5 }))).toBe(
      'full',
    )
  })

  it('is full where the relief is wider than the cut', () => {
    expect(shankOf(tool({ DC: 6, LCF: 13, 'shoulder-length': 25, 'shoulder-diameter': 8 }))).toBe(
      'full',
    )
  })

  it('answers null where nobody has said', () => {
    // Not a claim that the shank is full. No shoulder stated is no answer.
    expect(shankOf(tool({ DC: 6, LCF: 13, SFDM: 6 }))).toBeNull()
    expect(shankOf(tool({ LCF: 13, 'shoulder-diameter': 5 }))).toBeNull()
  })

  it('is a different question from hasNeck, and answers differently', () => {
    // A relief wider than the cut but narrower than the shank: a neck to draw
    // and sweep, and not a reduced shank. 860 end mills have such a relief and
    // only 245 of them are under the cut.
    const wideRelief = tool({
      DC: 6,
      LCF: 13,
      SFDM: 10,
      'shoulder-length': 25,
      'shoulder-diameter': 8,
    })
    expect(hasNeck(wideRelief)).toBe(true)
    expect(shankOf(wideRelief)).toBe('full')
  })
})

describe('reading the reach curve', () => {
  const curve: ReachCurve = {
    horizontalOffset: [2, 8, 15],
    verticalOffset: [12, 30, 30],
  }

  it('bounds the material by the next knot, and clamps past the last', () => {
    // "Material within h[i] rises to v[i]": everything out to a knot is already
    // as tall as that knot says, so the rise comes at the start of each run.
    // A drawn staircase and a clearance verdict have to read this the same way
    // or they describe two different pockets.
    expect(heightAt(curve, 0)).toBe(12)
    expect(heightAt(curve, 2)).toBe(12)
    expect(heightAt(curve, 2.1)).toBe(30)
    expect(heightAt(curve, 99)).toBe(30)
  })

  it('answers zero for a curve that states nothing', () => {
    // An empty curve is a feature with no material measured around it, not a
    // wall of unknown height.
    expect(heightAt({ horizontalOffset: [], verticalOffset: [] }, 5)).toBe(0)
  })
})

describe('the silhouette from the gage line out', () => {
  const profile = (points: readonly ProfilePoint[], datum: HolderProfile['datum'] = 'gage-line') =>
    ({ points, datum }) as const

  it('interpolates the crossing rather than taking the nearest vertex', () => {
    // The cut is the spindle face itself. Half a CAT40 model is the 7:24 cone
    // and the retention knob, which says nothing a machinist asks a holder
    // drawing and costs the frame the tool is scaled into.
    const kept = belowGageLine(
      profile([
        [-30, 8],
        [-10, 20],
        [10, 24],
        [50, 8],
      ]),
    )

    // Between (-10, 20) and (10, 24) the face sits halfway: r = 22.
    expect(kept[0]).toEqual([0, 22])
    expect(kept).toHaveLength(3)
  })

  it('keeps a vertex that already sits on the face', () => {
    const kept = belowGageLine(
      profile([
        [-30, 8],
        [0, 24],
        [50, 8],
      ]),
    )
    expect(kept).toEqual([
      [0, 24],
      [50, 8],
    ])
  })

  it('returns a nose-datumed profile whole', () => {
    // No gauge plane was solved, so there is no line to cut on. Guessing one
    // would invent the very number the datum exists to say is missing.
    const points: readonly ProfilePoint[] = [
      [0, 8],
      [20, 24],
    ]
    expect(belowGageLine(profile(points, 'nose'))).toBe(points)
  })

  it('returns a profile entirely above the face whole', () => {
    // Nothing to cut: every vertex is already outside the spindle.
    const points: readonly ProfilePoint[] = [
      [0, 24],
      [50, 8],
    ]
    expect(belowGageLine(profile(points))).toBe(points)
  })

  it('returns a profile that would be left a stub whole', () => {
    // A holder measured entirely inside the spindle is bad data, and drawing a
    // one-vertex stub of it hides that.
    const points: readonly ProfilePoint[] = [
      [-30, 8],
      [-10, 20],
      [5, 24],
    ]
    expect(belowGageLine(profile(points))).toBe(points)
  })

  it('touches nothing below the face', () => {
    // Grooves and thread reliefs are the measurement, and they survive.
    const kept = belowGageLine(
      profile([
        [-20, 8],
        [-5, 21],
        [4, 23],
        [4, 19],
        [28, 19],
        [50, 13.5],
      ]),
    )
    expect(kept.slice(1)).toEqual([
      [4, 23],
      [4, 19],
      [28, 19],
      [50, 13.5],
    ])
  })
})
