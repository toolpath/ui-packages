import { formatMeasured } from './dfm-rules.js'
import type { DfmHit } from './dfm-flags.js'
import type { Units } from './units.js'

/*
 * Taken from the quoting app (quoting-ui `src/estimate/dfm/dfm-explain.ts`),
 * cut down to the few words a feature's rule rows say.
 */

/** Whether a hit has no figure to show: a yes/no, or "any size". */
const figureless = (hit: DfmHit): boolean =>
  hit.metric.quantity === 'flag' || hit.metric.quantity === 'presence'

/** The figure that broke a rule, bare: `7.5`, `0.05"`. Empty for a yes/no or "any size". */
export const hitFigure = (hit: DfmHit, units: Units): string =>
  figureless(hit) ? '' : formatMeasured(hit.metric.quantity, hit.value, units)

/** `through_hole` as `Through hole`. The Engine's feature types are open-ended snake case. */
export { featureTypeLabel } from './geometry.js'
