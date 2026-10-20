/**
 * `@toolpath/dfm` — the DFM rules and the part checker. Logic, data types and
 * functions only: no React, no DOM, no CSS.
 *
 * The rules are an input. The app keeps them and decides what they start as.
 * The views that show and edit them — `RuleList`, `FeaturePanel`,
 * `ReachChart` — are in `@toolpath/ui`. `@toolpath/dfm/model` is the same
 * entry under its old name.
 */

export * from './model/index.js'
