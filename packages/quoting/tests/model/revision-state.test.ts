import { describe, expect, it } from 'vitest'
import { isOrdered, revisionStateOf } from '../../src/model/revision-state'

describe('isOrdered', () => {
  it('is ordered once paid, or once the shop confirms a purchase order', () => {
    expect(isOrdered({ paid: true, purchaseOrderConfirmed: false })).toBe(true)
    expect(isOrdered({ paid: false, purchaseOrderConfirmed: true })).toBe(true)
  })

  it('is not ordered by a purchase order still waiting on the shop', () => {
    expect(isOrdered({ paid: false, purchaseOrderConfirmed: false })).toBe(false)
  })
})

describe('revisionStateOf', () => {
  it('is open while nothing has replaced or ordered it', () => {
    expect(revisionStateOf({ locked: false, ordered: false })).toBe('open')
  })

  it('is ordered once the customer orders it', () => {
    expect(revisionStateOf({ locked: false, ordered: true })).toBe('ordered')
  })

  it('is locked once revised, whatever was ordered on it', () => {
    expect(revisionStateOf({ locked: true, ordered: false })).toBe('locked')
    expect(revisionStateOf({ locked: true, ordered: true })).toBe('locked')
  })
})
