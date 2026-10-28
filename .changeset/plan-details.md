---
'@toolpath/plan': minor
---

Adds `planDetails(inputs)`: everything an app shows of a plan, in one call. It gives the constraints
(`details.constraints`), Toolpath's plan (`details.results`), the lookups (`details.find`) and the paint
(`details.paint(shown)`) from
one set of inputs: `draft`, `saved` (with whether it `changed` since the plan), `plan`, `part`,
`analysis` (with its `kernelVersion` and `directions`) and `planIsOfSaved`. Each part is worked out
only when it is read, and only once. It passes `planFeaturesOf` to the face coverage and the latest
plan to `draftView`.

Breaking: the functions `planDetails` is built from, and the click rules, move off the main entry.
Import them from their new entry:

- `@toolpath/plan/parts`: `allClear`, `allFolders`, `changedSinceResults`, `classifyFaces`,
  `confirmChecks`, `currentFor`, `draftView`, `findPlaced`, `folderPath`, `framesOf`, `groupFaces`,
  `listsTag`, `machines`, `pinnedIn`, `pinOf`, `pinTargetOf`, `planChecks`, `planCounts`,
  `planHatch`, `planPaint`, `planTags`, `resultsView`, `setupOf`, `tagSet`, and the types
  `CheckContext`, `CheckedDraft`, `ConfirmContext`, `ConstraintsCoverage`, `ResultsCoverage` and
  `ResultsView`.
- `@toolpath/plan/clicks`: `faceRegions`, `featuresAt`, `ignoreClick`, `ignoreSelection`,
  `readingsFor`, and the types `IgnoreMode`, `ReadingAt`, `ReadingContext`, `ReadingScope` and
  `SplitRegion`. `IgnoredAs` is on both the main entry and `/clicks`.
