import { MILLING_RULES, type RuleVocabulary } from './dfm-metrics.js'
import { metricsForSubject, subjectLabel } from './dfm-rules.js'
import type { Choices } from './feature-panel-types.js'

/**
 * What a rule can be about: the short list, and the rule's own subject where
 * it is not on it; then, once asked for, every other type in one more list.
 */
export const subjectChoices = (
  current: string,
  all: boolean,
  vocabulary: RuleVocabulary = MILLING_RULES,
): Choices => {
  const { quickSubjects } = vocabulary
  const quick = [...quickSubjects, ...(quickSubjects.includes(current) ? [] : [current])]
  const first = {
    choices: quick.map((value) => ({ value, label: subjectLabel(value, vocabulary) })),
  }
  if (!all) return { groups: [first], more: 'More feature types…' }
  const rest = vocabulary.subjects.filter((each) => !quick.includes(each.value))
  return { groups: [first, { heading: 'More feature types', choices: rest }] }
}

/**
 * What a rule can measure on its features: the short list, and the rule's
 * own measure where it is not on it; then, once asked for, everything else
 * those features report, under headings.
 */
export const metricChoices = (
  subject: string,
  current: string,
  all: boolean,
  vocabulary: RuleVocabulary = MILLING_RULES,
): Choices => {
  const { quickMetrics } = vocabulary
  const offered = metricsForSubject(subject, vocabulary)
  const quick = offered.filter((each) => quickMetrics.includes(each.key) || each.key === current)
  quick.sort((a, b) => rank(quickMetrics, a.key) - rank(quickMetrics, b.key))
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
const rank = (quickMetrics: readonly string[], key: string): number => {
  const at = quickMetrics.indexOf(key)
  return at === -1 ? quickMetrics.length : at
}

/** Items under their headings, headings in the order they first come. */
const grouped = <Item extends { group: string }>(items: readonly Item[]): [string, Item[]][] => {
  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups]
}
