import { hasNeck } from '@toolpath/tool-support'

import type { ViewerAssembly } from './types.js'

/**
 * What a drawing of this tool dimensions, and where each dimension goes.
 *
 * **Pure, and here rather than in the component**, because where a dimension
 * line sits is arithmetic: which ones apply to this tool, what each one
 * measures, and — the part a component would get wrong quietly — which lane
 * each length runs in so that no two lines cross. The drawing turns these into
 * SVG and nothing else.
 *
 * The space is the outline's own: millimetres, `z` above the tip, `r` from the
 * axis. Every length is measured **from the tip**, which is where a machinist
 * measures from and where every rule in the sheet measures from.
 *
 * Only stated numbers are dimensioned. A drawing that carries a dimension the
 * vendor never published is worse than one that carries fewer — the note under
 * the drawing already names what was assumed, and a dimension line looks like a
 * measurement whatever the note says.
 *
 * ## Nothing here is lettered
 *
 * The drawing writes no numbers on itself (Paul, 2026-09-02). The figures were
 * six two-line blocks fighting for the margin of a panel that already had the
 * same six numbers in a table beside it, and the table is where a number can be
 * read. What is left is the linework, and a way to say which line the reader is
 * pointing at — so this model says which dimensions exist and where they run,
 * and never what they are called or how they are written.
 *
 * ## Sides are `minus` and `plus`, not `left` and `right`
 *
 * This model was written for a drawing that only ran vertically, where the two
 * flanks of the tool were reliably the left and right of the screen. They are
 * not any more: the frame lays a tool along whichever axis its panel is longer
 * on, so the `-r` flank is the screen's left in one orientation and its top in
 * the other. The names say which flank rather than where it lands, because the
 * where is `toX`/`toY`'s alone.
 */

/** A length along the axis, drawn beside the stack. */
export interface LengthDimension {
  readonly code: string
  /** From the tip, in millimetres — always 0 for now, kept for a dimension that is not. */
  readonly from: number
  readonly to: number
  /**
   * The other codes this same line answers to.
   *
   * Two codes are one span more often than they look — see
   * {@link oneLinePerSpan} — and the line is drawn once, under `code`, rather
   * than as two of exactly the same length in two lanes. Pointing at any of
   * these names lights it.
   */
  readonly aliases?: ReadonlyArray<string>
  /**
   * Which line out from the stack this one runs in, 0 nearest.
   *
   * Shortest innermost, so the lines nest instead of crossing — the rule a
   * drafting sheet follows and the reason this is worked out rather than
   * listed in a fixed order.
   */
  readonly lane: number
}

/** A width across the axis, drawn at its own height. */
export interface WidthDimension {
  readonly code: string
  /** Half-width, in millimetres: the dimension runs from `-radius` to `+radius`. */
  readonly radius: number
  /** Where up the tool it is measured, in millimetres above the tip. */
  readonly at: number
}

/**
 * An angle between two faces, drawn as the two faces extended.
 *
 * **A drill is its point** (Paul, 2026-09-01: "shouldn't a 2d rep of a drill be
 * showing me a tip angle?"). On a ⌀1 drill the cone is three tenths of a
 * millimetre tall — drawn to scale it is invisible — so the drawing runs the
 * point's two flanks out past the tool and arcs between them, which is what a
 * sheet does with an angle too small to letter between its own faces.
 */
export interface AngleDimension {
  readonly code: string
  readonly degrees: number
  /** Halfway up the cone's own flank: a radius from the axis and a height above the tip. */
  readonly at: { readonly r: number; readonly z: number }
}

export interface ToolDimensions {
  readonly lengths: ReadonlyArray<LengthDimension>
  readonly widths: ReadonlyArray<WidthDimension>
  readonly angles: ReadonlyArray<AngleDimension>
  /** The corner radius, called out on the corner rather than dimensioned across it. */
  readonly cornerRadius: number | null
}

/** Two lengths this close together are one measurement under two names. */
const SAME = 1e-6

/** Nothing to draw a dimension from. */
const EMPTY: ToolDimensions = { lengths: [], widths: [], angles: [], cornerRadius: null }

/**
 * One line per span, whatever the span is called.
 *
 * Two codes are one measurement more often than they look. A shop that clamps
 * to its own rule states the stickout and the below-holder length as the same
 * number, and a tool stood out to its flutes states it a third time as the
 * flute length. Drawn a code at a time those came out as identical ladders in
 * two lanes — and with nothing lettered there is no telling one from the
 * other (Paul, 2026-09-02).
 *
 * The first code named keeps the line, which puts the tool's own number ahead
 * of the shop's chosen one, and the rest become its
 * {@link LengthDimension.aliases} so that pointing at any of them lights it.
 */
const oneLinePerSpan = (
  spans: ReadonlyArray<Omit<LengthDimension, 'lane'>>,
): Array<Omit<LengthDimension, 'lane'>> =>
  spans.reduce<Array<Omit<LengthDimension, 'lane'>>>((lines, span) => {
    const index = lines.findIndex(
      (each) => Math.abs(each.from - span.from) < SAME && Math.abs(each.to - span.to) < SAME,
    )
    if (index < 0) {
      return [...lines, span]
    }
    const same = lines[index]!
    return lines.map((each, at) =>
      at === index ? { ...same, aliases: [...(same.aliases ?? []), span.code] } : each,
    )
  }, [])

/**
 * The dimensions for one assembly.
 *
 * With a holder, the tool's overall length is left off: most of the shank is
 * inside the holder and a line to a face nobody can see reads as a mistake.
 * What replaces it is the number the holder brings — how far the tool stands
 * out of it.
 */
export const dimensionsFor = (assembly: ViewerAssembly): ToolDimensions => {
  const { tool, holder, stickout } = assembly
  const { DC, LCF, OAL, SFDM, RE } = tool.geometry
  if (DC === undefined || LCF === undefined) {
    return EMPTY
  }

  const shoulderLength = tool.geometry['shoulder-length']
  const shoulderDiameter = tool.geometry['shoulder-diameter']
  const necked = hasNeck(tool) && shoulderLength !== undefined && shoulderDiameter !== undefined

  const widths: Array<WidthDimension> = [{ code: 'DC', radius: DC / 2, at: 0 }]
  if (necked && shoulderDiameter !== undefined && shoulderLength !== undefined) {
    widths.push({
      code: 'shoulder-diameter',
      radius: shoulderDiameter / 2,
      // At the top of the relief, where the shank steps down to it: measured
      // in the middle it sat among the flute length and the corner radius,
      // which is the busiest inch of the drawing (Paul, 2026-09-01).
      at: shoulderLength,
    })
  }
  if (SFDM !== undefined) {
    // On the shank, and above the holder nose where there is one: a width
    // measured inside the holder is measured across a face nobody can see.
    const shankFrom = necked && shoulderLength !== undefined ? shoulderLength : LCF
    // Below the seated collet as well. It stands proud of the nose and is
    // drawn as solid at its series diameter, so arrows struck under it measure
    // across a face the collet is in front of.
    const seated = holder?.colletProtrusion ?? null
    const shankTo =
      stickout !== null && seated !== null ? stickout - seated : (stickout ?? OAL ?? shankFrom)
    widths.push({
      code: 'SFDM',
      radius: SFDM / 2,
      at: (shankFrom + Math.max(shankFrom, shankTo)) / 2,
    })
  }

  /** Every length this tool states, before they are put in lanes. */
  const spans: Array<Omit<LengthDimension, 'lane'>> = [{ code: 'LCF', from: 0, to: LCF }]
  if (necked && shoulderLength !== undefined) {
    spans.push({ code: 'shoulder-length', from: 0, to: shoulderLength })
  }
  const below = tool.geometry.LBH !== undefined && tool.geometry.LBH > 0 ? tool.geometry.LBH : null
  /**
   * Whether the below-holder length is a length below the holder *as drawn*.
   *
   * It is the tool's own number and the stickout is the shop's, and where the
   * shop stands the tool out less than the rule assumed, the top of `LBH` is
   * inside the holder. A line to a face buried in the holder is the mistake
   * the overall length is dropped for, and it reads worse here: the line runs
   * visibly past the nose and into the holder body, so the drawing looks like
   * it drew the assembly wrong (Paul, 2026-09-02).
   *
   * The drawing does not correct it — the assembly it is given is the assembly
   * it draws, and a stickout is nobody's number but the caller's. It declines
   * to dimension it.
   */
  const buried = below !== null && holder !== null && stickout !== null && below > stickout + SAME
  if (below !== null && !buried) {
    // What the shop's clamping rule leaves below the holder: the reach the
    // tool has, which is the number half the rules are about (Paul,
    // 2026-09-01).
    spans.push({ code: 'LBH', from: 0, to: below })
  }
  if (holder === null) {
    if (OAL !== undefined) {
      spans.push({ code: 'OAL', from: 0, to: OAL })
    }
  } else if (stickout !== null) {
    spans.push({ code: 'stickout', from: 0, to: stickout })
    /**
     * **No gauge length.** It is the spindle face to the holder nose, and
     * neither drawing reaches the spindle face — both stop a little past the
     * flange. A dimension to a face that is not on the drawing is the same
     * mistake as one to the end of a shank buried in the holder; the number
     * is in the holder's own details, where it can be read without a line
     * pointing at nothing.
     */
  }

  const lengths = oneLinePerSpan(spans)
    .sort((a, b) => a.to - a.from - (b.to - b.from))
    .map((span, index) => ({ ...span, lane: index }))

  /**
   * The point angle, on the tools that have a point: `at` is halfway up the
   * cone's own flank, which is where the angle is.
   */
  const SIG = tool.geometry.SIG
  const pointed =
    tool.form === 'drill' || tool.form === 'spot drill' || tool.form === 'center drill'
  const angles: Array<AngleDimension> =
    pointed && SIG !== undefined && SIG > 0
      ? [
          {
            code: 'SIG',
            degrees: SIG,
            at: { r: DC / 4, z: DC / 2 / Math.tan(((SIG / 2) * Math.PI) / 180) / 2 },
          },
        ]
      : []

  return {
    lengths,
    widths,
    angles,
    cornerRadius: RE !== undefined && RE > 0 ? RE : null,
  }
}

/** Which flank of the tool a lane runs on. */
export type Side = 'minus' | 'plus'

/**
 * One length's lane: which flank it runs on, and how far out along it.
 *
 * {@link LengthDimension.lane} numbers the lanes across the whole drawing,
 * shortest innermost. Where both flanks are offered they alternate, so each
 * flank carries its own run of lanes starting at 0 — and it is that per-flank
 * number, not the global one, that says how far out the line is drawn.
 */
export interface DimensionLane {
  readonly code: string
  readonly side: Side
  readonly lane: number
}

export interface LaneLayout {
  readonly lanes: ReadonlyArray<DimensionLane>
  /** How many lanes each flank carries, which is the room that flank needs. */
  readonly count: Readonly<Record<Side, number>>
}

/**
 * Which flank each length runs on, and its lane on that flank.
 *
 * **The drawing carries no figures**, so this is the whole of the layout: a
 * lane is a place for a line, and a line needs nothing but room for itself.
 * What replaced the bands is a plain ladder — the numbers live in the
 * consumer's own table, and the drawing lights the line the reader is pointing
 * at (Paul, 2026-09-02).
 */
export const laneLayout = (model: ToolDimensions, sides: 'one' | 'both' = 'one'): LaneLayout => {
  const lanes: Array<DimensionLane> = model.lengths.map((each) => ({
    code: each.code,
    side: sides === 'both' && each.lane % 2 === 1 ? 'plus' : 'minus',
    lane: sides === 'both' ? Math.floor(each.lane / 2) : each.lane,
  }))
  const on = (side: Side) => lanes.filter((each) => each.side === side).length
  return { lanes, count: { minus: on('minus'), plus: on('plus') } }
}

/** The room one flank's lines take, measured out from the edge of the stack. */
export interface LaneRoom {
  /** How far the width dimensions' arrows reach past the tool. */
  readonly arrow: number
  /** The clearance between the arrows and the first lane. */
  readonly gap: number
  /** From one lane to the next. */
  readonly step: number
}

/** Where a lane's line runs, out from the edge of the stack. */
export const laneOffset = (lane: number, room: LaneRoom): number =>
  room.arrow + room.gap + lane * room.step

/**
 * Everything one flank needs, out to its outermost line.
 *
 * Never less than the arrows, because a width is dimensioned from outside on
 * **both** flanks whether or not a length runs up either of them.
 */
export const laneRoom = (lanes: number, room: LaneRoom): number =>
  lanes === 0 ? room.arrow : laneOffset(lanes - 1, room)
