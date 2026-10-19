import {
  OPS,
  opSymbol,
  withOp,
  type DfmOp,
  type DfmRule,
  type RangeLow,
} from '../model/dfm-rules.js'
import type { ChoiceGroup } from './picker.js'

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
