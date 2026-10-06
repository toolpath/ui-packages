import type { FC, ReactElement } from 'react'
import { QUICK_METRICS, QUICK_SUBJECTS } from '../model/dfm-metrics.js'
import { FEATURE_SUBJECTS, metricsForSubject, subjectLabel } from '../model/dfm-rules.js'

/** The last option of a short list: choosing it lists the rest. */
export const MORE = '__more'

/**
 * Lists everything in a dropdown that was showing its short list, and opens
 * it again at once, so asking for more is one step rather than two.
 */
export const showMore = (select: HTMLSelectElement, setAll: (all: boolean) => void): void => {
  setAll(true)
  requestAnimationFrame(() => {
    try {
      select.showPicker()
    } catch {
      select.focus()
    }
  })
}

const option = (value: string, label: string): ReactElement => (
  <option key={value} value={value}>
    {label}
  </option>
)

/**
 * What a rule can be about: the short list, and the rule's own subject where
 * it is not on it; then, once asked for, every other type in one more list.
 */
export const SubjectOptions: FC<{ current: string; all: boolean }> = ({
  current,
  all,
}): ReactElement => {
  const quick = [...QUICK_SUBJECTS, ...(QUICK_SUBJECTS.includes(current) ? [] : [current])]
  const rest = FEATURE_SUBJECTS.filter((each) => !quick.includes(each.value))
  return (
    <>
      {quick.map((value) => option(value, subjectLabel(value)))}
      {all ? (
        <optgroup label="More feature types">
          {rest.map((each) => option(each.value, each.label))}
        </optgroup>
      ) : (
        option(MORE, 'More feature types…')
      )}
    </>
  )
}

/**
 * What a rule can measure on its features: the short list, and the rule's
 * own measure where it is not on it; then, once asked for, everything else
 * those features report, under headings.
 */
export const MetricOptions: FC<{ subject: string; current: string; all: boolean }> = ({
  subject,
  current,
  all,
}): ReactElement => {
  const offered = metricsForSubject(subject)
  const quick = offered.filter((each) => QUICK_METRICS.includes(each.key) || each.key === current)
  quick.sort((a, b) => rank(a.key) - rank(b.key))
  const rest = offered.filter((each) => !quick.includes(each))
  return (
    <>
      {quick.map((each) => option(each.key, each.label))}
      {all
        ? grouped(rest).map(([group, metrics]) => (
            <optgroup key={group} label={group}>
              {metrics.map((each) => option(each.key, each.label))}
            </optgroup>
          ))
        : rest.length > 0
          ? option(MORE, 'More measures…')
          : null}
    </>
  )
}

/** Where a measure sits in the short list; one not on it, after. */
const rank = (key: string): number => {
  const at = QUICK_METRICS.indexOf(key)
  return at === -1 ? QUICK_METRICS.length : at
}

/** Items under their headings, headings in the order they first come. */
const grouped = <Item extends { group: string }>(items: readonly Item[]): [string, Item[]][] => {
  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups]
}
