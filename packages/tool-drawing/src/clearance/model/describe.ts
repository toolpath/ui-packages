import type { Margins } from './curve.js'
import { GAP_TOLERANCE } from './curve.js'
import type { Gaps } from './gaps.js'

/**
 * The caption's sentence for the tightest points, in the caller's own unit.
 *
 * **This is the drawing's half of the verdict, not the verdict.** It says what
 * was measured and where; whether the assembly may be used is answered
 * elsewhere, by the engine that answers it for everything else too.
 */
export const describeGaps = (
  gaps: Gaps,
  margins: Margins,
  formatLength: (millimetres: number) => string,
): string | null => {
  const deciding = gaps.axial
  if (deciding === null) {
    return null
  }
  const up =
    deciding.gap < 0
      ? `${formatLength(-deciding.gap)} into the wall at the ${deciding.part}`
      : `${formatLength(deciding.gap)} above the wall at the ${deciding.part}`
  const sideways = gaps.radial
  const side =
    sideways === null || sideways.gap <= GAP_TOLERANCE
      ? ''
      : ` · ${formatLength(sideways.gap)} from the wall at the ${sideways.part}`
  return `tightest: ${up}${side} — ${formatLength(margins.axial)} up and ${formatLength(margins.radial)} sideways wanted`
}
