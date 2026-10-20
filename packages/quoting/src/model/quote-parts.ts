import { isSignedOff, type PartState } from './part-state'

/*
  Which of a quote's parts the quote itself offers. A part set to No quote is on the quote's list
  but not on the offer; of the rest, only those signed off — moved into Quote — are priced on it.
*/

/** What these rules read of a part. */
export interface QuotePart {
  /** Left off the offer: neither priced nor named as missing. */
  noQuote: boolean
  state: PartState
}

/** The parts on the quote: every one but those set to No quote. */
export const quotedParts = <Part extends Pick<QuotePart, 'noQuote'>>(
  parts: ReadonlyArray<Part>,
): Array<Part> => parts.filter((part) => !part.noQuote)

/**
 * The quoted parts not yet signed off — their estimate not approved — which is what Generate Quote
 * warns about.
 */
export const unsignedParts = <Part extends QuotePart>(parts: ReadonlyArray<Part>): Array<Part> =>
  quotedParts(parts).filter((part) => !isSignedOff(part.state))

/**
 * What the quote page prices, and what it names as left out: the quoted parts moved into Quote —
 * signed off — and the names of those still to be moved there. A part set to No quote is neither,
 * as the server's draft PDF and email leave it out (`buildQuotePresentation`), and it cannot be
 * moved into Quote to stop holding the quote back.
 */
export const documentParts = <Part extends QuotePart & { name: string }>(
  parts: ReadonlyArray<Part>,
): { inQuote: Array<Part>; waiting: Array<string> } => ({
  inQuote: quotedParts(parts).filter((part) => isSignedOff(part.state)),
  waiting: unsignedParts(parts).map((part) => part.name),
})
