/**
 * What holds a tool, and what that decides.
 *
 * The {@link Holder}, {@link Collet} and `RotatingToolAssembly` are
 * `model.ts`'s; a holder's shape is its cone stack, made by `holder.ts`. This
 * is the gripping: which collet goes in which holder, which shank either takes,
 * and how far the tool can then stand out.
 *
 * ## How a holder grips is optional, and the absence is load bearing
 *
 * `clamping`, `boreDiameter` and `taper` are optional because a drawing has
 * never needed them: a consumer that hands over a shape to get a picture must
 * not have to invent a clamping mode to do it.
 *
 * **Absent means nobody has said, and nobody-has-said refuses.** A holder that
 * does not state how it clamps takes no tool, offers no grip range and matches
 * no taper. That is the same rule {@link holderTakesTool} applies to a tool
 * with no stated shank, and for the same reason: the unchecked case here is a
 * cutter falling out of a spindle.
 */

import { DEFAULT_CLAMPING, type ClampingRule } from './clamping.js'
import { isTapKind } from './kinds.js'
import type {
  Clamping,
  Collet,
  CuttingTool,
  Extension,
  Holder,
  RotatingToolAssembly,
  ShankForm,
} from './model.js'
import { optional } from './optional.js'
import {
  DEFAULT_STICKOUT_POLICY,
  stickoutRange,
  type StickoutPolicy,
  type StickoutRange,
} from './stickout.js'
import { extensionShank, statedOverallLength, statedShank } from './stack.js'
import { MM_PER_INCH } from './units.js'

/**
 * How far outside its published band a shank may sit and still be gripped.
 *
 * It began at `1e-6`, to absorb a conversion's last bit: 3/8" is 9.525 on the
 * collet's sheet and 9.524999999999999 on the tool's, and strict, 350 tools in
 * the scraped catalog had no collet in the crib. **That is the wrong order of
 * magnitude for what these numbers actually are.** A clamping band is not a
 * measurement this package computed; it is a figure a vendor printed to three
 * or four decimal places, and float error is the smallest thing separating two
 * such figures.
 *
 * ## The rows that proved it
 *
 * Four of the 764 collets in the scraped catalog refuse the size they are
 * *named for*, and every one of them is a printing artifact rather than a
 * vendor statement:
 *
 * - Kennametal `25ER0312`, a 5/16 in ER25, prints `CCCX` as `0.312` in and
 *   `7.938` mm **in the same row**. 7.938 mm is 0.3125 in exactly, so the inch
 *   cell is that value at three places and the band stops 0.0127 mm below the
 *   5/16 shank it is sold for.
 * - `32ERSS0281`, `32ERSS0406` and `32ERSS0719` print the nominal and the band
 *   as the same four-decimal inch value rounded in opposite directions —
 *   0.2812 against 0.2813 for one 9/32 collet — and miss by 0.00254 mm.
 *
 * ## Why this number
 *
 * One thousandth of an inch: the coarsest last place these catalogs print, so
 * it is the width of the artifact rather than a figure picked to clear it. The
 * corridor either side is wide and the check is that it stays wide. The largest
 * artifact above is 0.0127 mm, which this sits 2x above; the smallest *genuine*
 * undersize it must still refuse is `40ERSS0312` at 0.0635 mm — a sealed ER40
 * collet whose vendor states a 7.874 mm capacity against a 5/16 in name, in
 * both unit columns — which this sits 2.5x below. All ten of those sealed ER40
 * rows stay refused, which is right: the vendor means them.
 *
 * Mechanically it is nothing. An ER collet closes about a millimetre, so a
 * thousandth of an inch of interference is the collet ending fractionally less
 * closed than the sheet implies.
 *
 * **Not fixed upstream in `@toolpath/tool-scraper`, deliberately.** A record
 * carries the vendor's own figure at the vendor's own precision, and the
 * millimetre twin is derived from the native column so that the pair cannot
 * state two sizes. Reaching into the other unit column to recover the finer
 * cell would trade that guarantee for one row, and would still leave the three
 * `32ERSS` rows, whose columns disagree in the last digit in *both* systems.
 * Precision the vendor did not print is not recoverable there; it is absorbed
 * here, once, where the comparison happens.
 */
const GRIP_TOLERANCE = MM_PER_INCH / 1000

/**
 * Whether a holder's one diameter is this one: a shank in its bore, or a
 * sleeve's outside.
 *
 * The same hair of tolerance {@link gripsShank} carries, for the same reason: a
 * ½" bore is 12.7 on the holder's sheet and 12.699999999999999 on the tool's
 * after a conversion. Exact, an inch holder matches an inch tool only by luck.
 */
const boreTakesShank = (bore: number, shank: number): boolean =>
  Math.abs(bore - shank) <= GRIP_TOLERANCE

/**
 * The shank forms each clamping that grips in a bore of its own takes. `bore`
 * is the generic, where the source does not say which, and takes any form.
 */
const BORE_GRIPS: Readonly<Partial<Record<Clamping, ReadonlyArray<ShankForm> | null>>> = {
  bore: null,
  'shrink-fit': ['plain'],
  hydraulic: ['plain', 'weldon'],
  'side-lock': ['weldon', 'whistle-notch'],
  'milling-chuck': ['plain', 'weldon'],
}

/**
 * The shank forms a reduction sleeve takes, whatever bore it is in: the sleeve
 * grips the shank, not the holder, so the holder's own rule does not apply.
 */
const SLEEVE_GRIPS: ReadonlyArray<ShankForm> = ['plain', 'weldon']

/** The bores a reduction sleeve goes in: not a shrink fit's, which grips the shank itself. */
const SLEEVE_HOLDERS: ReadonlySet<Clamping | undefined> = new Set<Clamping>([
  'bore',
  'hydraulic',
  'side-lock',
  'milling-chuck',
])

const isBoreClamping = (clamping: Clamping | undefined): boolean =>
  clamping !== undefined && Object.hasOwn(BORE_GRIPS, clamping)

/**
 * Whether a grip takes this shank form: `null` takes any. A shank that states
 * no form is taken, as it was before the record carried one.
 */
const gripsForm = (forms: ReadonlyArray<ShankForm> | null, form: ShankForm | undefined): boolean =>
  form === undefined || forms === null || forms.includes(form)

/** The shank a collet or a bore clamps: its diameter, mm, and its form where stated. */
export interface ClampedShank {
  readonly diameter: number
  readonly form?: ShankForm
}

/**
 * The shank the holder clamps: a modular extension's, where the head is
 * screwed onto one, else the tool's own, each the top of its stack. `null`
 * where the one clamped states no shape, which nothing holds. A tool whose
 * shank is assumed ({@link statedShank}) states no shank either: it is a
 * reader's guess, and a guessed shank is not held.
 */
export const clampedShank = ({
  tool,
  extension,
}: Pick<RotatingToolAssembly, 'tool'> & {
  readonly extension?: Extension | undefined
}): ClampedShank | null => {
  const [diameter, form] =
    extension === undefined
      ? [statedShank(tool), tool.type === 'solid' ? tool.shankForm : undefined]
      : [extensionShank(extension), extension.shankForm]
  return diameter === null ? null : { diameter, ...optional('form', form) }
}

/**
 * A collet fits a holder when the holder takes collets of exactly its series,
 * and a sleeve when the holder's bore is the sleeve's outside.
 *
 * A series is a mechanical interface and not a size class: an `ER16` collet
 * does not go in an `ER20` nose. A sleeve goes in a bore, hydraulic, side-lock
 * or milling chuck bored to its `outerDiameter`, whatever series the holder
 * names; one that states no outside fits nothing.
 */
export const colletFitsHolder = (
  collet: Pick<Collet, 'series' | 'kind' | 'outerDiameter'>,
  holder: Pick<Holder, 'clamping' | 'colletSeries' | 'boreDiameter'>,
): boolean => {
  if (collet.kind === 'sleeve') {
    return (
      SLEEVE_HOLDERS.has(holder.clamping) &&
      holder.boreDiameter !== undefined &&
      collet.outerDiameter !== undefined &&
      boreTakesShank(holder.boreDiameter, collet.outerDiameter)
    )
  }
  return holder.clamping === 'collet' && holder.colletSeries === collet.series
}

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
 * collet that states one takes a tap, and so does one whose `kind` is `tap`
 * where the square is not published; a collet that states neither is unchanged.
 *
 * The converse is deliberately **not** enforced: a tap in a plain round collet
 * is how most shops tap, and refusing it would be this package inventing a
 * policy no vendor stated.
 */
const driveTakesTool = (collet: Pick<Collet, 'squareSize' | 'kind'>, tool: CuttingTool): boolean =>
  (collet.squareSize === undefined && collet.kind !== 'tap') || isTapKind(tool.kind)

/**
 * Whether a holder takes this tool's shank, with the collet if it needs one.
 *
 * **A tool whose shank the vendor does not state is refused, not assumed to
 * fit.** This is the one place the domain differs from "what is not stated is
 * not checked", because here the unchecked case is a cutter falling out of a
 * spindle.
 *
 * A tap collet's square drive (`squareSize`, or `kind: 'tap'`) takes a tap and
 * nothing else; a collet that states neither takes anything its capacity band
 * fits.
 *
 * A holder that grips in its own bore takes the one shank its bore is, in a
 * form its clamping grips; or, through a sleeve that fits the bore, any shank
 * the sleeve clamps, in a form the sleeve grips — the holder's form rule is
 * then not the one that applies. A form is checked only where it is stated.
 *
 * A head screwed onto a modular `extension` is held by the extension's shank
 * ({@link clampedShank}), not its own.
 */
export const holderTakesTool = (
  holder: Pick<Holder, 'clamping' | 'colletSeries' | 'boreDiameter'>,
  collet: Collet | null,
  tool: CuttingTool,
  extension?: Extension,
): boolean => {
  const shank = clampedShank({ tool, extension })
  if (shank === null) {
    return false
  }
  const throughCollet = (held: Collet) =>
    colletFitsHolder(held, holder) && gripsShank(held, shank.diameter) && driveTakesTool(held, tool)

  if (holder.clamping === 'collet') {
    return collet !== null && throughCollet(collet)
  }
  // A holder that states no clamping mode falls here and is refused: absent
  // means nobody has said, and nobody-has-said takes no tool.
  if (holder.clamping === undefined || holder.boreDiameter === undefined) {
    return false
  }
  const forms = BORE_GRIPS[holder.clamping]
  if (forms === undefined) {
    return false
  }
  return collet === null
    ? gripsForm(forms, shank.form) && boreTakesShank(holder.boreDiameter, shank.diameter)
    : gripsForm(SLEEVE_GRIPS, shank.form) && throughCollet(collet)
}

/**
 * The furthest a tool can stand out of its holder, in millimetres: overall
 * length less the length that has to stay gripped.
 *
 * `null` when either is unstated. A maximum stickout is exactly the number
 * somebody would use to decide a deep pocket is reachable, and a guessed one is
 * worse than an absent one. A holder that grips in its own bore grips its own
 * `clampLength`, so it is handed over in the collet's place ({@link Grip}).
 */
export const maxStickout = (tool: CuttingTool, grip: Grip | null): number | null => {
  const overall = statedOverallLength(tool)
  const length = gripLength(grip)
  if (overall === null || length === null) {
    return null
  }
  const stickout = overall - length
  return stickout > 0 ? stickout : null
}

/**
 * What grips the shank: the collet, or a holder that grips in its own bore —
 * with no collet in it, since a sleeve's grip is the sleeve's.
 */
export type Grip = Collet | Holder

/**
 * The length of shank a grip holds, mm, or null where it is unpublished. A
 * collet holder's own `clampLength` is its nose, not its grip, and reads null.
 */
const gripLength = (grip: Grip | null): number | null =>
  grip === null || ('layers' in grip && grip.clamping === 'collet')
    ? null
    : (grip.clampLength ?? null)

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
  tool: CuttingTool,
  stickout: number,
  thresholds: { readonly good: number; readonly least: number },
): HoldBand | null => {
  const OAL = statedOverallLength(tool)
  if (OAL === null || OAL <= 0) {
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
 * place; this maps a collet, or a holder that grips in its own bore, onto the
 * grip length that module asks for, which is all either contributes.
 */
export const stickoutLimits = (
  tool: CuttingTool,
  grip: Grip | null,
  /** What the holder needs to clear the part, from the sweep: the setup stands out at least this far. */
  required: number | null = null,
  policy: StickoutPolicy = DEFAULT_STICKOUT_POLICY,
  rule: ClampingRule = DEFAULT_CLAMPING,
): StickoutRange => stickoutRange(tool, { grip: gripLength(grip), required, policy, rule })

/**
 * The stickout an assembly starts at: the setup length for this tool, held
 * within what the grip allows.
 *
 * A tool whose setup outruns its grip is gripped as short as the grip lets it
 * and no shorter — rather than refused, because the shop is the one who knows
 * whether that is a problem.
 */
export const defaultStickout = (tool: CuttingTool, grip: Grip | null): number =>
  stickoutLimits(tool, grip).setup

/**
 * The shank diameters a crib can grip, given what it is asked to hold with.
 *
 * Every rule above reduces to one number — the shank — so "can anything here
 * hold this tool" is a question about a set of diameters. Working that set out
 * once and asking it per tool is what makes holding usable as a filter: asked
 * tool by tool it is holders × collets × tools, which on a real catalog is tens
 * of millions of comparisons per keystroke.
 *
 * By size alone: a bore's shank form rule is {@link holderTakesTool}'s, so a
 * crib of side-lock holders still lists a plain shank of their size here.
 */
export interface GripRanges {
  /** Closed intervals a collet or sleeve grips, in millimetres. */
  readonly spans: ReadonlyArray<readonly [number, number]>
  /** Exact diameters a holder's own bore takes. */
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

    // A collet in a collet chuck, or a sleeve in a bore.
    for (const collet of collets) {
      if (want.colletSeries && collet.series !== want.colletSeries) {
        continue
      }
      if (colletFitsHolder(collet, holder)) {
        spans.push([collet.clampMin, collet.clampMax])
      }
    }

    // A holder's own bore takes one nominal diameter, so it can never satisfy
    // a request for a particular collet series.
    if (
      want.colletSeries ||
      !isBoreClamping(holder.clamping) ||
      holder.boreDiameter === undefined
    ) {
      continue
    }
    bores.push(holder.boreDiameter)
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
 * {@link holderTakesTool} refuses it. A head on a modular `extension` is held
 * by the extension's shank.
 */
export const canHold = (ranges: GripRanges, tool: CuttingTool, extension?: Extension): boolean => {
  const shank = clampedShank({ tool, extension })
  return shank !== null && gripsAnyShank(ranges, shank.diameter)
}
