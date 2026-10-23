import type { ReactNode } from 'react'
import {
  type DfmCheck,
  type DfmRules,
  type Hovered,
  type RuleVocabulary,
  type FeatureSheets,
  type DfmFeature,
  type Units,
} from '@toolpath/dfm'

export type { DfmRules, Hovered } from '@toolpath/dfm'

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
   * What the rules can say, and how a broken feature is named: `MILLING_RULES`
   * where left out, `TURNING_RULES` for a turned part — whose `features` are
   * its stretches (`turnedStretches`) and whose `sheets` are `{}`.
   */
  vocabulary?: RuleVocabulary
  /**
   * At the end of the footer's row, after Import and Export: the app's own
   * buttons — a way back to its default rules, say.
   */
  actions?: ReactNode
}
