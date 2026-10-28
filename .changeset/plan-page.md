---
'@toolpath/plan': minor
---

Adds `planPage(inputs)`: the Plan page in one call. It gives the constraints (`page.constraints`),
Toolpath's plan (`page.results`), the lookups (`page.find`) and the paint (`page.paint(view)`) from
one set of inputs. Each part is worked out only when it is read, and only once. It passes
`planFeaturesOf` to the face coverage and the latest plan to `draftView`.

Breaking: the functions `planPage` is built from, and the click rules, move off the main entry.
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
