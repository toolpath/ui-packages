/**
 * What an assembly is made of, named once.
 *
 * Two vocabularies for these eight words stood in this tree: a drawing's
 * `OutlinePart`, and a clearance sweep's `SilhouettePart`, which was the same
 * list without the two cutting parts. They were not a duplicate by accident —
 * the sweep genuinely does not check the cutting end, because the cutting end
 * is what is cutting — but the *words* were, and a part renamed in one would
 * have gone on meaning the old thing in the other.
 *
 * ## Two representations, one vocabulary
 *
 * A drawing needs a polyline per part; a sweep needs one radius from one height
 * upward. Those are different shapes for different questions and neither
 * projects onto the other, so both survive — {@link Silhouette} here and
 * `OutlineSegment` in `@toolpath/tool-drawing`. What is shared is the naming.
 */

/** Every part a drawn or swept assembly is made of, tip first. */
export const ASSEMBLY_PARTS = [
  'tip',
  'flutes',
  'neck',
  'shank',
  'collet',
  'nose',
  'body',
  'flange',
] as const

export type AssemblyPart = (typeof ASSEMBLY_PARTS)[number]

/**
 * The parts a clearance sweep checks: everything but the cutting end.
 *
 * Derived from {@link ASSEMBLY_PARTS} rather than listed again, so a part added
 * there is swept unless it is deliberately excluded here. The tip and the
 * flutes are excluded because they are the cut — material at the cutting radius
 * is what the tool is there to remove.
 */
export const SILHOUETTE_PARTS = ASSEMBLY_PARTS.filter(
  (part) => part !== 'tip' && part !== 'flutes',
) as readonly Exclude<AssemblyPart, 'tip' | 'flutes'>[]

export type SilhouettePart = (typeof SILHOUETTE_PARTS)[number]

/**
 * One step of an assembly's profile: this radius, from this height above the
 * tip.
 *
 * **A radius from a height upward**, not a band: the last stated diameter
 * carries itself up to the next step. That is the layer model a reach curve is
 * swept against, and it is why nothing has to be invented for the shape between
 * a holder's body and its flange.
 */
export interface Silhouette {
  readonly part: SilhouettePart
  readonly radius: number
  readonly fromHeight: number
}

/** Room the shop wants kept between the stack and the part, in millimetres. */
export interface Margins {
  /**
   * Widens every swept part, so it must clear the wall sideways by this much.
   */
  readonly radial: number
  /**
   * Lifts the material, so a part must stand this far above what it clears.
   */
  readonly axial: number
}

export const NO_MARGINS: Margins = { radial: 0, axial: 0 }
