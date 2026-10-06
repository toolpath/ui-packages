import { useState, type FC, type ReactElement } from 'react'
import {
  RANGE_LOWS,
  lowOf,
  metricInfo,
  quantityUnit,
  upperOf,
  withMetric,
  withSubject,
  type DfmRule,
  type RangeLow,
} from '../model/dfm-rules.js'
import type { Units } from '../model/units.js'
import { Comparison } from './comparison.js'
import { LOW_SYMBOLS, OP_TITLES, OneSidedOptions, rangeEnd } from './ops.js'
import { MORE, MetricOptions, SubjectOptions, showMore } from './options.js'
import { WORD } from './styles.js'
import { ValueField } from './value-field.js'

interface SentenceProps {
  rule: DfmRule
  units: Units
  onChange: (rule: DfmRule) => void
  autoFocus: boolean
}

/**
 * A rule as the sentence it is, each word a field: *{features}* with
 * *{measure}* *{≥}* *{number}*, or a range around the measure, *{number}*
 * *{<}* *{measure}* *{≤}* *{number}*, each end held either way. A yes/no measure — a sharp inside corner —
 * has no comparison or number, and "any size" flags every feature of the
 * type: *{Undercut T-slots}*, *{any size}*. Features are offered as groups
 * or as each type the Engine reports; measures under headings, only those
 * the chosen features can have. A number is taken as it is typed, once it
 * reads as one; until then the field says it is wrong and the rule stands.
 */
export const RuleSentence: FC<SentenceProps> = ({
  rule,
  units,
  onChange,
  autoFocus,
}): ReactElement => {
  const info = metricInfo(rule.metric)
  // A yes/no, or "any size", has no comparison or number to set.
  const flag = info?.quantity === 'flag' || info?.quantity === 'presence'
  const presence = info?.quantity === 'presence'
  const ranged = info !== undefined && !flag && rule.op === 'between'
  const unit = info ? quantityUnit(info.quantity, units) : ''
  const [allSubjects, setAllSubjects] = useState(false)
  const [allMetrics, setAllMetrics] = useState(false)
  const unitSpan = unit ? (
    <span className={unit === '°' || unit === '%' ? '' : 'pl-1'}>{unit}</span>
  ) : null

  return (
    <p className="min-w-0 flex-1 text-sm leading-7 text-gray-500 dark:text-zinc-400">
      <select
        aria-label="Features"
        className={WORD}
        value={rule.subject}
        onChange={(event) => {
          if (event.target.value === MORE) showMore(event.currentTarget, setAllSubjects)
          else onChange(withSubject(rule, event.target.value, units))
        }}
      >
        <SubjectOptions current={rule.subject} all={allSubjects} />
      </select>
      {presence ? ', ' : ' with '}
      {/* A range is one expression, `2 in ≤ depth < 4 in`: it moves to a line of its own whole, never splits. */}
      <span className={ranged ? 'whitespace-nowrap' : undefined}>
        {ranged ? (
          <>
            <span className="whitespace-nowrap">
              <ValueField
                label="From"
                info={info}
                value={rule.value}
                units={units}
                onChange={(value) => onChange({ ...rule, value })}
              />
              {unitSpan}
            </span>{' '}
            <select
              aria-label="Low end"
              title={OP_TITLES[lowOf(rule)]}
              className={WORD}
              value={lowOf(rule)}
              onChange={(event) =>
                onChange(rangeEnd(rule, event.target.value, (op) => ({ lowOp: op as RangeLow })))
              }
            >
              <optgroup label="Range">
                {RANGE_LOWS.map((op) => (
                  <option key={op} value={op}>
                    {LOW_SYMBOLS[op]}
                  </option>
                ))}
              </optgroup>
              <OneSidedOptions />
            </select>{' '}
          </>
        ) : null}
        <select
          aria-label="Measure"
          title={info?.hint}
          className={WORD}
          value={rule.metric}
          onChange={(event) => {
            if (event.target.value === MORE) showMore(event.currentTarget, setAllMetrics)
            else onChange(withMetric(rule, event.target.value, units))
          }}
          autoFocus={autoFocus}
        >
          <MetricOptions subject={rule.subject} current={rule.metric} all={allMetrics} />
        </select>
        {info && !flag ? (
          <>
            {' '}
            <Comparison rule={rule} ranged={ranged} onChange={onChange} />{' '}
            <span className="whitespace-nowrap">
              <ValueField
                label={ranged ? 'Up to' : 'Value'}
                info={info}
                value={ranged ? upperOf(rule) : rule.value}
                units={units}
                onChange={(value) =>
                  onChange(ranged ? { ...rule, max: value } : { ...rule, value })
                }
              />
              {unitSpan}
            </span>
          </>
        ) : null}
      </span>
    </p>
  )
}
