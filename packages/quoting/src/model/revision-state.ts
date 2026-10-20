/*
  Whether a revision can still change. A quote keeps every revision it had, and only the newest is
  worked on: revising locks the one before. A customer's order closes the open one too, since the
  parts and prices on it are what was ordered. Revising is still allowed — that is how a shop
  changes an order, with a new offer.
*/

/** `open` may change; `locked` is superseded by a newer revision; `ordered` the customer ordered. */
export type RevisionState = 'open' | 'locked' | 'ordered'

/** What a customer has done about a revision. */
export interface OrderInput {
  /** A payment for it was taken (and kept, even once refunded). */
  paid: boolean
  /** The shop confirmed a purchase order for it. One uploaded and not yet confirmed is no order. */
  purchaseOrderConfirmed: boolean
}

/** Ordered: paid for, or a purchase order the shop confirmed. */
export const isOrdered = ({ paid, purchaseOrderConfirmed }: OrderInput): boolean =>
  paid || purchaseOrderConfirmed

/** A superseded revision is locked whatever was ordered on it. */
export const revisionStateOf = ({
  locked,
  ordered,
}: {
  /** A newer revision has replaced it. */
  locked: boolean
  /** {@link isOrdered}. */
  ordered: boolean
}): RevisionState => (locked ? 'locked' : ordered ? 'ordered' : 'open')
