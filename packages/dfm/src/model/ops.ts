import type { DfmOp } from './dfm-metrics.js'
import {
  OPS,
  RANGE_HIGHS,
  RANGE_LOWS,
  opSymbol,
  withOp,
  type DfmRule,
  type RangeHigh,
  type RangeLow,
} from './dfm-rules.js'
import type { ChoiceGroup, Choices } from './view-types.js'

export const OP_TITLES = {
  gte: 'at least',
  gt: 'more than',
  lte: 'at most',
  lt: 'less than',
  eq: 'equal to',
  ne: 'not equal to',
  between: 'a range, between two numbers',
} as const satisfies Record<DfmOp, string>

/** A range's low end, read from the number toward the measure: `6 < L/D` is above 6. */
const LOW_SYMBOLS = { gte: '≤', gt: '<' } as const satisfies Record<RangeLow, string>

/** A range's low end in words, read the same way as {@link LOW_SYMBOLS}: `6 ≤ L/D` is 6 at most L/D. */
const LOW_TITLES = { gte: 'at most', gt: 'less than' } as const satisfies Record<RangeLow, string>

/** The one-sided comparisons, offered from a range to leave it: their values marked apart from its ends'. */
const ONE_SIDED = 'one:'

/** A range with one end's choice made: that end held the new way, or a one-sided comparison in its place. */
export const rangeEnd = (
  rule: DfmRule,
  chosen: string,
  hold: (op: string) => Partial<DfmRule>,
): DfmRule =>
  chosen.startsWith(ONE_SIDED)
    ? withOp(rule, chosen.slice(ONE_SIDED.length) as DfmOp)
    : { ...rule, ...hold(chosen) }

/**
 * How a picker words one comparison: from its symbol, `≥`, the comparison
 * itself, and its title in words, `at least`. The web's pickers show the
 * symbol alone; a phone's list, with room for words, adds the title.
 *
 * The symbol and the title always read the same way. A range's low end reads
 * from the number toward the measure, so its `gte` is `≤` and `at most`; use
 * the `title` given rather than `OP_TITLES[op]`, which reads from the measure.
 */
export type OpLabel = (symbol: string, op: DfmOp, title: string) => string

const symbolOnly: OpLabel = (symbol) => symbol
const symbolAndTitle: OpLabel = (symbol, _op, title) => `${symbol} ${title}`

/**
 * Every one-sided comparison, under a heading, in either end of a range:
 * worded by `label`, or by symbol and title when there is none.
 */
export const oneSidedChoices = (label: OpLabel = symbolAndTitle): ChoiceGroup => ({
  heading: 'One-sided',
  choices: OPS.filter((op) => op !== 'between').map((op) => ({
    value: `${ONE_SIDED}${op}`,
    label: label(opSymbol(op), op, OP_TITLES[op]),
  })),
})

/** Every comparison, for a one-sided rule. */
export const comparisonChoices = (label: OpLabel = symbolOnly): Choices => ({
  groups: [
    { choices: OPS.map((op) => ({ value: op, label: label(opSymbol(op), op, OP_TITLES[op]) })) },
  ],
})

/** A range's end, held either way, and the one-sided comparisons to leave the range by. */
const rangeChoices = <Op extends RangeLow | RangeHigh>(
  ops: readonly Op[],
  symbolOf: (op: Op) => string,
  titleOf: (op: Op) => string,
  label: OpLabel | undefined,
): Choices => ({
  groups: [
    {
      heading: 'Range',
      choices: ops.map((op) => ({
        value: op,
        label: (label ?? symbolOnly)(symbolOf(op), op, titleOf(op)),
      })),
    },
    oneSidedChoices(label),
  ],
})

/**
 * A range's low end, held either way, and the one-sided comparisons to leave
 * the range by. `label` words both groups; without one, the ends are their
 * symbols and the one-sided comparisons their symbols and titles.
 */
export const rangeLowChoices = (label?: OpLabel): Choices =>
  rangeChoices(
    RANGE_LOWS,
    (op) => LOW_SYMBOLS[op],
    (op) => LOW_TITLES[op],
    label,
  )

/** A range's high end, held either way, and the one-sided comparisons to leave the range by; worded as {@link rangeLowChoices}' are. */
export const rangeHighChoices = (label?: OpLabel): Choices =>
  rangeChoices(RANGE_HIGHS, opSymbol, (op) => OP_TITLES[op], label)
