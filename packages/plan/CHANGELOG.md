# @toolpath/plan

## 0.4.0

### Minor Changes

- 5734e4c: Leave out features nothing machines, the same way in every app.
  - `@toolpath/dfm`: `featureSheet` marks `invalidGeometry` where the Engine measured a feature and found it is not one of its kind (a T-slot with `facts.isInvalidGeometry`, or an all-zero cutter band from an older kernel), and `unplannable` where Toolpath plans no pass for it whatever the tools (invalid geometry, a failed clearance measurement, or a clearance that admits no tool; never a chamfer). `invalidFeatureTags(sheets)` and `unplannableFeatureTags(sheets)` list them by tag. A dovetail's deprecated `isInvalidGeometry`, a failed measurement, is never read as invalid geometry. `isNoReading` now reads `facts.isInvalidGeometry` and leaves the slot's blend radius out of the zero check, so it finds the invalid T-slots the Engine sends; a T-slot whose measurement failed is not among them. Feature details say "None fits" for an invalid groove and keep "Not measured" for a failed measurement.
  - `@toolpath/viewer`: `withoutFeatures(model, tags)`, a `withoutFeatures` option on `normalizePartReport` and a `withoutFeatures` prop on `EnginePart` leave features out of the model and its region index, so picks and the direction wash go to the faces' other owners while every face stays drawn. `EnginePart` reads the list by its tags and keeps the loaded mesh.
  - `@toolpath/plan`: an optional `PlanRules.unplannable` refuses a pin that adds a feature Toolpath plans no pass for ("No tool can cut that feature, so a pin machines nothing.") and `actionsFor` stops offering one. A feature pinned already can still be let go or moved. Without it, nothing changes.

## 0.3.0

### Minor Changes

- 979d260: Read the trimmed features Toolpath serves with a plan: what is left of a part's feature once ignored
  faces (from Engine API 1.30.0) or a pinned feature sharing its faces (from the Engine release that
  plans with tp-kernel 0.29) keep some of its faces away. A plan's tags can name them, a draft can pin
  them, and the part's report does not list them.
  - `EnginePlan` has an optional `trimmedFeatures`, a list of `TrimmedFeature`; null or absent from
    an older Engine, read as none (`trimmedFeaturesOf`).
  - `planFeaturesOf(reportFeatures, plan, pinned?)` joins plan tags to features: the report's, then
    the trimmed ones shaped like them, each with `trimmed: true` and `fromFeatureTag`, less any whose
    tag the report lists (`unlistedTrimmedFeatures`). Pass it to `classifyFaces` and `groupFaces` so
    a trimmed feature's faces read as its own; in the constraints view pass the pins, so only pinned
    trimmed features show.
  - `planView` and `resultsView` mark a trimmed row `trimmed` and label it `Pocket (trimmed)`, from
    the feature it was trimmed from or its own type (`trimmedFeatureLabel`). It takes its origin's
    bore where its type is the origin's. A tag the report lists reads as the report's row.
  - `draftView` takes the latest plan as an optional third argument, and labels a pinned trimmed tag
    the same way.

  Every addition is optional: a plan or an app that has no trimmed features reads as before.

## 0.2.1

### Patch Changes

- e35f7bb: `groupFaces` ranks `circular_wall`, which Engine API 1.34.0 reports for a stud, a round boss or a
  turned part's outline, with the bosses, as the viewer does. Among features that include equally
  many faces still ungathered, a circular wall goes before a chamfer, fillet or wall, as a stud did
  when it read as a `boss`. Unranked, it went after chamfers and fillets.

## 0.2.0

### Minor Changes

- 52136d5: Clicks on the part follow the mouse button. A left click in an open folder pins a feature, and a
  left click on a feature in the folder leaves it there; a right click takes it out. `ignoreClick`
  takes `remove` for a right click and answers null where a click has nothing to do; it no longer
  takes `region`. `chooseReading` and the `choosePinReading` action take a new `'add'` target and no
  longer take the readings a click read. `machines` says whether a Results setup machines a feature.

## 0.1.0

### Minor Changes

- 360ecca: Add `@toolpath/plan`: plan mode for any app that plans parts with Toolpath. It holds the plan a
  person states and the plan Toolpath makes from it, as logic, data types and functions only, with no
  React and no DOM; its one dependency is `@toolpath/tool-support`, for the inch. An app keeps its own fields beside the constraints:
  `applyDraftAction` hands them back unchanged.
  - The draft: `Constraints`, `DraftSetup`, `DraftFolder` and the edits over them, such as `addFolder`,
    `moveFolder`, `pinInto`, `unpinFeature`, `setSetupProcess` and `withIgnored`. An edit that
    cannot be made (`setSetupProcess`, `setToolOrientation`, `moveFolder`, `moveFeature`,
    `pinInto`, `pinFrom`) returns `{ refused }` with the reason. Nothing throws.
  - What Toolpath is told and what it planned: `statementOf` (a draft as the job's `setupPlan`),
    `EnginePlan`, `planFromResults` and `foldersFromPlan`.
  - One menu of edits: `DraftAction` lists every edit a person can make, each making the plan
    Toolpath's own app makes for the same click — the picks among a click's readings and starting
    from Toolpath's plan included. `applyDraftAction` carries out any of them (`{ draft, facts }`, with
    the folder to open where the app opens one, or `{ refused }`), and `actionsFor` says which a
    folder, a feature, faces or the part can take.
  - The Plan page's helpers: pins and ignore (`pinEdit`, `folderClick`, `ignoreEdit`, `ignoreClick`,
    `readingsFor`), the tree and the drag (`draftView`, `planView`, `resultsView`, `gapAt`), paint
    (`planPaint`, `planHatch`) and the checks before Apply (`planChecks`, `confirmChecks`).
  - Undo, Redo and Discard: `planSession` moves a `PlanSession` on by one event (`act`, `edit`,
    `undo`, `redo`, `discard`, `applied`, `read`), so a React page holds its edits with one
    `useReducer`. `startSession`, `isHeld`, `canUndo`, `canRedo` and `HISTORY` go with it. Setups,
    folders, pins and ignored faces change only through actions; `edit` changes the app's own fields.
  - Faces: `classifyFaces` reads each face as ignored, pinned, open, machined or not machined.
  - The other inputs to a plan: `StockOption` with `parseStock` and `stockRequest`, `ToolCrib`, and
    `Units` with its formatting.
