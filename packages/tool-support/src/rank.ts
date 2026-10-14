/**
 * The order a tool list for one feature reads in.
 *
 * {@link fitTools} answers which tools fit; a list shown to a machinist also
 * needs an order, and one that runs out of tools needs to say which come
 * closest. Each fit is classed first ({@link fitClass}):
 *
 * - `'fits'`: nothing ruled it out;
 * - `'corner-only'`: every failure is a `'sharp-corner'` one — it gets in and
 *   reaches the depth, and only leaves its own radius in corners drawn sharp,
 *   which no end mill finishes. The closest a library can come;
 * - `'fails'`: anything else.
 *
 * Then, in that class order:
 *
 * 1. `'fits'`: the form's place in `forms` (a form not in it, or no `forms` at
 *    all, after); where the demand states a floor fillet, a corner radius at or
 *    under it first, closest first — it finishes the most of the fillet — and
 *    one over it after, smallest first, with no corner radius read as sharp;
 *    then cutting diameter, largest first: the stiffest tool that fits.
 * 2. `'corner-only'`: the radius it leaves in the corners, smallest first; then
 *    form order, then cutting diameter, largest first.
 * 3. `'fails'`: as `'fits'`.
 *
 * Ties keep the input order. This orders by geometry and form only — "fits
 * geometrically", never "recommended": no reach, shank or holder is checked.
 */

import type { FeatureDemand } from './demand.js'
import type { ToolFit } from './fit.js'
import type { Tool } from './tool.js'

/** How close a {@link ToolFit} came. */
export type FitClass = 'fits' | 'corner-only' | 'fails'

const CLASS_RANK: Readonly<Record<FitClass, number>> = { fits: 0, 'corner-only': 1, fails: 2 }

type Verdict = Pick<ToolFit<unknown>, 'fits' | 'failures'>

/** Whether a fit fits, misses only corners drawn sharp, or fails outright. */
export const fitClass = (fit: Verdict): FitClass => {
  if (fit.fits) return 'fits'
  return fit.failures.length > 0 && fit.failures.every((failure) => failure.kind === 'sharp-corner')
    ? 'corner-only'
    : 'fails'
}

/**
 * The radius a `'corner-only'` fit leaves in the corners — the largest over its
 * features — and `undefined` for any other.
 */
export const leavesCornerRadius = (fit: Verdict): number | undefined =>
  fitClass(fit) === 'corner-only'
    ? Math.max(...fit.failures.map((failure) => failure.leavesCornerRadius ?? 0))
    : undefined

/**
 * `fits` in reading order, as above. A new array; the input is not sorted in
 * place.
 *
 * `forms` is the order forms lead in for this feature — `formsFor` in
 * `@toolpath/dfm/model` gives one — or `null` to leave form out of it.
 */
export const rankFits = <T extends Pick<Tool, 'form' | 'geometry'>>(
  fits: readonly ToolFit<T>[],
  forms: readonly string[] | null,
  demand: Pick<FeatureDemand, 'floorRadius'>,
): ToolFit<T>[] => {
  const formRank = (form: string): number => {
    const at = forms ? forms.indexOf(form) : -1
    return at < 0 ? Number.MAX_SAFE_INTEGER : at
  }
  const floor = demand.floorRadius
  const cornerRank = (tool: T): readonly [number, number] => {
    if (floor === undefined) return [0, 0]
    const radius = tool.geometry.RE ?? 0
    return radius <= floor ? [0, floor - radius] : [1, radius - floor]
  }

  return fits
    .map((fit, order) => ({
      fit,
      order,
      cls: fitClass(fit),
      leaves: leavesCornerRadius(fit) ?? 0,
    }))
    .sort((a, b) => {
      const byClass = CLASS_RANK[a.cls] - CLASS_RANK[b.cls]
      if (byClass !== 0) return byClass
      const byForm = formRank(a.fit.tool.form) - formRank(b.fit.tool.form)
      const byDiameter = (b.fit.tool.geometry.DC ?? 0) - (a.fit.tool.geometry.DC ?? 0)
      if (a.cls === 'corner-only') {
        return a.leaves - b.leaves || byForm || byDiameter || a.order - b.order
      }
      const [aOver, aGap] = cornerRank(a.fit.tool)
      const [bOver, bGap] = cornerRank(b.fit.tool)
      return byForm || aOver - bOver || aGap - bGap || byDiameter || a.order - b.order
    })
    .map(({ fit }) => fit)
}
