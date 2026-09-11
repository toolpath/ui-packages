/**
 * A holder as its own CAD model measures it: the silhouette, and nothing
 * parametric.
 *
 * Two `PROFILES_VERSION = 1` constants stood in this tree, one of which was
 * imported under an alias specifically so it could be compared against the
 * other. This is the one.
 */

import type { ProvenanceMap } from './provenance.js'

/** Bumped when {@link HolderProfile} changes shape in a way a consumer must handle. */
export const PROFILES_VERSION = 1

/** One vertex of a silhouette: `[z, r]`, both in millimetres. */
export type ProfilePoint = readonly [z: number, r: number]

/**
 * What `z = 0` means on a profile.
 *
 * `gage-line` is the spindle face, with `z` increasing toward the cutting end —
 * so the taper is negative, the nose positive, and the holder's gauge length is
 * the last vertex's `z`. `nose` is the frame a holder with no taper to solve a
 * gauge plane on is measured in, and it is stated rather than silently
 * referenced to an arbitrary end: there is no gauge length to read off it, and a
 * consumer must say so instead of printing one.
 *
 * **Per profile rather than per document.** One datum over a batch is only true
 * while every holder in it has a taper, and the first Capto or straight-shank
 * holder makes the document's own header wrong about some of its entries.
 */
export type ProfileDatum = 'gage-line' | 'nose'

/**
 * The measured envelope.
 *
 * A parametric holder is a handful of numbers off a DIN 4000 sheet, and a
 * drawing built from them is a stylised holder. This is the other thing a
 * catalog can have — the envelope measured off the vendor's STEP model, a
 * hundred-odd vertices carrying the V-flange groove and the thread relief that
 * a machinist actually looks for. **It is not a refinement of the parametric
 * form and does not project onto it**: reducing it to a nose and a body throws
 * away the only reason to measure.
 *
 * So the two are a union rather than one shape with optional extras — see
 * `holding.ts` — and a consumer that has both picks one.
 *
 * How well the model agrees with the vendor's published gauge length, and by
 * how much it falls short when it does not, is a fact about *that measurement
 * run* and stays on whatever document carries the run. A record that has it
 * extends this.
 */
export interface HolderProfile {
  /**
   * The silhouette as `[z, r]` in millimetres, `z` ascending.
   *
   * Two vertices share a `z` where the solid steps, so this is a polyline and
   * not a function of `z`. Fewer than two vertices is no holder.
   */
  readonly points: readonly ProfilePoint[]
  readonly datum: ProfileDatum
  /** The series the holder takes, as a parametric `Holder` means it. */
  readonly colletSeries: string | null
  /** How far the seated collet stands proud of the nose, in millimetres. */
  readonly colletProtrusion: number | null
  /**
   * Keyed as a parametric `Holder`'s is, plus `points` for the measurement
   * itself — which is `vendor-stated` unless a caller says otherwise, because
   * the shape measured is the vendor's own model rather than a derivation from
   * its table.
   */
  readonly provenance?: ProvenanceMap
}

/**
 * The silhouette from the gage line out, where the measurement knows where the
 * gage line is.
 *
 * A CAT40 model is measured whole, and about half of what comes back is the
 * 7:24 cone and the retention knob — the part that is inside the spindle when
 * the holder is in the machine. That says nothing a machinist is asking a
 * holder drawing, and it costs the frame: the tool ends up a third of the
 * height it could be because the picture is scaled to fit a taper nobody is
 * looking at.
 *
 * So a `gage-line` profile is cut at `z = 0`, which is the spindle face, and
 * where the polyline crosses it between two vertices the crossing point is
 * **interpolated** so the cut is the face rather than the nearest vertex to it.
 * Nothing below the gage line is touched — the vertices that survive are the
 * measurement, grooves and thread reliefs included.
 *
 * A `nose`-datumed profile is returned whole: with no gauge plane solved there
 * is no line to cut on, and guessing one would be inventing the very number the
 * datum exists to say is missing. A profile that would be left shorter than a
 * segment is also returned whole, because a holder measured entirely inside the
 * spindle is bad data and drawing a stub of it hides that.
 *
 * ## The crossing is the part that has to be shared
 *
 * A renderer that draws the whole holder still has to find this same `z = 0`
 * crossing, because it splits the silhouette there to draw the connection in
 * its own shade rather than trimming it away — a different decision about the
 * same line. The two interpolations have to land on the same radius or a holder
 * meets its gage line in two places, and that is asserted against this function
 * rather than left as a note in both files.
 *
 * Takes the profile structurally, so a measurement record that carries more
 * than this satisfies it with no adapter.
 */
export const belowGageLine = (
  profile: Pick<HolderProfile, 'points' | 'datum'>,
): readonly ProfilePoint[] => {
  if (profile.datum !== 'gage-line') {
    return profile.points
  }

  const cut = profile.points.findIndex(([z]) => z >= 0)
  const inside = profile.points[cut - 1]
  const outside = profile.points[cut]
  if (cut <= 0 || inside === undefined || outside === undefined) {
    return profile.points
  }

  const kept = profile.points.slice(cut)
  if (kept.length < 2) {
    return profile.points
  }
  if (outside[0] === 0) {
    return kept
  }

  const meet: ProfilePoint = [
    0,
    inside[1] + (-inside[0] / (outside[0] - inside[0])) * (outside[1] - inside[1]),
  ]
  return [meet, ...kept]
}
