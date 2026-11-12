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
 * **The profile is what the catalog states, and says so.** A tool is flutes
 * and the `shaft` it states above them, cut at the stickout. A holder is its
 * cone stack, each layer swept at its widest from where it starts: the first is
 * its nose and the rest its body.
 * The seated collet's protrusion below the nose is swept too, and a modular
 * extension's layers from its head face up to the holder face. A pass here is a pass for
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
import type { Cone, CuttingTool, RotatingToolAssembly } from './model.js'
import { trimToGauge } from './holder.js'
import { shaftParts, sliceAt } from './stack.js'
import { dimensionsOf } from './tool.js'

/**
 * Layers of the tool's shaft as steps: each at its widest, from where it
 * starts, the first from the top of the flutes, labelled neck or shank as
 * {@link shaftParts} reads them, as the drawing labels them.
 */
const shaftSteps = (tool: CuttingTool, layers: ReadonlyArray<Cone>): Silhouette[] => {
  const parts = shaftParts(tool, layers)
  const steps: Silhouette[] = []
  let height = dimensionsOf(tool).fluteLength
  for (const [index, layer] of layers.entries()) {
    steps.push({
      part: parts[index] ?? 'shank',
      radius: Math.max(layer.bottomDiameter, layer.topDiameter) / 2,
      fromHeight: height,
    })
    height += layer.thickness
  }
  return steps
}

/**
 * The tool's own profile above the flutes: its whole `shaft`, each layer at
 * its widest from where it starts. A tool that states no shaft sweeps nothing
 * above its flutes.
 */
export const toolSilhouette = (tool: CuttingTool): Silhouette[] =>
  shaftSteps(tool, tool.shaft ?? [])

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
  tool: CuttingTool,
  curve: ReachCurve,
  margins: Margins = NO_MARGINS,
): Collision[] =>
  collisionsIn(toolSilhouette(tool), curve, dimensionsOf(tool).diameter / 2, margins)

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
   * null where there is no holder, or it states no shape, and so is unchecked.
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
const colletDiameter = (series: string | undefined): number | null => {
  const digits = /(\d+(?:\.\d+)?)/.exec(series ?? '')
  return digits ? Number(digits[1]) : null
}

/**
 * The holder's profile above the tool, from the stickout up.
 *
 * - The seated collet, standing proud of the nose face by its protrusion, at
 *   the collet's own diameter.
 * - Each layer of the stack, at its widest, from where it starts: the first is
 *   the nose and every other is body. A `Silhouette` is a radius **from a
 *   height upward**, so each diameter carries itself up to the next layer,
 *   which is the layer model of Justin Mimbs' reach-curve note.
 *
 * Only the stack below the spindle face is swept ({@link trimToGauge}). A
 * holder that states no shape sweeps nothing, collet included.
 */
export const holderSilhouette = (
  assembly: Pick<RotatingToolAssembly, 'holder'>,
  stickout: number,
): Silhouette[] => {
  // Only what is below the spindle face can meet the part.
  const holder = assembly.holder === null ? null : trimToGauge(assembly.holder)
  if (holder === null || holder.layers.length === 0) {
    return []
  }
  const steps: Silhouette[] = []
  const collet = colletDiameter(holder.colletSeries)
  if (holder.colletProtrusion !== undefined && collet !== null) {
    steps.push({
      part: 'collet',
      radius: collet / 2,
      fromHeight: stickout - holder.colletProtrusion,
    })
  }
  let height = stickout
  for (const [index, layer] of holder.layers.entries()) {
    steps.push({
      part: index === 0 ? 'nose' : 'body',
      radius: Math.max(layer.bottomDiameter, layer.topDiameter) / 2,
      fromHeight: height,
    })
    height += layer.thickness
  }
  return steps
}

/**
 * The modular extension's profile relative to the holder face: from its head
 * face, `−extensionProtrusion`, up to the holder face at 0.
 *
 * Each layer at its widest, from where it starts, head end first. A layer that
 * starts at or above the holder face is inside the holder and is not swept.
 * The holder, collet and extension are one block, so this is the same at any
 * stickout. An extension with no layers, or no `extensionProtrusion`, or one
 * not more than zero and less than `stickout`, states no shape here.
 */
const relativeExtensionSilhouette = (
  assembly: Pick<RotatingToolAssembly, 'extension' | 'extensionProtrusion'>,
  stickout: number,
): Silhouette[] => {
  const { extension, extensionProtrusion } = assembly
  if (
    extension === undefined ||
    extensionProtrusion === undefined ||
    !(extensionProtrusion > 0 && extensionProtrusion < stickout)
  ) {
    return []
  }
  const steps: Silhouette[] = []
  let height = -extensionProtrusion
  for (const layer of extension.layers) {
    if (height >= 0) {
      break
    }
    steps.push({
      part: 'extension',
      radius: Math.max(layer.bottomDiameter, layer.topDiameter) / 2,
      fromHeight: height,
    })
    height += layer.thickness
  }
  return steps
}

/**
 * The modular extension's profile between the head and the holder.
 *
 * Each layer at its widest, from where it starts: the first from the
 * extension's head face, `stickout − extensionProtrusion` above the tip, and
 * each above the one before it. A layer that starts at or above the holder face
 * is inside the holder and is not swept. Below the head face nothing of it
 * stands; above it, the tool's shank is inside the extension, and the wider of
 * the two governs, which sweeping both gives.
 *
 * An extension that states no shape sweeps nothing, and so does one whose
 * `extensionProtrusion` is not stated: where it sits is not known. So does one
 * whose `extensionProtrusion` is not more than zero and less than the stickout:
 * a head face at or past the holder face, or at or below the tip, states no
 * place.
 */
export const extensionSilhouette = (
  assembly: Pick<RotatingToolAssembly, 'extension' | 'extensionProtrusion'>,
  stickout: number,
): Silhouette[] =>
  relativeExtensionSilhouette(assembly, stickout).map((step) => ({
    ...step,
    fromHeight: stickout + step.fromHeight,
  }))

/**
 * Whether one assembly clears one feature's reach curve.
 *
 * The holder is checked at the assembly's stickout, and `requiredStickout`
 * says the least stickout at which every part of the holder would clear — so
 * a stack that fails can be read as "stick it out further" rather than "no".
 *
 * A modular extension ({@link extensionSilhouette}) is swept at the stickout
 * and counts toward `requiredStickout`: its length is fixed and it moves with
 * the holder face, so holder, collet and extension clear as one block. The
 * shop meets it with a longer head or a longer extension. With an extension it
 * is never less than `extensionProtrusion` plus the flute length, since the
 * head face cannot sit below the top of the flutes.
 *
 * The tool's `shaft` is swept above the flutes up to the holder face, cut
 * there: what is inside the holder cannot meet the part.
 */
export const clearance = (
  assembly: Pick<
    RotatingToolAssembly,
    'tool' | 'holder' | 'stickout' | 'extension' | 'extensionProtrusion'
  >,
  curve: ReachCurve,
  margins: Margins = NO_MARGINS,
): Clearance => {
  const { tool, stickout } = assembly
  const { diameter, fluteLength } = dimensionsOf(tool)
  const cuttingRadius = diameter / 2
  const body = shaftSteps(tool, sliceAt(tool.shaft ?? [], stickout - fluteLength))
  const steps = [...body, ...extensionSilhouette(assembly, stickout)]

  let requiredStickout: number | null = null
  const atZero = holderSilhouette(assembly, 0)
  if (atZero.length > 0) {
    // What the block needs is the same whatever the stickout: each part of
    // the holder, collet and extension sits a fixed height from the nose
    // face, and has to sit above the material at its own offset. The least
    // stickout is the largest shortfall, and with an extension no less than
    // the one that puts its head face at the top of the flutes.
    const extension = relativeExtensionSilhouette(assembly, stickout)
    const least = extension.length > 0 ? (assembly.extensionProtrusion ?? 0) + fluteLength : 0
    requiredStickout = [...atZero, ...extension].reduce((most, step) => {
      const offset = step.radius + margins.radial - cuttingRadius
      if (offset <= 0) {
        return most
      }
      return Math.max(most, heightAt(curve, offset) + margins.axial - step.fromHeight)
    }, least)
    steps.push(...holderSilhouette(assembly, stickout))
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
    extension: 'the extension',
    collet: 'the collet',
    nose: 'the holder nose',
    body: 'the holder body',
    flange: 'the flange',
  }[collision.part]
  return `${what} at ${collision.height.toFixed(1)} mm collides with material ${collision.needs.toFixed(1)} mm tall, ${collision.offset.toFixed(1)} mm out from the cut`
}
