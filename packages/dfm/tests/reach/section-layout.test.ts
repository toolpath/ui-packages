import { describe, expect, it } from 'vitest'
import { featureBreak, risersOf, spaced, wallBreak } from '../../src/reach/section-layout.js'

describe('risersOf: each place the material steps up', () => {
  it('starts each step just past the knot before', () => {
    expect(risersOf({ offsets: [2, 5, 10], heights: [1, 4, 6] })).toEqual([
      { at: 0, from: 0, to: 1 },
      { at: 2, from: 1, to: 4 },
      { at: 5, from: 4, to: 6 },
    ])
  })

  it('leaves out runs that do not rise', () => {
    expect(risersOf({ offsets: [2, 5, 10], heights: [3, 3, 7] })).toEqual([
      { at: 0, from: 0, to: 3 },
      { at: 5, from: 3, to: 7 },
    ])
  })

  it('finds none where there is no material', () => {
    expect(risersOf({ offsets: [2, 5], heights: [0, 0] })).toEqual([])
  })
})

describe('spaced: the labels that fit on one line', () => {
  const at = (n: number): number => n

  it('keeps labels that are clear of the one before', () => {
    expect(spaced([0, 50, 100], at, 40)).toEqual([0, 50, 100])
  })

  it('drops a label that crowds the one before', () => {
    expect(spaced([0, 10, 50, 100], at, 40)).toEqual([0, 50, 100])
  })

  it('always keeps the last, in place of the one before it', () => {
    expect(spaced([0, 50, 60], at, 40)).toEqual([0, 60])
  })
})

describe('the breaks', () => {
  it('zigzags the feature down the left edge and ends on it', () => {
    expect(featureBreak(10, 0, 16)).toBe('M 10 0 L 13 8 L 10 16')
  })

  it('zigzags the walls between their top and the floor, ends left to the caller', () => {
    expect(wallBreak(100, 0, 32)).toBe(' L 97 8 L 103 16 L 97 24')
  })
})
