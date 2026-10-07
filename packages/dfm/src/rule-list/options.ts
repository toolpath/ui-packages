import { QUICK_METRICS, QUICK_SUBJECTS } from '../model/dfm-metrics.js'
import { FEATURE_SUBJECTS, metricsForSubject, subjectLabel } from '../model/dfm-rules.js'
import type { Choices } from './picker.js'

/**
 * What a rule can be about: the short list, and the rule's own subject where
 * it is not on it; then, once asked for, every other type in one more list.
 */
export const subjectChoices = (current: string, all: boolean): Choices => {
  const quick = [...QUICK_SUBJECTS, ...(QUICK_SUBJECTS.includes(current) ? [] : [current])]
  const first = { choices: quick.map((value) => ({ value, label: subjectLabel(value) })) }
  if (!all) return { groups: [first], more: 'More feature types…' }
  const rest = FEATURE_SUBJECTS.filter((each) => !quick.includes(each.value))
  return { groups: [first, { heading: 'More feature types', choices: rest }] }
}

/**
 * What a rule can measure on its features: the short list, and the rule's
 * own measure where it is not on it; then, once asked for, everything else
 * those features report, under headings.
 */
export const metricChoices = (subject: string, current: string, all: boolean): Choices => {
  const offered = metricsForSubject(subject)
  const quick = offered.filter((each) => QUICK_METRICS.includes(each.key) || each.key === current)
  quick.sort((a, b) => rank(a.key) - rank(b.key))
  const rest = offered.filter((each) => !quick.includes(each))
  const first = { choices: quick.map(choice) }
  if (!all) return { groups: [first], more: rest.length > 0 ? 'More measures…' : undefined }
  return {
    groups: [
      first,
      ...grouped(rest).map(([heading, metrics]) => ({ heading, choices: metrics.map(choice) })),
    ],
  }
}

const choice = ({ key, label }: { key: string; label: string }) => ({ value: key, label })

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
