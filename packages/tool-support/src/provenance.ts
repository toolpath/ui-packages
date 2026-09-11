/**
 * Where a stated fact came from.
 *
 * Carried per constant by the scraper and kept all the way through, for one
 * reason: a number a shop cannot trace is a number they have to take on faith.
 * A derived or assumed value has to be visibly not the vendor's.
 *
 * The scraper calls this `FactSource` and the drawing calls it `Provenance`;
 * they are the same three strings, and this is the one declaration. `Provenance`
 * is the name kept because it is what the values describe — the vendor's
 * `vendor-stated` is not a *source* in the sense the scraper's transport means
 * one.
 */

/** Every {@link Provenance}, in decreasing order of how much a shop can lean on it. */
export const PROVENANCE = ['vendor-stated', 'derived', 'assumed'] as const

export type Provenance = (typeof PROVENANCE)[number]

/**
 * Which values are the vendor's and which this pipeline decided, keyed the same
 * way the record they describe is.
 *
 * A key with no entry is not a claim of `vendor-stated`: it is nobody having
 * said. Defaulting an absent provenance to the vendor's is how a derived number
 * ends up presented as published.
 */
export type ProvenanceMap = Readonly<Record<string, Provenance>>
