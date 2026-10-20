---
'@toolpath/dfm': major
'@toolpath/ui': minor
---

`@toolpath/dfm` is now the DFM rules and the part checker only: logic, data types and functions,
with no React, no DOM and no CSS. Its one dependency is `@toolpath/tool-support`; it no longer
needs `@toolpath/ui`, `react`, `react-dom` or `@phosphor-icons/react`. The root entry and
`@toolpath/dfm/model` are now the same entry.

The DFM views moved into `@toolpath/ui`: `RuleList`, `ReachChart`, `ReachDrawing`, `FeaturePanel`,
`FeatureDetails`, `CandidateList`, `ComparisonTable`, `Swatch`, `storageFolds`, `ruleListKeys`,
`candidateListKeys`, `listKeys`, `isField`, and their prop types. `@toolpath/ui` now depends on
`@toolpath/dfm` and `@toolpath/tool-support`.

`@toolpath/dfm` also exports the rule editing, field and unit helpers the views read, among them
`directionLabel`, `featureRows`, `formatMeasured`, `lengthValue` and `unitLabel`.

The rule list has no "Copy LLM prompt" button any more. Import and Export stay.

To migrate:

- Import the views from `@toolpath/ui` instead of `@toolpath/dfm`.
- Remove `@import '@toolpath/dfm/dfm.css';`. The `@toolpath/ui` theme covers the views' classes.
- `MILLING_RULES`, `TURNING_RULES` and the rule types stay in `@toolpath/dfm`.
- For the LLM button, pass your own through `actions`, calling `llmRulePrompt` from
  `@toolpath/dfm`.
