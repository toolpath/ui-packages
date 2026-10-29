import { useState, type FC, type ReactElement } from 'react'
import { ScrollArea } from '../scroll-area'
import {
  MILLING_RULES,
  PRESENCE_METRIC,
  makeRule,
  ruleListOrder,
  type ListedRule,
} from '@toolpath/dfm'
import { listKeys } from './list-keys'
import { NewRule } from './new-rule'
import { RuleRow } from './rule-row'
import { RuleSetActions } from './rule-set-actions'
import type { RuleListProps } from './types'

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
  vocabulary = MILLING_RULES,
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
  // Rules nothing breaks sink below the rest, dimmed and saying so; one just added stays put.
  const ordered = ruleListOrder(rules.rules, check, added)
  const row = ({ rule, result, quiet }: ListedRule): ReactElement => (
    <RuleRow
      key={rule.id}
      rule={rule}
      result={result}
      checking={check === null}
      quiet={quiet}
      open={openIds.has(rule.id)}
      focusOnMount={added === rule.id}
      onToggle={() => toggleOpen(rule.id)}
      onChange={rules.update}
      onRemove={() => rules.remove(rule.id)}
      check={check}
      features={features}
      sheets={sheets}
      units={units}
      vocabulary={vocabulary}
      {...list}
    />
  )

  return (
    // Grows with its rules, and scrolls once the panel can grow no more.
    <ScrollArea className="min-h-0 flex-auto">
      <ul className="flex flex-col gap-0.5 pt-2 pr-4 pl-2">
        {ordered.map(row)}
        <NewRule
          vocabulary={vocabulary}
          onAdd={(subject) => {
            const rule = makeRule(subject, PRESENCE_METRIC.key, units, undefined, vocabulary)
            rules.add(rule)
            setAdded(rule.id)
          }}
        />
      </ul>
      <RuleSetActions rules={rules} actions={actions} vocabulary={vocabulary} />
    </ScrollArea>
  )
}
