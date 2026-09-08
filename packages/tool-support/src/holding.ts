/**
 * What holds a tool, and the stack the two make together.
 *
 * ## The holder is a union, not one shape with optional extras
 *
 * A holder arrives in one of two forms and they are alternatives rather than a
 * refinement of one by the other: {@link Holder} is what a vendor *publishes*
 * about it, and {@link HolderProfile} is what its own CAD model *measures*.
 * {@link isHolderProfile} tells them apart. A consumer that has both picks one;
 * a consumer that has neither passes `null` and the tool stands alone.
 *
 * ## What is here and what is not
 *
 * Three shapes in this tree called themselves a holder and no two agreed on
 * which fields exist — sixteen, nine and nineteen. What they *did* agree on is
 * the geometry below, which is also exactly what a drawing and a clearance
 * sweep read. Identity and commerce — a guid, a brand, a catalog number, the
 * vendor's own CAD download — belong to a catalog's record, which extends this.
 *
 * ## How a holder grips is optional, and the absence is load bearing
 *
 * {@link Holder.clamping}, {@link Holder.boreDiameter} and {@link Holder.taper}
 * arrived with the functions that read them, and they are optional because a
 * drawing has never needed them: a consumer that hands over nine numbers to get
 * a picture must not have to invent a clamping mode to do it.
 *
 * **Absent means nobody has said, and nobody-has-said refuses.** A holder that
 * does not state how it clamps takes no tool, offers no grip range and matches
 * no taper. That is the same rule {@link holderTakesTool} applies to a tool
 * with no stated shank, and for the same reason: the unchecked case here is a
 * cutter falling out of a spindle.
 */

import type { HolderProfile } from './profile.js'
import type { ProvenanceMap } from './provenance.js'
import type { Tool } from './tool.js'
import {
  DEFAULT_STICKOUT_POLICY,
  stickoutRange,
  type StickoutPolicy,
  type StickoutRange,
  type StickoutTool,
} from './stickout.js'
import { DEFAULT_CLAMPING, type ClampingRule } from './clamping.js'
import { isTapForm } from './forms.js'

/**
 * How a holder grips what it holds.
 *
 * `hydraulic` is here rather than folded into `bore` because vendors classify
 * parts as hydraulic outright, and folding it in would be this package
 * reclassifying a family its vendor already named.
 */
export type Clamping = 'bore' | 'collet' | 'shrink' | 'hydraulic'

/**
 * What goes in the spindle, as its vendor publishes it.
 *
 * Every field is nullable because a DIN 4000 sheet is not a promise: each is
 * `null` where the vendor states nothing, and nothing is drawn or swept for it
 * then. An absent number is not a zero — a holder with no stated body diameter
 * is not a holder with no body.
 */
export interface Holder {
  /** The nose, where a holder fouls the part before the tool runs out of reach. */
  readonly noseDiameter: number | null
  readonly noseLength: number | null
  /** The body behind the nose, where the vendor states it step by step. */
  readonly bodyDiameter: number | null
  readonly bodyLength: number | null
  /** Nose face to flange face, in millimetres. */
  readonly projection: number | null
  readonly flangeDiameter: number | null
  /**
   * Spindle face to holder nose, in millimetres.
   *
   * Not the same as reach: what sticks out past the nose is the tool's, and
   * that is the number a feature depth is measured against.
   */
  readonly gaugeLength: number | null
  /** For a collet holder: which collet series it takes — `ER16`, `PG10`. */
  readonly colletSeries: string | null
  /**
   * How the holder grips: through a collet, a bore, a shrink fit or hydraulic
   * pressure.
   *
   * A shrink-fit holder and a hydraulic chuck grip the shank directly, the same
   * way a bore does, and they stay apart because the distinction is one a buyer
   * makes — a shrink fit needs an induction heater on the bench and a hydraulic
   * chuck an actuation screw — and because a vendor states which it published.
   */
  readonly clamping?: Clamping
  /**
   * For a bore, shrink or hydraulic holder: the one shank diameter it takes, in
   * millimetres.
   *
   * **One diameter, not an upper bound.** A shrink-fit holder bored for 12 mm
   * does not hold a 10 mm shank at all, and treating it as a maximum would put
   * a tool in a holder that drops it.
   */
  readonly boreDiameter?: number | null
  /** The spindle interface — `BT30`. A holder only fits the machine that takes it. */
  readonly taper?: string | null
  /**
   * How far the seated collet stands proud of the nose face, in millimetres.
   *
   * A powRgrip collet is pressed in and its front protrudes; the tool sees the
   * collet's own diameter for that much before the nose.
   */
  readonly colletProtrusion: number | null
  readonly provenance?: ProvenanceMap
}

/**
 * Which of the two holder forms this is.
 *
 * On the presence of `points` rather than on a `kind` tag, because a tag would
 * have to be added to {@link Holder} as well and every existing adapter would
 * stop compiling to gain nothing a structural check does not already give.
 */
export const isHolderProfile = (holder: Holder | HolderProfile): holder is HolderProfile =>
  'points' in holder

/**
 * What grips the shank inside a collet holder.
 *
 * As with {@link Holder}, this is the gripping and nothing else. `series` has to
 * equal the holder's exactly — a series is a mechanical interface, not a size
 * class, and an `ER16` collet does not go in an `ER20` nose.
 */
export interface Collet {
  /** `ER16`, `PG10` — must equal the holder's series exactly. */
  readonly series: string
  /** The shank diameters it grips, in millimetres. */
  readonly clampMin: number
  readonly clampMax: number
  /**
   * How much shank the collet actually holds, in millimetres.
   *
   * `null` where the vendor does not publish it, and that absence is load
   * bearing: without it there is no honest maximum stickout, and the answer has
   * to be "nobody has said" rather than an invented grip rule.
   */
  readonly clampLength: number | null
  /**
   * The square drive this collet grips, across flats, in millimetres.
   *
   * A tap collet's bore is not round: it carries a square that drives the tap,
   * so the part it takes is a tap and nothing else. `null` — and absent — is
   * "nobody has said", which is every collet whose vendor publishes no square,
   * and those go on taking anything their capacity band fits.
   *
   * Optional rather than required because {@link Collet} is a shape consumers
   * build, and a collet crib assembled before this existed states the same
   * thing by saying nothing.
   */
  readonly squareSize?: number | null
  readonly provenance?: ProvenanceMap
}

/**
 * A tool, what holds it, and how far it stands out.
 *
 * **The whole reason this package exists is that `stickout` cannot be a bare
 * number a caller worked out on its own.** How far a tool stands out of its
 * holder is a pure function of the tool, the collet and a shop's policy, and
 * before this it had no home: it was computed in four unconnected places, they
 * disagreed by a factor of two on an ordinary tool, and the details table
 * printed one number while the drawing beside it drew another.
 *
 * The arithmetic that resolves it — the clamping rule, the hold share, the
 * collet's cap — is {@link stickoutRange}, and {@link stickoutLimits} is the
 * collet-shaped way into it. A consumer that has already chosen a stickout
 * passes the one it holds; a consumer that has not asks for it here rather than
 * working out a fifth answer of its own.
 */
export interface Assembly {
  readonly tool: Tool
  readonly holder: Holder | HolderProfile | null
  /** Null for a bore or shrink holder, which grips the shank directly, and for no holder at all. */
  readonly collet: Collet | null
  /**
   * Tool tip to holder nose, in millimetres — the reach of the stack, as set.
   *
   * `null` draws the tool alone and checks nothing against a part: it is "nobody
   * has decided", not zero.
   */
  readonly stickout: number | null
}

/**
 * A collet fits a holder when the holder takes collets of exactly its series.
 *
 * A series is a mechanical interface and not a size class: an `ER16` collet
 * does not go in an `ER20` nose.
 */
export const colletFitsHolder = (
  collet: Pick<Collet, 'series'>,
  holder: Pick<Holder, 'clamping' | 'colletSeries'>,
): boolean => holder.clamping === 'collet' && holder.colletSeries === collet.series

/**
 * A hair of tolerance, because 3/8" is 9.525 on the collet's sheet and
 * 9.524999999999999 on the tool's after a conversion. Strict, 350 tools in the
 * scraped catalog had no collet in the crib.
 */
const GRIP_TOLERANCE = 1e-6

/** Whether a collet grips a given shank diameter, in millimetres. */
export const gripsShank = (collet: Pick<Collet, 'clampMin' | 'clampMax'>, shank: number): boolean =>
  shank >= collet.clampMin - GRIP_TOLERANCE && shank <= collet.clampMax + GRIP_TOLERANCE

/**
 * Whether the collet's drive suits the tool, which is a second question from
 * whether it grips the shank.
 *
 * A tap collet's square holds one shank diameter exactly, so a shank test alone
 * says yes to an end mill of that size — and an end mill in a square bore is
 * held by nothing. The square is the vendor's own published dimension, so a
 * collet that states one takes a tap and a collet that states none is unchanged.
 *
 * The converse is deliberately **not** enforced: a tap in a plain round collet
 * is how most shops tap, and refusing it would be this package inventing a
 * policy no vendor stated.
 */
const driveTakesTool = (
  collet: Pick<Collet, 'squareSize'>,
  tool: Partial<Pick<Tool, 'form'>>,
): boolean => {
  const square = collet.squareSize
  if (square === null || square === undefined) return true
  // An unstated form is nobody having said, and nobody-has-said does not go in
  // a square bore — the same direction an unstated shank is refused in.
  return tool.form !== undefined && isTapForm(tool.form)
}

/**
 * Whether a bore, shrink or hydraulic holder's one diameter is this shank.
 *
 * The same hair of tolerance {@link gripsShank} carries, for the same reason: a
 * ½" bore is 12.7 on the holder's sheet and 12.699999999999999 on the tool's
 * after a conversion. Exact, an inch holder matches an inch tool only by luck.
 */
const boreTakesShank = (bore: number, shank: number): boolean =>
  Math.abs(bore - shank) <= GRIP_TOLERANCE

/**
 * Whether a holder takes this tool's shank, with the collet if it needs one.
 *
 * **A tool whose shank the vendor does not state is refused, not assumed to
 * fit.** This is the one place the domain differs from "what is not stated is
 * not checked", because here the unchecked case is a cutter falling out of a
 * spindle.
 *
 * `form` is read only by {@link Collet.squareSize}'s gate and is optional for
 * that reason: a caller with no form in hand keeps the answer it had for every
 * collet whose vendor publishes no square, which is all of them but the tap
 * collets.
 */
export const holderTakesTool = (
  holder: Pick<Holder, 'clamping' | 'colletSeries' | 'boreDiameter'>,
  collet: Collet | null,
  tool: Pick<Tool, 'geometry'> & Partial<Pick<Tool, 'form'>>,
): boolean => {
  const shank = tool.geometry.SFDM
  if (shank === undefined) {
    return false
  }

  if (holder.clamping === 'collet') {
    return (
      collet !== null &&
      colletFitsHolder(collet, holder) &&
      gripsShank(collet, shank) &&
      driveTakesTool(collet, tool)
    )
  }
  // A holder that states no clamping mode falls here and is refused: absent
  // means nobody has said, and nobody-has-said takes no tool.
  if (collet !== null || holder.boreDiameter === null || holder.boreDiameter === undefined) {
    return false
  }
  return boreTakesShank(holder.boreDiameter, shank)
}

/**
 * The furthest a tool can stand out of its holder, in millimetres: overall
 * length less the length that has to stay gripped.
 *
 * `null` when either is unstated. A maximum stickout is exactly the number
 * somebody would use to decide a deep pocket is reachable, and a guessed one is
 * worse than an absent one. A bore or shrink holder's grip length is the
 * holder's rather than a collet's, and this package does not carry it — so
 * those answer `null` too, honestly, until the contract gains it.
 */
export const maxStickout = (
  tool: Pick<Tool, 'geometry'>,
  collet: Pick<Collet, 'clampLength'> | null,
): number | null => {
  const overall = tool.geometry.OAL
  if (overall === undefined || collet === null || collet.clampLength === null) {
    return null
  }
  const stickout = overall - collet.clampLength
  return stickout > 0 ? stickout : null
}

export type HoldBand = 'good' | 'medium' | 'bad'

/**
 * How well the holder has hold of the tool at this stickout, by the share of
 * the overall length left in the holder.
 *
 * At or above `good` is good; between `least` and that is possible but bad;
 * below `least` is not compatible. The thresholds are a shop's, handed in as
 * fractions rather than named here, because they are the same knob
 * {@link StickoutPolicy.heldShare} is and a package must not carry two.
 */
export const holdBand = (
  tool: Pick<Tool, 'geometry'>,
  stickout: number,
  thresholds: { readonly good: number; readonly least: number },
): HoldBand | null => {
  const { OAL } = tool.geometry
  if (OAL === undefined || OAL <= 0) {
    return null
  }
  const held = (OAL - stickout) / OAL
  return held >= thresholds.good - 1e-9
    ? 'good'
    : held >= thresholds.least - 1e-9
      ? 'medium'
      : 'bad'
}

/**
 * How far this tool may stand out of this holder — the collet-shaped way into
 * {@link stickoutRange}.
 *
 * **The arithmetic is not here.** This was one of the four places that worked
 * out a stickout, and the one that capped at a share of the overall length
 * while the clamping rule capped at a length of shank and neither knew about
 * the other. `stickout.ts` owns the quantity and combines the two knobs in one
 * place; this maps a collet onto the grip length that module asks for, which is
 * all a collet was ever contributing.
 */
export const stickoutLimits = (
  tool: StickoutTool,
  collet: Pick<Collet, 'clampLength'> | null,
  /** What the holder needs to clear the part, from the sweep: the setup stands out at least this far. */
  required: number | null = null,
  policy: StickoutPolicy = DEFAULT_STICKOUT_POLICY,
  rule: ClampingRule = DEFAULT_CLAMPING,
): StickoutRange | null =>
  stickoutRange(tool, { grip: collet?.clampLength ?? null, required, policy, rule })

/**
 * The stickout an assembly starts at: the setup length for this tool, held
 * within what the grip allows.
 *
 * A tool whose setup outruns its grip is gripped as short as the grip lets it
 * and no shorter — rather than refused, because the shop is the one who knows
 * whether that is a problem.
 */
export const defaultStickout = (
  tool: StickoutTool & Pick<Tool, 'geometry'>,
  collet: Pick<Collet, 'clampLength'> | null,
): number | null => stickoutLimits(tool, collet)?.setup ?? maxStickout(tool, collet)

/**
 * The shank diameters a crib can grip, given what it is asked to hold with.
 *
 * Every rule above reduces to one number — the shank — so "can anything here
 * hold this tool" is a question about a set of diameters. Working that set out
 * once and asking it per tool is what makes holding usable as a filter: asked
 * tool by tool it is holders × collets × tools, which on a real catalog is tens
 * of millions of comparisons per keystroke.
 */
export interface GripRanges {
  /** Closed intervals a collet grips, in millimetres. */
  readonly spans: ReadonlyArray<readonly [number, number]>
  /** Exact diameters a bore or shrink holder takes. */
  readonly bores: ReadonlyArray<number>
}

/** `taper` narrows to one spindle interface, `colletSeries` to one collet family; either left out means "any". */
export const gripRanges = (
  holders: readonly Pick<Holder, 'clamping' | 'colletSeries' | 'boreDiameter' | 'taper'>[],
  collets: readonly Collet[],
  want: { readonly taper?: string | null; readonly colletSeries?: string | null } = {},
): GripRanges => {
  const spans: Array<readonly [number, number]> = []
  const bores: Array<number> = []

  for (const holder of holders) {
    if (want.taper && holder.taper !== want.taper) {
      continue
    }

    if (holder.clamping === 'collet') {
      for (const collet of collets) {
        if (want.colletSeries && collet.series !== want.colletSeries) {
          continue
        }
        if (!colletFitsHolder(collet, holder)) {
          continue
        }
        spans.push([collet.clampMin, collet.clampMax])
      }
      continue
    }

    // A bore or shrink holder takes one nominal diameter, so it can never
    // satisfy a request for a particular collet series.
    if (want.colletSeries) {
      continue
    }
    if (holder.boreDiameter !== null && holder.boreDiameter !== undefined) {
      bores.push(holder.boreDiameter)
    }
  }

  return { spans, bores }
}

/**
 * Whether anything in {@link gripRanges} holds this shank, in millimetres.
 *
 * **Through {@link gripsShank} and {@link boreTakesShank}, not a second
 * comparison.** This is the fast filter and `holderTakesTool` is the exact
 * check, and the two must agree: asked strictly, a ⅜" shank that converts to
 * 9.524999999999999 misses a collet whose sheet says 9.525, so the crib reports
 * no holder for a tool the holder plainly takes. That is the failure the
 * tolerance above was introduced for, and it belongs on both paths.
 */
export const gripsAnyShank = (ranges: GripRanges, shank: number): boolean =>
  ranges.spans.some(([clampMin, clampMax]) => gripsShank({ clampMin, clampMax }, shank)) ||
  ranges.bores.some((bore) => boreTakesShank(bore, shank))

/**
 * Whether the crib can hold this tool at all.
 *
 * A tool whose shank the vendor does not state is refused, for the same reason
 * {@link holderTakesTool} refuses it.
 */
export const canHold = (ranges: GripRanges, tool: Pick<Tool, 'geometry'>): boolean => {
  const shank = tool.geometry.SFDM
  return shank !== undefined && gripsAnyShank(ranges, shank)
}
