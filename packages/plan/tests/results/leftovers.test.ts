import { describe, expect, it } from 'vitest'
import { notFinishedIn, notFinishedOf, whyOf } from '../../src/results/leftovers'

describe('whyOf', () => {
  const up = { x: 0, y: 0, z: 1 }
  const side = { x: 1, y: 0, z: 0 }
  const setups = [
    { idx: 0, direction: up, unmachined: [], actions: [] },
    { idx: 1, direction: side, unmachined: ['ABC'], actions: [] },
  ]

  it('names the setup Toolpath gave it to, whose passes leave it', () => {
    expect(whyOf('abc', setups, side)).toEqual({ kind: 'planned', setup: 1 })
  })

  it('else says no setup took it on, and which one faces its way', () => {
    expect(whyOf('def', setups, { x: 0, y: 0, z: 0.99999999 })).toEqual({
      kind: 'leftOut',
      setup: 0,
    })
    expect(whyOf('def', setups, { x: 0, y: 1, z: 0 })).toEqual({ kind: 'leftOut', setup: null })
  })

  it('says a face no feature includes is just that', () => {
    expect(whyOf(null, setups, null)).toEqual({ kind: 'noFeature' })
  })

  it('names the setup that left trimmed features holding every one of its faces, as planned', () => {
    const trimmed = [
      { featureTag: 'abc', regionIdxs: [4, 5] },
      { featureTag: 'ghi', regionIdxs: [6] },
    ]
    expect(whyOf('profile', setups, up, { regions: [4, 5], trimmed })).toEqual({
      kind: 'planned',
      setup: 1,
    })
    // A face no trimmed feature that setup left holds: not planned there, for any of them.
    expect(whyOf('profile', setups, up, { regions: [5, 6], trimmed })).toEqual({
      kind: 'leftOut',
      setup: 0,
    })
    expect(whyOf('profile', setups, up, { regions: [6], trimmed })).toEqual({
      kind: 'leftOut',
      setup: 0,
    })
  })
})

describe('not finished', () => {
  const setups = [
    { idx: 4, unmachined: ['A', 'B'], actions: [{ featureTags: ['a'] }] },
    {
      idx: 7,
      unmachined: ['A', 'C'],
      actions: [{ featureTags: ['A', 'C'] }, { featureTags: ['B'] }],
    },
  ]

  it('is what a setup leaves short that one of its own passes cuts', () => {
    // B, left short here, is cut only in the other setup: machined there, not owed a finish here.
    expect(notFinishedIn(setups[0]!)).toEqual(['A'])
    expect(notFinishedIn(setups[1]!)).toEqual(['A', 'C'])
  })

  it('lists each feature once, in the first setup that roughs it', () => {
    expect(notFinishedOf(setups)).toEqual([
      { tag: 'A', setup: 4 },
      { tag: 'C', setup: 7 },
    ])
  })
})
