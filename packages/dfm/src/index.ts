/**
 * `@toolpath/dfm` — the DFM rule list: each rule as an editable sentence, its
 * colour, and how many of a part's features break it; and the reach chart: the
 * walls beside a feature, how high and how far out.
 *
 * The rules are an input. The app keeps them and decides what they start as;
 * the list only shows and edits them. The rules and the checker themselves,
 * with no React, are `@toolpath/dfm/model`.
 */

export { RuleList, ruleListKeys } from './rule-list/rule-list.js'
export { Swatch, type SwatchProps } from './rule-list/swatch.js'
export { isField, listKeys } from './rule-list/list-keys.js'
export type { DfmRules, Hovered, RuleListProps } from './rule-list/types.js'
export { ReachChart, ReachDrawing } from './reach/reach-chart.js'
export type { ReachChartProps } from './reach/types.js'
export { storageFolds, type FoldStore } from './feature-panel/fold-store.js'
export {
  FeatureDetails,
  type FeatureDetailsProps,
  type PinchPointsToggle,
} from './feature-panel/feature-details.js'
export type { FeaturePanelLook } from './feature-panel/look.js'
export type {
  FeatureIdentity,
  Loadable,
  PopOutId,
  PopOutWindowProps,
} from './feature-panel/types.js'
