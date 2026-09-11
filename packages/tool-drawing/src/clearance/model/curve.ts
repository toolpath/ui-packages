/**
 * The feature's reach curve, and how the drawing reads it.
 *
 * **Still declared structurally, one package up.** `@toolpath/tool-support`
 * names the shape and imports no Toolpath schema to do it, which is one of the
 * three senses in which this overlay stays optional: a consumer that draws a
 * tool alone pulls in no OpenAPI contract. A `ReachCurve` off a report
 * satisfies it by structure, with no adapter, exactly as before.
 */

import { heightAt, type ReachCurve } from '@toolpath/tool-support'

/**
 * The worst-case material around a feature, as a staircase, and the reading of
 * it that the drawn staircase is drawn from.
 *
 * Both were declared here until `@toolpath/tool-support` existed, and
 * {@link heightAt} in particular had a twin: the clearance *verdict* reads the
 * same curve, that decision has a dozen callers that never draw anything, and
 * it must not end up behind a dependency on React. Neither copy could import
 * the other, so there were two, and each carried a note saying they had to
 * agree exactly. They now are the same function.
 */
export { heightAt }
export type { ReachCurve }

/** Room the shop wants kept between the stack and the part, in millimetres. */
export interface Margins {
  readonly radial: number
  readonly axial: number
}

export const NO_MARGINS: Margins = { radial: 0, axial: 0 }

/** A hair, as the sweep's own tolerance: a gap a femtometre under the room wanted is the room wanted. */
export const GAP_TOLERANCE = 1e-6

/**
 * Where the wall face stands at a given height, as an offset from the cut:
 * the start of the first run of the staircase that rises above that height.
 * Null where nothing stands that tall — no wall to measure to.
 */
export const wallFaceAt = (curve: ReachCurve, z: number): number | null => {
  let from = 0
  for (let index = 0; index < curve.horizontalOffset.length; index += 1) {
    if ((curve.verticalOffset[index] ?? 0) > z + GAP_TOLERANCE) {
      return from
    }
    from = curve.horizontalOffset[index] ?? from
  }
  return null
}
