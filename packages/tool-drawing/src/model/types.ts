/**
 * What this package draws: a cutting tool from `@toolpath/tool-support`, on its
 * own or as it is set up in its holder.
 *
 * The record is tool-support's, and this package declares no shape of its own
 * for a tool or a holder: a drawing and the number printed beside it read one
 * declaration, so they cannot disagree about one tool.
 *
 * All lengths are in millimetres and all angles in degrees.
 */

import type {
  CuttingTool,
  Extension,
  Holder,
  Provenance,
  RotatingToolAssembly,
} from '@toolpath/tool-support'

export type { Provenance }

/**
 * A tool on its own, or a tool set up in its holder at its stickout.
 *
 * A bare tool is drawn alone: no holder, and its shank to its overall length.
 */
export type Drawable = CuttingTool | RotatingToolAssembly

/** Either form, read one way: the stickout is `null` for a tool drawn alone. */
export interface Staged {
  readonly tool: CuttingTool
  readonly holder: Holder | null
  readonly stickout: number | null
  /** A modular extension the head is screwed onto, and its head face to the holder face, mm. */
  readonly extension?: Extension | undefined
  readonly extensionProtrusion?: number | undefined
}

export const staged = (subject: Drawable): Staged =>
  'tool' in subject ? subject : { tool: subject, holder: null, stickout: null }

/**
 * A modular extension's head face, mm above the tip, where one is drawn: an
 * extension that states a shape, standing out of the holder by more than zero
 * and less than the stickout. Null otherwise, so the outline and the
 * dimensions draw the same extension or neither.
 */
export const drawnExtension = ({
  stickout,
  extension,
  extensionProtrusion,
}: Staged): number | null =>
  stickout === null ||
  extension === undefined ||
  extension.layers.length === 0 ||
  extensionProtrusion === undefined ||
  !(extensionProtrusion > 0 && extensionProtrusion < stickout)
    ? null
    : stickout - extensionProtrusion
