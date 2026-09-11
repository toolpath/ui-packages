/**
 * Whether a tool and what holds it clear the material around a feature.
 *
 * The Engine does the three-dimensional work and hands over a **reach curve**:
 * for each distance out from the wall of the cut, how tall the material within
 * that distance stands above the feature's bottom, worst case over the whole
 * feature. An assembly is a solid of revolution, so it is a profile too —
 * radius by height above the tip — and the check is one comparison per step of
 * that profile: anything standing `d` past the cutting edge must sit at least
 * `heightAt(d)` above the bottom. No sweep, no CAD, a loop over a few numbers.
 *
 * **The profile is what the catalog states, and says so.** A tool is flutes, an
 * optional neck, and a shank. A holder is its nose, then the body behind it
 * where the vendor states one, then the flange at its projection. The seated
 * collet's protrusion below the nose is swept too. A pass here is a pass for
 * exactly the silhouette {@link Clearance.checked} lists.
 *
 * **The curve is conservative.** It is the worst case over the whole feature,
 * so an assembly that fails might clear most of the toolpath — a long slot with
 * one tall wall at one end fails for its whole length. Pass means safe; fail
 * means "somewhere along it".
 *
 * ## Why it is here and not in the drawing package
 *
 * This decision has a dozen callers that never draw anything, and putting it
 * behind a rendering package is the thing the whole split exists to avoid. The
 * *lines* an overlay draws from a verdict are `@toolpath/tool-drawing`'s; the
 * verdict is this.
 */

import { NO_MARGINS, type Margins, type Silhouette, type SilhouettePart } from './parts.js'
import { heightAt, type ReachCurve } from './reach.js'
import { hasNeck, type Tool } from './tool.js'
import type { Collet, Holder } from './holding.js'

/**
 * The tool's own profile above the flutes, from what the vendor states.
 *
 * - A neck, where a shoulder diameter *and* length are stated: that radius
 *   from the end of the flutes to the shoulder.
 * - The shank, from the shoulder (or the end of the flutes, where there is no
 *   neck) upward.
 *
 * A neck whose diameter is unstated is taken to be no wider than the cut,
 * which is what a neck is for, and so has nothing to check.
 */
export const toolSilhouette = (tool: Pick<Tool, 'geometry'>): Silhouette[] => {
  const { DC, LCF, SFDM } = tool.geometry
  const neckDiameter = tool.geometry['shoulder-diameter']
  const shoulder = tool.geometry['shoulder-length']
  if (DC === undefined || LCF === undefined) {
    return []
  }
  const steps: Silhouette[] = []
  if (neckDiameter !== undefined && shoulder !== undefined && shoulder > LCF) {
    // A relief narrower than the shank is a neck; one as wide as the shank is
    // plain shank, whatever the vendor's column calls it.
    steps.push({
      part: hasNeck(tool) ? 'neck' : 'shank',
      radius: neckDiameter / 2,
      fromHeight: LCF,
    })
  }
  if (SFDM !== undefined) {
    steps.push({ part: 'shank', radius: SFDM / 2, fromHeight: shoulder ?? LCF })
  }
  return steps
}

/**
 * The tool's own body against the part, whatever holds it.
 *
 * A shank or neck that stands past the cutting edge meets the wall above the
 * flutes at every stickout — no holder and no pull-out changes where the
 * tool's own steps sit above its tip. Paul's call (2026-08-30): such a tool
 * is not compatible with the feature and is not shown; the answer is longer
 * flutes or a reduced shank. Swept with the same margins as the holder.
 */
export const toolCollisions = (
  tool: Pick<Tool, 'geometry'>,
  curve: ReachCurve,
  margins: Margins = NO_MARGINS,
): Collision[] => {
  const DC = tool.geometry.DC
  if (DC === undefined) {
    return []
  }
  return collisionsIn(toolSilhouette(tool), curve, DC / 2, margins)
}

/**
 * What the sweep needs of an assembly.
 *
 * **The parametric holder, not the union.** A measured `HolderProfile` is a
 * hundred-odd vertices and sweeping one is a different function that does not
 * exist yet; taking the union here would let a caller hand over a profile and
 * get a verdict computed from nothing. Declared structurally, so a catalog's
 * own richer assembly satisfies it with no adapter.
 */
export interface SweptAssembly {
  readonly tool: Pick<Tool, 'geometry' | 'form'>
  readonly holder: Holder
  readonly collet?: Collet | null
  readonly stickout: number | null
}

export interface Collision {
  readonly part: SilhouettePart
  /** Where that part of the assembly begins, above the tip, in mm. */
  readonly height: number
  /** How high the material stands at that part's offset from the cut, in mm. */
  readonly needs: number
  /** That offset, in mm past the cutting edge. */
  readonly offset: number
}

export interface Clearance {
  /** Every checked part of the silhouette clears. */
  readonly clears: boolean
  readonly collisions: readonly Collision[]
  /**
   * The least the holder nose has to stand off the tip to clear, in mm — or
   * null where the holder's nose is unstated and so unchecked.
   */
  readonly requiredStickout: number | null
  /** What was actually swept, so a pass is read as exactly that much. */
  readonly checked: readonly SilhouettePart[]
}

/** Millimetres a part may be short of clearing and still clear: float noise, not geometry. */
const CLEARANCE_TOLERANCE = 1e-6

const collisionsIn = (
  steps: readonly Silhouette[],
  curve: ReachCurve,
  cuttingRadius: number,
  margins: Margins,
): Collision[] =>
  steps.flatMap((step) => {
    // At the cut's own radius the step is the wall, which the flutes cut; only
    // what stands past the edge — by more than the room wanted — can meet material.
    const offset = step.radius + margins.radial - cuttingRadius
    if (offset <= 0) {
      return []
    }
    const needs = heightAt(curve, offset) + margins.axial
    // A hair of tolerance: a stack stood out to exactly what it needs lands a
    // femtometre short after the arithmetic, and reported a collet colliding
    // at the stickout this same sweep had just asked for (2026-08-30).
    return step.fromHeight + CLEARANCE_TOLERANCE < needs
      ? [{ part: step.part, height: step.fromHeight, needs, offset }]
      : []
  })

/** The collet's own diameter is its series size: a PG 6 collet is 6 mm across. */
const colletDiameter = (series: string | null): number | null => {
  const digits = /(\d+(?:\.\d+)?)/.exec(series ?? '')
  return digits ? Number(digits[1]) : null
}

/**
 * The holder's profile above the tool, from the stickout up.
 *
 * - The seated collet, standing proud of the nose face by its protrusion, at
 *   the collet's own diameter.
 * - The nose, for its stated length — or, with no length stated, for the
 *   gauge length as before, so an older dataset sweeps what it always did.
 * - The body behind the nose, where stated.
 * - The flange, at the projection. Nothing is swept between it and the body:
 *   a `Silhouette` is a radius **from a height upward**, so the last stated
 *   diameter carries itself up to the flange, which is the layer model of
 *   Justin Mimbs' reach-curve note.
 */
export const holderSilhouette = (assembly: SweptAssembly, stickout: number): Silhouette[] => {
  const { holder } = assembly
  const steps: Silhouette[] = []
  if (holder.noseDiameter === null) {
    return steps
  }

  const collet = colletDiameter(holder.colletSeries)
  if (holder.colletProtrusion !== null && collet !== null) {
    steps.push({
      part: 'collet',
      radius: collet / 2,
      fromHeight: stickout - holder.colletProtrusion,
    })
  }

  steps.push({ part: 'nose', radius: holder.noseDiameter / 2, fromHeight: stickout })

  // Where the nose ends. With no stated nose length the gauge length stands in,
  // so a dataset that predates the column sweeps what it always did.
  const behindTheNose = stickout + (holder.noseLength ?? holder.gaugeLength ?? 0)

  if (holder.bodyDiameter !== null && holder.bodyLength !== null) {
    steps.push({ part: 'body', radius: holder.bodyDiameter / 2, fromHeight: behindTheNose })
  }

  if (holder.projection !== null && holder.flangeDiameter !== null) {
    /**
     * **Cylinders, not cones** (Paul, 2026-08-31).
     *
     * The shape between the last stated diameter and the flange used to be
     * swept as a cone in six steps — a shape no vendor publishes, and on a
     * PG 10 × 062 a 34 mm flare from ⌀18 to ⌀46 that turned tools down for
     * metal that is not there. Justin Mimbs' reach-curve note models a holder
     * as layers: each swept at its widest, no credit for a taper, and the
     * last diameter carried upward — which is what a `Silhouette` already
     * means, so the carry needs no step of its own. The flange is its own
     * layer, at its own height.
     *
     * It is the less conservative reading of an unstated shape, and
     * deliberately so: what the vendor states is what is swept.
     */
    steps.push({
      part: 'flange',
      radius: holder.flangeDiameter / 2,
      fromHeight: stickout + holder.projection,
    })
  }

  return steps
}

/**
 * Whether one assembly clears one feature's reach curve.
 *
 * The holder is checked at the assembly's stickout, and `requiredStickout`
 * says the least stickout at which every part of the holder would clear — so
 * a stack that fails can be read as "stick it out further" rather than "no".
 */
export const clearance = (
  assembly: SweptAssembly,
  curve: ReachCurve,
  margins: Margins = NO_MARGINS,
): Clearance => {
  const { tool, holder, stickout } = assembly
  const DC = tool.geometry.DC
  if (DC === undefined) {
    return { clears: true, collisions: [], requiredStickout: null, checked: [] }
  }
  const cuttingRadius = DC / 2
  const steps = toolSilhouette(tool)

  let requiredStickout: number | null = null
  if (holder.noseDiameter !== null) {
    // What the holder needs is the same whatever the stickout: each of its
    // parts sits a fixed height above the nose face, and has to sit above the
    // material at its own offset. The least stickout is the largest shortfall.
    const atZero = holderSilhouette(assembly, 0)
    requiredStickout = atZero.reduce((most, step) => {
      const offset = step.radius + margins.radial - cuttingRadius
      if (offset <= 0) {
        return most
      }
      return Math.max(most, heightAt(curve, offset) + margins.axial - step.fromHeight)
    }, 0)
    if (stickout !== null) {
      steps.push(...holderSilhouette(assembly, stickout))
    }
  }

  const collisions = collisionsIn(steps, curve, cuttingRadius, margins)
  const checked = [...new Set(steps.map((step) => step.part))]
  return { clears: collisions.length === 0, collisions, requiredStickout, checked }
}

/** Why a collision rules an assembly out, in the words a machinist would use. */
export const describeCollision = (collision: Collision): string => {
  const what = {
    neck: 'the neck',
    shank: 'the shank',
    collet: 'the collet',
    nose: 'the holder nose',
    body: 'the holder body',
    flange: 'the flange',
  }[collision.part]
  return `${what} at ${collision.height.toFixed(1)} mm collides with material ${collision.needs.toFixed(1)} mm tall, ${collision.offset.toFixed(1)} mm out from the cut`
}
