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
import { OP_TITLES, OneSidedOptions, rangeEnd } from './ops.js'
import { WORD } from './styles.js'

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
    <select
      aria-label="High end"
      title={OP_TITLES[highOf(rule)]}
      className={WORD}
      value={highOf(rule)}
      onChange={(event) =>
        onChange(rangeEnd(rule, event.target.value, (op) => ({ highOp: op as RangeHigh })))
      }
    >
      <optgroup label="Range">
        {RANGE_HIGHS.map((op) => (
          <option key={op} value={op}>
            {opSymbol(op)}
          </option>
        ))}
      </optgroup>
      <OneSidedOptions />
    </select>
  ) : (
    <select
      aria-label="Comparison"
      title={OP_TITLES[rule.op]}
      className={WORD}
      value={rule.op}
      onChange={(event) => onChange(withOp(rule, event.target.value as DfmOp))}
    >
      {OPS.map((op) => (
        <option key={op} value={op}>
          {opSymbol(op)}
        </option>
      ))}
    </select>
  )
