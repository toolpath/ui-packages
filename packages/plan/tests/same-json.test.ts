import { describe, expect, it } from 'vitest'
import { sameJson, sortedKeys } from '../src/same-json'

describe('sameJson', () => {
  it('ignores the order of keys, at every depth', () => {
    expect(sameJson({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true)
    expect(sameJson({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })).toBe(false)
  })

  it('keeps the order of arrays: a reordered list is a change', () => {
    expect(sameJson([1, 2], [2, 1])).toBe(false)
    expect(sameJson({ features: ['a', 'b'] }, { features: ['b', 'a'] })).toBe(false)
    expect(sameJson([1, 2], [1, 2])).toBe(true)
  })

  it('ignores key order within the objects of an array, but not their order', () => {
    expect(sameJson([{ id: 'a', n: 1 }], [{ n: 1, id: 'a' }])).toBe(true)
    expect(sameJson([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }])).toBe(false)
  })

  it('reads a key left undefined as absent, as JSON does', () => {
    expect(sameJson({ a: undefined }, {})).toBe(true)
    expect(sameJson({ features: [], removed: undefined }, { features: [] })).toBe(true)
  })
})

describe('sortedKeys', () => {
  it('sorts every object’s keys, nested ones and those inside arrays too', () => {
    const sorted = sortedKeys({ b: [{ y: 1, x: 2 }], a: { d: 1, c: 2 } })
    expect(JSON.stringify(sorted)).toBe('{"a":{"c":2,"d":1},"b":[{"x":2,"y":1}]}')
  })

  it('leaves arrays in their order, and other values as they are', () => {
    expect(sortedKeys([3, 1, 2])).toEqual([3, 1, 2])
    expect(sortedKeys(null)).toBe(null)
    expect(sortedKeys('a')).toBe('a')
  })
})
