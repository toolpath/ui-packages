import { useEffect, useState, type FC, type ReactElement } from 'react'
import { cn } from '@toolpath/ui'
import { fromField, toField, type DfmMetric } from '../model/dfm-rules.js'
import type { Units } from '../model/units.js'
import { WORD } from './styles.js'

interface ValueFieldProps {
  label: string
  info: DfmMetric
  /** Canonical. */
  value: number
  units: Units
  onChange: (value: number) => void
}

/**
 * One of a rule's numbers, in the reader's units. It is taken as it is
 * typed, once it reads as one; until then the field says it is wrong and the
 * rule stands.
 */
export const ValueField: FC<ValueFieldProps> = ({
  label,
  info,
  value,
  units,
  onChange,
}): ReactElement => {
  const shown = toField(info.quantity, value, units)
  const [text, setText] = useState(shown)
  const [typing, setTyping] = useState(false)
  // The rule changed from elsewhere — another metric, another tab, other units — so the field follows.
  useEffect(() => {
    if (!typing) setText(shown)
  }, [shown, typing])
  const invalid = fromField(info, text, units) === null
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      inputMode="decimal"
      className={cn(
        WORD,
        'min-w-[2ch] cursor-text tabular-nums',
        invalid && 'text-danger decoration-danger',
      )}
      value={text}
      onFocus={() => setTyping(true)}
      onBlur={() => setTyping(false)}
      onChange={(event) => {
        setText(event.target.value)
        const typed = fromField(info, event.target.value, units)
        if (typed !== null) onChange(typed)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
