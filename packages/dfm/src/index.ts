/**
 * `@toolpath/dfm` — the DFM rule list: each rule as an editable sentence, its
 * colour, and how many of a part's features break it.
 *
 * The rules are an input. The app keeps them and decides what they start as;
 * the list only shows and edits them. The rules and the checker themselves,
 * with no React, are `@toolpath/dfm/model`.
 */

export { RuleList, ruleListKeys } from './rule-list/rule-list.js'
export { Swatch, type SwatchProps } from './rule-list/swatch.js'
export { isField, listKeys } from './rule-list/list-keys.js'
export type { DfmRules, Hovered, RuleListProps } from './rule-list/types.js'
