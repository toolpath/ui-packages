---
'@toolpath/viewer': minor
'@toolpath/dfm': minor
'@toolpath/ui': minor
---

Support complete multi-body scenes: `PartCollection` with body-scoped picking and shared section bounds, `usePartCollection` to load every body's mesh and swap in each analysis mesh as it arrives, `displayMeshModel` to draw a part's display mesh before its analysis, and combined DFM results with body identities. `@toolpath/dfm` adds `combineBodyChecks` and its `BodyDfmSummary`, with `ruleSeverity`, `featureSeverities`, `featuresByType`, `bodiesByRule` and the `DfmSeverity` type to present it. `@toolpath/ui` adds `BodyDfmResults`, which lists the rules as the rule list does and the features by body, and `SeverityIcon`, which marks a feature that breaks a rule.
