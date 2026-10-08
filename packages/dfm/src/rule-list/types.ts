import type { ReactNode } from 'react'
import type { DfmCheck } from '../model/dfm-flags.js'
import type { DfmRule } from '../model/dfm-rules.js'
import type { FeatureSheets } from '../model/feature-sheet.js'
import type { DfmFeature } from '../model/geometry.js'
import type { Units } from '../model/units.js'

/**
 * The rules the list shows, and how to change them. The app owns them —
 * where they are kept, and what they start as — so the list works on any
 * store and ships no rules of its own.
 */
export interface DfmRules {
  rules: readonly DfmRule[]
  /** Adds a rule at the end of the list. */
  add: (rule: DfmRule) => void
  /** Replaces the rule with the same id. */
  update: (rule: DfmRule) => void
  remove: (id: string) => void
  /** Puts an imported set in place of the list. */
  replace: (rules: readonly DfmRule[]) => void
}

/** The feature, or group of holes, the pointer is over in a list; null for none. */
export type Hovered = string | readonly string[] | null

export interface RuleListProps {
  rules: DfmRules
  /** The part checked against the rules; null while the analysis runs. */
  check: DfmCheck | null
  features: readonly DfmFeature[] | null
  sheets: FeatureSheets | null
  units: Units
  /** The feature being inspected, marked in the lists. */
  selected: string | null
  /** The group of holes being inspected, if one is. */
  selectedGroup: readonly string[] | null
  onInspect: (tag: string, group?: readonly string[]) => void
  onHover: (hovered: Hovered) => void
  /**
   * At the end of the footer's row, after Copy LLM prompt: the app's own
   * buttons — a way back to its default rules, say.
   */
  actions?: ReactNode
}
