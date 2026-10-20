import { isQuoteExpired } from './expiry'

/*
  What the customer's page offers for a revision: payment, a purchase order, a receipt, or why it
  takes nothing. The checks run in order, and the first that holds decides.
*/

/**
 * - `paid` / `refunded`: a payment was taken, and given back or not. It outranks everything after.
 * - `superseded`: a newer revision replaced this one.
 * - `closed`: the quote was marked lost.
 * - `expired`: past the quote's last day, with no purchase order sent in time.
 * - `not_ready`: it does not price (a part not signed off, mixed currencies).
 * - `unavailable`: no payment can be taken, so it takes a purchase order instead — or it is already
 *   ordered by one the shop confirmed.
 * - `payable`: it can be paid.
 */
export type PayStatus =
  | 'paid'
  | 'refunded'
  | 'superseded'
  | 'closed'
  | 'expired'
  | 'not_ready'
  | 'unavailable'
  | 'payable'

/** What a revision's pay status is read from. */
export interface PayStatusInput {
  /** The payment taken for it, if any: kept, or given back by the shop. */
  payment: 'kept' | 'refunded' | null
  /** A newer revision has replaced it. */
  locked: boolean
  /** The quote was marked lost. */
  lost: boolean
  /** The quote's last day (`expiry.ts`), or null when the offer has no end. */
  expiresAt: string | Date | null
  /** A purchase order was sent for it, confirmed or still with the shop. */
  hasPurchaseOrder: boolean
  /** It prices: every quoted part signed off, in one currency. */
  priced: boolean
  /** Money can be taken: a payment provider is set up and the business is ready for it. */
  canTakePayment: boolean
  /** It is ordered (`isOrdered`). Not paid, by the time this is asked: by a confirmed purchase order. */
  ordered: boolean
}

export const payStatusOf = (input: PayStatusInput, now: Date = new Date()): PayStatus => {
  if (input.payment !== null) {
    return input.payment === 'kept' ? 'paid' : 'refunded'
  }
  if (input.locked) {
    return 'superseded'
  }
  if (input.lost) {
    return 'closed'
  }
  // A purchase order sent in time — confirmed or still with the shop — stands past the date.
  if (isQuoteExpired(input.expiresAt, now) && !input.hasPurchaseOrder) {
    return 'expired'
  }
  if (!input.priced) {
    return 'not_ready'
  }
  // A business that sets up payments after a purchase order was confirmed is not paid twice.
  if (!input.canTakePayment || input.ordered) {
    return 'unavailable'
  }
  return 'payable'
}
