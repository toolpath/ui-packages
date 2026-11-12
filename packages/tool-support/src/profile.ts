/**
 * A holder as its own CAD model measures it: a silhouette of `[z, r]`
 * vertices, and where it is measured from. `holder.ts`'s `measuredHolder`
 * makes the cone stack a `Holder` is from one, and `trimToGauge` cuts that at
 * the spindle face.
 */

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

/** A measured silhouette: `[z, r]` in millimetres, `z` ascending toward the nose. */
export interface MeasuredProfile {
  /** Two vertices share a `z` where the solid steps. Fewer than two is no holder. */
  readonly points: ReadonlyArray<ProfilePoint>
  readonly datum: ProfileDatum
}
