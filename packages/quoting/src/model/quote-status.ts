/**
 * Where a quote has got to.
 *
 * `new` and `estimated` are read off the parts, so they cannot disagree with what the parts
 * actually say; `sent`, `won` and `lost` are decisions a person makes and are stamped on the
 * revision.
 *
 * `won` and `lost` are not further along than `sent` — they are how it ended. Both sit at the
 * same distance from the start, which is why nothing reads a status's index as a distance any
 * more; the progress bar keeps its own table of how full it is.
 *
 * There is deliberately no state between them. A `quoted` stamp once sat here, but marking a
 * quote quoted did nothing a person could point at beyond signing its parts off — which is what
 * `estimated` already means — so it was a second name for the same fact and a step in the
 * timeline that never had a page. Signing the parts off *is* having a quote; the next thing that
 * happens to it is being sent.
 *
 * In the order a quote passes through them, read as "has it got at least this far": the timeline
 * compares against `estimated` and `sent` to decide which of its stages are done.
 */
export const QUOTE_STATUSES = ['new', 'estimated', 'sent', 'won', 'lost'] as const

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

/**
 * A revision is `estimated` only once every one of its parts is, and one with no parts yet is
 * `new` — there is nothing to have estimated.
 */
export const quoteStatus = (revision: {
  sentAt: Date | null
  outcome: 'won' | 'lost' | null
  partCount: number
  estimatedPartCount: number
}): QuoteStatus => {
  /*
    A quote with nothing on it is new, whatever it once was. Deleting the last part takes the
    quote back to the start — there is nothing priced, nothing to send, and a document built from
    it would be an empty page with a total of zero. The stamps are cleared when the last
    part goes, so this is belt and braces for a revision that lost its parts another way.
  */
  if (revision.partCount === 0) {
    return 'new'
  }
  /*
    Every part signed off is the floor for the stage above it. A quote is only sent if its parts
    were checked, so taking a sign-off back drops the quote to the start whatever it was stamped —
    the stamp is cleared alongside, and this makes the reading honest even where it was not.
  */
  if (revision.estimatedPartCount !== revision.partCount) {
    return 'new'
  }
  /* How it ended outranks having been sent, which is the fact it supersedes. */
  if (revision.outcome) {
    return revision.outcome
  }
  if (revision.sentAt) {
    return 'sent'
  }
  return 'estimated'
}

/** Whether the quote has gone out: sent, or answered, which it cannot be without going out. */
export const hasBeenSent = (status: QuoteStatus): boolean =>
  status === 'sent' || status === 'won' || status === 'lost'
