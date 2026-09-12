/**
 * What an export could not say, and why — the one vocabulary every exporter
 * shares.
 *
 * A CAM format is narrower than this domain, always and in both directions. It
 * has fields nobody scraped and no word for facts the catalog carries: a
 * provenance, an ISO workpiece group, how far a seated collet stands proud of
 * a holder nose. So an export is never simply a document. It is a document
 * plus an account of what happened to everything that did not fit, and the
 * account has to be machine-readable because the caller writing a thousand
 * tools is not going to read prose.
 *
 * **The alternative is the failure this tree is organised against.** An
 * exporter that silently drops an unrepresentable fact produces a file that
 * looks complete, and an exporter that silently substitutes a plausible value
 * for a missing one produces a file that looks correct. Both are wrong in the
 * way nobody checks. `Provenance` already makes this distinction for a stated
 * number — vendor-stated, derived, assumed — and this is the same distinction
 * for a whole record on its way out.
 */

/**
 * What happened to something the exporter could not carry across as-is.
 *
 * The four are deliberately not severities. They are different *kinds* of
 * event, and a caller filters on the kind rather than on a level: a pipeline
 * that will not ship a guessed number filters `filled`, and one that only
 * wants to know what it lost filters `dropped`.
 */
export type ExportNoteKind =
  /** The record was not written at all. The document is short by one tool. */
  | 'skipped'
  /**
   * The format has no word for this fact, so it did not travel. The document
   * is complete as far as the format goes, and poorer than the catalog.
   */
  | 'dropped'
  /**
   * A value the format demands that the vendor did not publish, supplied by
   * this package. Not the vendor's number — the distinction `Provenance`
   * draws, at the granularity of one exported field.
   */
  | 'filled'
  /**
   * A stated value mapped onto a weaker one the format can express — a PCD
   * substrate becoming `unspecified` because Fusion's material vocabulary has
   * no word for diamond. Something was said; less of it survived.
   */
  | 'coerced'

export interface ExportNote {
  /**
   * Which record this is about, in whatever terms the caller will recognise —
   * a guid, or a catalog number where there is no guid yet.
   *
   * Not an index into the input: a caller that filtered or re-ordered its
   * tools between building them and exporting them cannot resolve one, and
   * that is exactly the caller most likely to be reading these in bulk.
   */
  readonly subject: string
  readonly kind: ExportNoteKind
  /**
   * The field, in the *target* format's own names — `geometry.LB`, `BMC`,
   * `holder.segments`. The target's names rather than this domain's, because
   * a note is read beside the document it describes, and a reader looking for
   * `LBH` in a Fusion library will not find it.
   *
   * Absent where the note is about a whole record.
   */
  readonly field?: string
  /** One sentence, phrased so it can be shown to whoever has to fix it. */
  readonly message: string
}

/**
 * A document, and everything the exporter could not say while building it.
 *
 * The two are returned together and not as a document plus a thrown error,
 * because a partial export is the ordinary case rather than the failure case:
 * a catalog of four thousand tools will always contain a handful the format
 * cannot hold, and refusing the whole batch for them would make the exporter
 * useless on real data.
 */
export interface ExportResult<T> {
  readonly document: T
  readonly notes: readonly ExportNote[]
}
