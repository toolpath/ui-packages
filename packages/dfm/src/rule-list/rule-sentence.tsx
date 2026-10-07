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
import { LOW_SYMBOLS, ONE_SIDED_CHOICES, OP_TITLES, rangeEnd } from './ops.js'
import { metricChoices, subjectChoices } from './options.js'
import { Picker, type Choices } from './picker.js'
import { ValueField } from './value-field.js'

const RANGE_LOW: Choices = {
  groups: [
    { heading: 'Range', choices: RANGE_LOWS.map((op) => ({ value: op, label: LOW_SYMBOLS[op] })) },
    ONE_SIDED_CHOICES,
  ],
}

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
      <Picker
        label="Features"
        value={rule.subject}
        choices={subjectChoices(rule.subject, allSubjects)}
        onChange={(value) => onChange(withSubject(rule, value, units))}
        onMore={() => setAllSubjects(true)}
      />
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
            <Picker
              label="Low end"
              title={OP_TITLES[lowOf(rule)]}
              value={lowOf(rule)}
              choices={RANGE_LOW}
              onChange={(value) =>
                onChange(rangeEnd(rule, value, (op) => ({ lowOp: op as RangeLow })))
              }
            />{' '}
          </>
        ) : null}
        <Picker
          label="Measure"
          title={info?.hint}
          value={rule.metric}
          choices={metricChoices(rule.subject, rule.metric, allMetrics)}
          onChange={(value) => onChange(withMetric(rule, value, units))}
          onMore={() => setAllMetrics(true)}
          autoFocus={autoFocus}
        />
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
