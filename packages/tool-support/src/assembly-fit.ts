import { clearance, describeCollision, type SweptAssembly } from './clearance.js'
import type { FeatureDemand } from './demand.js'
import { fitAgainst, type FitFailure } from './fit.js'

/**
 * Whether the whole stack reaches, not just the cutter.
 *
 * `fit.ts` answers "could this cutter cut this feature". This answers the
 * question a shop actually acts on: **is there a way to hold it that reaches**.
 * The two are different often enough to matter — a 3 mm end mill with 20 mm of
 * flute clears a 15 mm pocket on its own, and fails the moment the only collet
 * that grips a 3 mm shank leaves 12 mm standing out of the holder.
 *
 * This is deliberately thin, and everything it does not model is named in
 * {@link NOT_MODELLED} rather than left for somebody to discover.
 */

/**
 * One way of holding a tool, and whether it cuts what was asked.
 *
 * Generic in the assembly so a catalog's own richer record — with its guid, its
 * holder's catalog number and its published maximum stickout — comes back
 * intact rather than as a projection of itself.
 */
export interface AssemblyFit<A extends SweptAssembly = SweptAssembly> {
  readonly assembly: A
  readonly fits: boolean
  readonly failures: readonly FitFailure[]
}

/**
 * What an assembly check does **not** answer yet, stated so nobody reads a
 * pass as more than it is.
 *
 * - **Holder collision, on a report without a reach curve.** From Engine API
 *   1.0.4 every datasheet carries one and `clearance.ts` sweeps the nose and
 *   the shank over it; an older report is not checked rather than guessed. The
 *   silhouette swept is the catalog's — nose diameter, shank, neck — not a
 *   holder's CAD.
 * - **Deflection.** Reach is geometry; whether a stack at that reach can take
 *   a cut is rigidity, and this package has no force model.
 * - **A bore holder's grip length**, which is why those assemblies use the
 *   whole tool as their stickout and are an upper bound rather than a fact.
 * - **Reach, on an assembly whose collet publishes no grip length.** REGO-FIX's
 *   powRgrip collets do not, so those assemblies carry no stickout and their
 *   reach goes unchecked rather than guessed.
 */
export const NOT_MODELLED = [
  'holder collision without a reach curve',
  'deflection',
  'bore holder grip',
  'reach without a published collet grip',
] as const

/**
 * Whether one assembly clears one feature.
 *
 * The cutter's own checks run first and unchanged — an assembly cannot rescue a
 * tool that is too wide. What it adds is reach: the stickout has to clear the
 * whole distance from the part top to the bottom of the feature, because the
 * holder nose cannot go below the top of the part.
 */
export const assemblyAgainst = (assembly: SweptAssembly, demand: FeatureDemand): FitFailure[] => {
  const failures = [...fitAgainst(assembly.tool, demand)]

  // An unstated stickout is not checked, the same rule the cutter checks
  // follow: what nobody has said is not a limit anybody can be held to.
  if (
    assembly.stickout !== null &&
    demand.reachBelowTop !== undefined &&
    assembly.stickout < demand.reachBelowTop
  ) {
    failures.push({
      featureTag: demand.featureTag,
      reason: `${assembly.stickout.toFixed(1)} mm of stickout does not clear ${demand.reachBelowTop.toFixed(1)} mm below the part top`,
    })
  }

  // The material around the feature, where the report states it: the holder
  // nose and the shank are swept over the reach curve, and each thing they
  // meet is its own reason.
  if (demand.reachCurve) {
    for (const collision of clearance(assembly, demand.reachCurve).collisions) {
      failures.push({ featureTag: demand.featureTag, reason: describeCollision(collision) })
    }
  }

  return failures
}
