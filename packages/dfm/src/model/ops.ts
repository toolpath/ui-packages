import type { DfmOp } from './dfm-metrics.js'
import {
  OPS,
  RANGE_HIGHS,
  RANGE_LOWS,
  opSymbol,
  withOp,
  type DfmRule,
  type RangeLow,
} from './dfm-rules.js'
import type { ChoiceGroup, Choices } from './view-types.js'

export const OP_TITLES: Record<DfmOp, string> = {
  gte: 'at least',
  gt: 'more than',
  lte: 'at most',
  lt: 'less than',
  eq: 'equal to',
  ne: 'not equal to',
  between: 'a range, between two numbers',
}

/** A range's low end, read from the number toward the measure: `6 < L/D` is above 6. */
export const LOW_SYMBOLS: Record<RangeLow, string> = { gte: '≤', gt: '<' }

/** A range's low end in words, read the same way as {@link LOW_SYMBOLS}: `6 ≤ L/D` is 6 at most L/D. */
const LOW_TITLES: Record<RangeLow, string> = { gte: 'at most', gt: 'less than' }

/** The one-sided comparisons, offered from a range to leave it: their values marked apart from its ends'. */
const ONE_SIDED = 'one:'

/** Every one-sided comparison, under a heading, in either end of a range. */
export const ONE_SIDED_CHOICES: ChoiceGroup = {
  heading: 'One-sided',
  choices: OPS.filter((op) => op !== 'between').map((op) => ({
    value: `${ONE_SIDED}${op}`,
    label: `${opSymbol(op)} ${OP_TITLES[op]}`,
  })),
}

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

/** Every comparison, for a one-sided rule. */
export const comparisonChoices = (label: OpLabel = symbolOnly): Choices => ({
  groups: [
    { choices: OPS.map((op) => ({ value: op, label: label(opSymbol(op), op, OP_TITLES[op]) })) },
  ],
})

/** A range's low end, held either way, and the one-sided comparisons to leave the range by. */
export const rangeLowChoices = (label: OpLabel = symbolOnly): Choices => ({
  groups: [
    {
      heading: 'Range',
      choices: RANGE_LOWS.map((op) => ({
        value: op,
        label: label(LOW_SYMBOLS[op], op, LOW_TITLES[op]),
      })),
    },
    ONE_SIDED_CHOICES,
  ],
})

/** A range's high end, held either way, and the one-sided comparisons to leave the range by. */
export const rangeHighChoices = (label: OpLabel = symbolOnly): Choices => ({
  groups: [
    {
      heading: 'Range',
      choices: RANGE_HIGHS.map((op) => ({
        value: op,
        label: label(opSymbol(op), op, OP_TITLES[op]),
      })),
    },
    ONE_SIDED_CHOICES,
  ],
})
