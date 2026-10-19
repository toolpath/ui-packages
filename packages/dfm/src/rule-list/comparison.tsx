import type { FC, ReactElement } from 'react'
import {
  OPS,
  RANGE_HIGHS,
  highOf,
  opSymbol,
  withOp,
  type DfmOp,
  type DfmRule,
  type RangeHigh,
} from '../model/dfm-rules.js'
import { ONE_SIDED_CHOICES, OP_TITLES, rangeEnd } from './ops.js'
import { Picker, type Choices } from './picker.js'

const COMPARISONS: Choices = {
  groups: [{ choices: OPS.map((op) => ({ value: op, label: opSymbol(op) })) }],
}

const RANGE_HIGH: Choices = {
  groups: [
    { heading: 'Range', choices: RANGE_HIGHS.map((op) => ({ value: op, label: opSymbol(op) })) },
    ONE_SIDED_CHOICES,
  ],
}

/**
 * The comparison after the measure. One-sided, every comparison and "range".
 * In a range it is the high end — `L/D ≤ 8` — and, like the low end, offers
 * the one-sided comparisons under a heading of their own, to leave the range by.
 */
export const Comparison: FC<{
  rule: DfmRule
  ranged: boolean
  onChange: (rule: DfmRule) => void
}> = ({ rule, ranged, onChange }): ReactElement =>
  ranged ? (
    <Picker
      label="High end"
      title={OP_TITLES[highOf(rule)]}
      value={highOf(rule)}
      choices={RANGE_HIGH}
      onChange={(value) => onChange(rangeEnd(rule, value, (op) => ({ highOp: op as RangeHigh })))}
    />
  ) : (
    <Picker
      label="Comparison"
      title={OP_TITLES[rule.op]}
      value={rule.op}
      choices={COMPARISONS}
      onChange={(value) => onChange(withOp(rule, value as DfmOp))}
    />
  )
