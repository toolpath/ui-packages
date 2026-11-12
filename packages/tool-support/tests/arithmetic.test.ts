/**
 * The functions that had two copies each. The neck and the shank are read off
 * the tool's stack now, and `stack.test.ts` holds them.
 *
 * Every one of them carried a note in both files saying the copies must agree,
 * and nothing was watching whether they did. These are the tests the one
 * implementation gets instead of the note.
 */

import { describe, expect, it } from 'vitest'

import {
  measuredHolder,
  trimToGauge,
  heightAt,
  type Holder,
  type MeasuredProfile,
  type ProfilePoint,
  type ReachCurve,
} from '../src/index.js'

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

describe('the holder from the gage line out', () => {
  const holderOf = (
    points: readonly ProfilePoint[],
    datum: MeasuredProfile['datum'] = 'gage-line',
  ): Holder => measuredHolder({ points, datum })
  /** The radius of the cut stack's top: where it meets the spindle face. */
  const atFace = (holder: Holder) => trimToGauge(holder).layers.at(-1)!.topDiameter / 2

  it('interpolates the crossing rather than taking the nearest vertex', () => {
    // The cut is the spindle face itself. Half a CAT40 model is the 7:24 cone
    // and the retention knob, which is inside the spindle when it is mounted.
    const holder = holderOf([
      [-30, 8],
      [-10, 20],
      [10, 24],
      [50, 8],
    ])
    const cut = trimToGauge(holder)

    // Between (-10, 20) and (10, 24) the face sits halfway: r = 22.
    expect(atFace(holder)).toBeCloseTo(22, 9)
    expect(cut.layers.reduce((total, layer) => total + layer.thickness, 0)).toBeCloseTo(50, 9)
    expect(cut.layers).toHaveLength(2)
  })

  it('keeps a vertex that already sits on the face', () => {
    const holder = holderOf([
      [-30, 8],
      [0, 24],
      [50, 8],
    ])
    expect(trimToGauge(holder).layers).toEqual([
      { thickness: 50, bottomDiameter: 16, topDiameter: 48 },
    ])
  })

  it('returns a nose-datumed holder whole', () => {
    // No gauge plane was solved, so there is no line to cut on. Guessing one
    // would invent the very number the datum exists to say is missing.
    const holder = holderOf(
      [
        [0, 8],
        [20, 24],
      ],
      'nose',
    )
    expect(trimToGauge(holder)).toBe(holder)
  })

  it('returns a holder entirely below the face whole', () => {
    // Nothing to cut: every vertex is already outside the spindle.
    const holder = holderOf([
      [0, 24],
      [50, 8],
    ])
    expect(trimToGauge(holder)).toBe(holder)
  })

  it('returns a holder that would be left a stub whole', () => {
    // A holder measured entirely inside the spindle is bad data, and cutting it
    // to a stub hides that.
    const holder = holderOf([
      [-30, 8],
      [-10, 20],
      [5, 24],
    ])
    expect(trimToGauge(holder)).toBe(holder)
  })

  it('touches nothing below the face', () => {
    // Grooves and thread reliefs are the measurement, and they survive.
    const holder = holderOf([
      [-20, 8],
      [-5, 21],
      [4, 23],
      [4, 19],
      [28, 19],
      [50, 13.5],
    ])
    const cut = trimToGauge(holder).layers
    expect(cut.slice(0, -1)).toEqual(holder.layers.slice(0, cut.length - 1))
    expect(cut.at(-1)!.bottomDiameter).toBe(46)
  })
})
