/**
 * How far a tool stands out of whatever holds it — the one answer.
 *
 * **There used to be four.** The same question was worked out in four
 * unconnected places, and they disagreed by a factor of two on an ordinary
 * tool:
 *
 * | where                             | what it computed              | on a ⌀1 in end mill, `OAL` 5, `LCF` 1.25, `SFDM` 1 |
 * | --------------------------------- | ----------------------------- | -------------------------------------------------- |
 * | the clamping rule → `geometry.LBH` | `OAL − 3×SFDM`                | 2.000 in                                           |
 * | the holding module's `max`         | `OAL − OAL×heldShare`         | 3.333 in                                           |
 * | its `default` → the drawing        | flutes, floored and stepped   | 1.250 in                                           |
 * | the hole-mode reach check          | read `geometry.LBH` as a ceiling | 2.000 in                                        |
 *
 * The details table printed the first and the drawing beside it drew the third,
 * so a dimension line for `LBH` ran up past the holder nose and into the holder
 * body. Neither of the first two consulted the other, and the two knobs behind
 * them — a minimum clamping length (a length of **shank**) and a good hold (a
 * share of the **overall length**) — were combined nowhere.
 *
 * **That bug is the single strongest argument for this package existing.** It
 * was fixed inside one application, which left the next consumer of a tool
 * catalog and a tool drawing to reproduce it from scratch: the quantity is a
 * pure function of the tool, the collet and a shop's policy, and it had no home
 * until this one.
 *
 * So this module owns the quantity outright and every other number is this same
 * function with more arguments:
 *
 * ```
 * geometry.LBH      ≡ stickoutRange(tool).setup                       — no holder, no feature
 * Assembly.stickout ≡ stickoutRange(tool, { grip, required }).setup
 * the ceiling       ≡ stickoutRange(tool, …).max
 * ```
 *
 * `min ≤ setup ≤ max` holds by construction, so a drawn stickout can never
 * exceed the length a table prints beside it. That invariant is a test rather
 * than this sentence.
 *
 * **`LBH` is the setup length, not the ceiling.** The "below holder" column
 * answers what a machinist would set the tool up at; the most it *could* stand
 * out is {@link StickoutRange.max}, which is checked and reported but is not
 * the column. What makes that reading workable is that the floor and the step
 * reach it — {@link DEFAULT_STICKOUT_POLICY} carries `least` and `step`, and an
 * earlier default carried zero for both and so produced the bare flute length.
 */

import { DEFAULT_CLAMPING, clampWanted, type ClampingRule } from './clamping.js'
import type { Geometry } from './geometry.js'
import { hasNeck } from './tool.js'
import type { UnitSystem } from './units.js'

/**
 * What this module needs of a tool: its geometry, and which unit system its
 * step is counted in.
 *
 * Deliberately narrower than a whole {@link Tool} so a build can ask before a
 * tool is finished being built, and so nothing here can reach for a catalog
 * number or a vendor.
 */
export interface StickoutTool {
  readonly geometry: Geometry
  readonly unitSystem: UnitSystem
}

/**
 * The share of a tool's overall length a holder must always have hold of.
 *
 * A third. **A shop's figure, not a vendor's** — no vendor in the scraped
 * catalog publishes a minimum engagement — which is why it is named here and
 * every control that shows it should say whose it is. Deliberately a share of
 * the length and not a multiple of the shank diameter: how much of a tool a
 * collet needs is about the tool's leverage, not its shank. That other reading
 * is {@link ClampingRule}, and both are honoured — see {@link StickoutLimit}.
 */
export const HELD_SHARE = 1 / 3

/**
 * How the setup stickout is set.
 *
 * Nobody sets a tool up 6 mm out, so the stickout stands out at least `least`
 * (half an inch) where the tool's length allows, and lands on a round number —
 * the `step` for the tool's unit system (an eighth of an inch, or 3 mm) nearest
 * what the holder needs, never under it.
 */
export interface StickoutPolicy {
  /** Share of the overall length that must stay in the holder. */
  readonly heldShare: number
  /** The shortest stickout worth setting up, mm; zero for none. */
  readonly least: number
  /**
   * The increment the setup lands on, mm, by the tool's unit system; zero for
   * none.
   *
   * Keyed by {@link UnitSystem} rather than by a pair of its own, so a policy
   * cannot name a system this package does not have.
   */
  readonly step: Readonly<Record<UnitSystem, number>>
}

/** What a dataset is built with, and what a page starts at. */
export const DEFAULT_STICKOUT_POLICY: StickoutPolicy = {
  heldShare: HELD_SHARE,
  least: 12.7,
  step: { inches: 3.175, millimeters: 3 },
}

/**
 * Which rule set the ceiling, so a control can say why rather than showing a
 * number nobody can trace.
 *
 * `clamp` is the shop's clamping length, or the vendor's own `LSCN`; `hold` is
 * {@link HELD_SHARE}; `collet` is the collet's published grip. They used to be
 * a ceiling each in a different file; here they are three caps and the tightest
 * wins.
 */
export type StickoutLimit = 'clamp' | 'hold' | 'collet'

export interface StickoutRange {
  /** Shortest, mm: the flutes out of the collet, or the neck where there is one. */
  readonly min: number
  /**
   * The length to set the tool up at, mm: the least that works for this
   * feature, floored and stepped by the policy, held under {@link max}.
   *
   * This is `geometry.LBH` when asked with no holder and no feature, and an
   * assembly's stickout when asked with both.
   */
  readonly setup: number
  /**
   * Longest, mm: the tightest of the three caps, and never under {@link min} —
   * a tool that cannot meet the rule at any depth is gripped as short as the
   * grip allows and {@link gripShort} says so. Null where the tool states no
   * overall length, which is an unbounded range rather than a bound of nothing.
   */
  readonly max: number | null
  /** Which cap {@link max} came from, or null where nothing capped it. */
  readonly limitedBy: StickoutLimit | null
  /** The parallel shank behind {@link min}, mm: all a holder can ever grip. */
  readonly grip: number | null
  /** How much of the tool the tightest cap asks to keep in the holder, mm. */
  readonly wantedGrip: number | null
  /**
   * True when the rule cannot be met at any depth: the range collapses onto
   * {@link min}, and a control should say why rather than refuse.
   */
  readonly gripShort: boolean
}

export interface StickoutRequest {
  /**
   * How much shank the holder actually grips, mm — a collet's published grip
   * length. Null where the vendor does not publish one, which REGO-FIX's
   * powRgrip line does not, and null for a bore or shrink holder, whose grip
   * this package does not carry.
   *
   * **A length rather than a {@link Collet}**, so this module depends on
   * nothing in `holding.ts` and the two cannot form a cycle. `stickoutLimits`
   * there is the collet-shaped way in.
   */
  readonly grip?: number | null
  /** What the holder needs to clear the part, mm, from the sweep. */
  readonly required?: number | null
  /** What the shop keeps clamped. */
  readonly rule?: ClampingRule
  /** The floor, step and hold share. */
  readonly policy?: StickoutPolicy
}

const round = (value: number) => Math.round(value * 100) / 100

/** A hair, so a rounded stickout a femtometre under what is needed is not stepped up. */
const STICKOUT_TOLERANCE = 1e-6

/**
 * The least a tool can stand out: its flutes, or its neck where it has one.
 *
 * The collet face sits at the end of the flutes, and a stated neck — which a
 * collet must not close on — pushes it back to the shoulder. A tool that states
 * no flute length has no known head, so it has no known stickout at all and
 * this answers `null`; it carries no `LBH` either, rather than one derived from
 * `OAL` and `SFDM` alone.
 */
export const minStickout = (tool: StickoutTool): number | null => {
  const { LCF } = tool.geometry
  if (LCF === undefined) {
    return null
  }
  const shoulder = tool.geometry['shoulder-length']
  return hasNeck(tool) && shoulder !== undefined ? shoulder : LCF
}

/**
 * The setup length before the ceiling: what is needed, no shorter than the
 * policy's least, on the policy's step for this tool — the nearest step, or the
 * one above it where the nearest falls short of what is needed.
 */
const steppedTo = (tool: StickoutTool, needed: number, policy: StickoutPolicy): number => {
  const step = policy.step[tool.unitSystem]
  const preferred = Math.max(needed, policy.least)
  if (step <= 0) {
    return preferred
  }
  const nearest = Math.round(preferred / step) * step
  return nearest + STICKOUT_TOLERANCE < needed ? nearest + step : nearest
}

/**
 * Every stickout this tool has, in one answer.
 *
 * `null` only when the tool states no flute length, because then nothing about
 * where it stands out of a holder can be worked out at all.
 */
export const stickoutRange = (
  tool: StickoutTool,
  request: StickoutRequest = {},
): StickoutRange | null => {
  const min = minStickout(tool)
  if (min === null) {
    return null
  }
  const {
    grip = null,
    required = null,
    rule = DEFAULT_CLAMPING,
    policy = DEFAULT_STICKOUT_POLICY,
  } = request
  const { OAL } = tool.geometry

  /**
   * The three ways of saying "this much stays in the holder", as three caps on
   * one number. The tightest wins and says its name — which is the whole point
   * of the module: a shop's sheet carries a minimum clamping length and a good
   * hold as separate knobs, and before this they capped separate numbers in
   * separate files and nothing ever compared them.
   */
  const caps: Array<{ readonly by: StickoutLimit; readonly at: number }> = []
  if (OAL !== undefined) {
    const clamp = clampWanted(tool.geometry, rule)
    if (clamp !== null) {
      caps.push({ by: 'clamp', at: OAL - clamp })
    }
    if (policy.heldShare > 0) {
      caps.push({ by: 'hold', at: OAL * (1 - policy.heldShare) })
    }
    if (grip !== null) {
      caps.push({ by: 'collet', at: OAL - grip })
    }
  }

  const tightest = caps.reduce<{ readonly by: StickoutLimit; readonly at: number } | null>(
    (best, cap) => (best === null || cap.at < best.at ? cap : best),
    null,
  )
  const gripShort = tightest !== null && tightest.at < min
  const max = tightest === null ? null : round(gripShort ? min : tightest.at)

  const wanted = steppedTo(tool, Math.max(min, required ?? min), policy)
  return {
    min: round(min),
    setup: round(max === null ? wanted : Math.min(wanted, max)),
    max,
    limitedBy: tightest?.by ?? null,
    grip: OAL === undefined ? null : round(Math.max(0, OAL - min)),
    wantedGrip: OAL === undefined || tightest === null ? null : round(OAL - tightest.at),
    gripShort,
  }
}

/**
 * What this tool would be set up at on its own: no holder chosen and no feature
 * to reach. This is `geometry.LBH`, and a build writes it with exactly this
 * call.
 */
export const setupStickout = (
  tool: StickoutTool,
  rule: ClampingRule = DEFAULT_CLAMPING,
  policy: StickoutPolicy = DEFAULT_STICKOUT_POLICY,
): number | null => stickoutRange(tool, { rule, policy })?.setup ?? null

/**
 * The furthest this tool can ever stand out of a holder, mm.
 *
 * **A reach check's number, not `LBH`.** A tap that will not reach the bottom of
 * a hole at its setup length may reach it pulled further out, and asking `LBH` —
 * which is the setup — would refuse it. Anything asking "could this tool get
 * down there at all" asks this.
 */
export const stickoutCeiling = (
  tool: StickoutTool,
  rule: ClampingRule = DEFAULT_CLAMPING,
  policy: StickoutPolicy = DEFAULT_STICKOUT_POLICY,
): number | null => stickoutRange(tool, { rule, policy })?.max ?? null
