import { useMemo, useState, type FC, type ReactElement } from 'react'
import { ScrollArea } from '@toolpath/ui'
import { PRESENCE_METRIC } from '../model/dfm-metrics.js'
import { makeRule, type DfmRule } from '../model/dfm-rules.js'
import { listKeys } from './list-keys.js'
import { NewRule } from './new-rule.js'
import { RuleRow } from './rule-row.js'
import { RuleSetActions } from './rule-set-actions.js'
import type { RuleListProps } from './types.js'

/**
 * The rule list's keys: put them on the whole panel that holds the list, so
 * the arrow keys work from its header and buttons too.
 */
export const ruleListKeys = listKeys('rules')

/**
 * The rules, one row each, each written as the sentence it is — "Holes with
 * L/D ≥ 8" — whose words are its fields: change the features, the measure,
 * the comparison or the number in place, with no form to open. The sentence
 * wraps rather than cuts off, so the whole rule always reads.
 *
 * Beside it, the rule's colour and how many required features break it; the
 * count opens to those features, identical holes gathered into one row as
 * the quoting app gathers them. Choosing one inspects it.
 *
 * Up and down walk the rules and the features of any that are open, a
 * feature highlighting as it is reached; right opens a rule (or a group of
 * holes) and left shuts it, or from a feature goes back up. Tab moves
 * through a rule's words.
 *
 * The rules come from the app, which keeps them and decides what they start as.
 */
export const RuleList: FC<RuleListProps> = ({
  rules,
  check,
  features,
  sheets,
  units,
  actions,
  ...list
}): ReactElement => {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const [added, setAdded] = useState<string | null>(null)
  const toggleOpen = (id: string): void =>
    setOpenIds((was) => {
      const next = new Set(was)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const byId = useMemo(
    () => new Map(check?.byRule.map((result) => [result.rule.id, result])),
    [check],
  )
  // Once the check is in, rules nothing breaks sink below the rest, dimmed and saying so. Where
  // any rule sits changes no colour — the palette's order settles that — so they can move. One
  // just added stays put, so it does not jump away as it is made.
  const found = (rule: DfmRule): boolean => {
    const result = byId.get(rule.id)
    return (
      check === null ||
      rule.id === added ||
      (result?.tags.length ?? 0) + (result?.otherTags.length ?? 0) > 0
    )
  }
  const active = rules.rules.filter(found)
  const none = rules.rules.filter((rule) => !found(rule))
  const row = (rule: DfmRule): ReactElement => (
    <RuleRow
      key={rule.id}
      rule={rule}
      result={byId.get(rule.id) ?? null}
      checking={check === null}
      open={openIds.has(rule.id)}
      focusOnMount={added === rule.id}
      onToggle={() => toggleOpen(rule.id)}
      onChange={rules.update}
      onRemove={() => rules.remove(rule.id)}
      check={check}
      features={features}
      sheets={sheets}
      units={units}
      {...list}
    />
  )

  return (
    // Grows with its rules, and scrolls once the panel can grow no more.
    <ScrollArea className="min-h-0 flex-auto">
      <ul className="flex flex-col gap-0.5 pt-2 pr-4 pl-2">
        {active.map(row)}
        {none.map(row)}
        <NewRule
          onAdd={(subject) => {
            const rule = makeRule(subject, PRESENCE_METRIC.key, units)
            rules.add(rule)
            setAdded(rule.id)
          }}
        />
      </ul>
      <RuleSetActions rules={rules} actions={actions} />
    </ScrollArea>
  )
}
