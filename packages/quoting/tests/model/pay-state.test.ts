import { describe, expect, it } from 'vitest'
import { payStatusOf, type PayStatusInput } from '../../src/model/pay-state'

/** A revision a customer can pay: priced, open, no end date, payments set up. */
const payable: PayStatusInput = {
  payment: null,
  locked: false,
  lost: false,
  expiresAt: null,
  hasPurchaseOrder: false,
  priced: true,
  canTakePayment: true,
  ordered: false,
}

const NOW = new Date('2026-10-20T00:00:00Z')
const PAST = '2026-10-10T00:00:00.000Z'

describe('payStatusOf', () => {
  it('is payable when nothing stands in the way', () => {
    expect(payStatusOf(payable, NOW)).toBe('payable')
  })

  it('shows a payment over everything else, kept or given back', () => {
    const closedEveryWay = { ...payable, locked: true, lost: true, expiresAt: PAST }
    expect(payStatusOf({ ...closedEveryWay, payment: 'kept' }, NOW)).toBe('paid')
    expect(payStatusOf({ ...closedEveryWay, payment: 'refunded' }, NOW)).toBe('refunded')
  })

  it('is superseded once revised, before lost or expired', () => {
    expect(payStatusOf({ ...payable, locked: true, lost: true, expiresAt: PAST }, NOW)).toBe(
      'superseded',
    )
  })

  it('is closed once the quote is lost', () => {
    expect(payStatusOf({ ...payable, lost: true, expiresAt: PAST }, NOW)).toBe('closed')
  })

  it('is expired past its last day', () => {
    expect(payStatusOf({ ...payable, expiresAt: PAST }, NOW)).toBe('expired')
  })

  it('keeps a purchase order sent in time past the date', () => {
    expect(
      payStatusOf(
        { ...payable, expiresAt: PAST, hasPurchaseOrder: true, canTakePayment: false },
        NOW,
      ),
    ).toBe('unavailable')
  })

  it('is not ready while it does not price', () => {
    expect(payStatusOf({ ...payable, priced: false }, NOW)).toBe('not_ready')
  })

  it('takes a purchase order when no payment can be taken', () => {
    expect(payStatusOf({ ...payable, canTakePayment: false }, NOW)).toBe('unavailable')
  })

  it('takes no payment for a revision a confirmed purchase order already ordered', () => {
    expect(payStatusOf({ ...payable, ordered: true }, NOW)).toBe('unavailable')
  })
})
