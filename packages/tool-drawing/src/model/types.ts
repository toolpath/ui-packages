/**
 * What this package needs to draw an assembly — which is the shared cutting-tool
 * domain, under the names this package has always published.
 *
 * These four were declared here until `@toolpath/tool-support` existed, and the
 * declarations were three-way duplicates: the same provenance strings, the same
 * geometry codes and three shapes called "holder" of which no two agreed on
 * which fields exist. A drawing and the number printed beside it were free to
 * disagree about one tool, and once did — the stickout the details table showed
 * was not the stickout the dimension line drew.
 *
 * So the shapes now come from the one declaration and these are **aliases**,
 * exported from `.` and from `/geometry` exactly as before. A consumer's adapter
 * does not move: `ViewerTool` is `Tool`, and a catalog record that satisfied one
 * satisfies the other by structure.
 *
 * ## Why the alias and not a rename
 *
 * A consumer's adapter is the single file that fails loudly when either side
 * moves, and renaming the type it targets would be that failure for no gain. The
 * `Viewer*` names are also what the two entry points publish, so dropping them
 * is a major bump this change has no reason to spend. `@toolpath/tool-support`
 * is where the domain is documented; this file is the seam.
 *
 * `geometry` still keeps the scraper's own field names — `DC`, `SFDM`, `OAL`,
 * `LCF`, `RE`, `SIG`, `NOF`, `shoulder-diameter`, `shoulder-length` — and
 * `@toolpath/tool-support`'s `GEOMETRY_FIELDS` is now the dictionary behind
 * them.
 *
 * All lengths are in millimetres and all angles in degrees, and every generator
 * works in whatever unit system it is handed: an inch tool yields an inch
 * outline. Converting is the caller's, at the seam where a tool meets a holder.
 */

import type { Holder, HolderProfile, Provenance, Tool } from '@toolpath/tool-support'

/** Where a stated number came from. */
export type { Provenance }

/** A cutting tool, as the drawing needs one. */
export type ViewerTool = Tool

/** A holder as its vendor publishes it: a nose, a body, a projection. */
export type ViewerHolder = Holder

/**
 * A holder as its own CAD model measures it: the silhouette, and nothing
 * parametric.
 *
 * Not a refinement of {@link ViewerHolder} and it does not project onto one —
 * reducing a measured envelope to a nose and a body throws away the only reason
 * to measure. The two are a union and {@link isHolderProfile} tells them apart;
 * a consumer that has neither passes `null` and the tool is drawn alone.
 */
export type ViewerHolderProfile = HolderProfile

/** Which of the two holder forms this is. */
export { isHolderProfile } from '@toolpath/tool-support'

/**
 * A tool, the holder it is clamped in, and how far it stands out.
 *
 * Deliberately **not** `@toolpath/tool-support`'s `Assembly`, which also carries
 * the collet: a drawing reads a collet only through the holder's own series and
 * protrusion, and taking one it never reads would be a field every adapter has
 * to fill for nothing.
 */
export interface ViewerAssembly {
  readonly tool: ViewerTool
  readonly holder: ViewerHolder | ViewerHolderProfile | null
  /**
   * How far the tool stands out of the holder nose, in millimetres — the
   * shop's number, nobody's else. Null draws the tool alone.
   */
  readonly stickout: number | null
}
