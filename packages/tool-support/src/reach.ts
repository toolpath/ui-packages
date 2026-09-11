/**
 * The worst-case material around a feature, and what a stack has to get past.
 *
 * **Declared structurally, on purpose.** The shape is exactly what the Toolpath
 * part contracts call a `ReachCurve`, and naming it here rather than importing
 * it is what keeps this package free of the API's schema: a `ReachCurve` off a
 * report satisfies this by structure, with no adapter, and a consumer that only
 * draws a tool pulls in no OpenAPI contract to do it.
 *
 * That seam is what makes the whole package possible. Reading a curve *off a
 * report* is an adapter and stays with whoever holds the report; reading a
 * curve is arithmetic and belongs here.
 */

/**
 * Material heights by distance out from the cut, as a staircase.
 *
 * Read as "material within `horizontalOffset[i]` of the cut rises to
 * `verticalOffset[i]`". Both are in millimetres; the offsets run outward from
 * the cutting edge and the heights up from the bottom of the feature.
 *
 * The rise comes at the **start** of each run, so everything out to a knot is
 * already as tall as that knot says. Anything that reads this curve has to
 * agree about that, or a drawn staircase and a clearance verdict describe two
 * different pockets.
 */
export interface ReachCurve {
  readonly horizontalOffset: readonly number[]
  readonly verticalOffset: readonly number[]
}

/**
 * The tallest material within `offset` mm of the cut, above the feature's
 * bottom.
 *
 * **The twin that had nowhere else to go.** One copy decided the verdict — the
 * clearance sweep, with a dozen callers that never draw anything — and the
 * other was in the drawing package, because the gaps an overlay dimensions
 * cannot be measured without it. Neither could depend on the other: putting the
 * verdict behind a rendering package is the thing the whole split exists to
 * avoid, and a drawing may not depend on a catalog's data package. So there
 * were two, and the note beside each said they must agree exactly.
 *
 * The rise comes at the **start** of each run: for an offset between knots the
 * material could be anywhere out to the next knot, so the next knot's height is
 * the bound. Past the last knot the curve clamps.
 */
export const heightAt = (curve: ReachCurve, offset: number): number => {
  for (let index = 0; index < curve.horizontalOffset.length; index += 1) {
    if ((curve.horizontalOffset[index] ?? 0) >= offset) {
      return curve.verticalOffset[index] ?? 0
    }
  }
  return curve.verticalOffset[curve.verticalOffset.length - 1] ?? 0
}
