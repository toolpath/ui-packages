# @toolpath/plan

## 0.5.1

### Patch Changes

- 2b77996: Build with tsdown instead of tsup, which is no longer maintained. Entry points, exports and types are unchanged. Published JavaScript now keeps source comments, and internal chunk file names differ.

## 0.5.0

### Minor Changes

- 8aad03d: Adds `planDetails(inputs)`: everything an app shows of a plan, in one call. It gives the constraints
  (`details.constraints`), Toolpath's plan (`details.results`), the lookups (`details.find`) and how
  each face shows (`details.faces(shown)`) from one set of inputs: `draft`, `saved` (with whether it
  `changed` since the plan), `plan`, `part`, `analysis` (with its `kernelVersion` and `directions`) and
  `planIsOfSaved`. Each part is worked out only when it is read, and only once. Beside the views, it
  gives the tag sets they are read from: `constraints.assigned`, every feature assigned, and
  `results.machined`, every feature the plan's actions cut (both by lower-case tag). A feature the
  plan trimmed owns its faces (`planFeaturesOf`): in the results, so the faces the plan machines read
  as machined, and in the constraints where it is assigned.

  Breaking: the functions `planDetails` is built from move off the main entry to
  `@toolpath/plan/parts`: `allClear`, `allGroups` (was `allFolders`), `assignedIn` (was `pinnedIn`),
  `assignmentOf` (was `pinOf`), `assignTargetOf` (was `pinTargetOf`), `changedSinceResults`,
  `classifyFaces`, `confirmChecks`, `currentFor`, `draftView`, `findPlaced`, `framesOf`, `groupFaces`,
  `groupPath` (was `folderPath`), `listsTag`, `machines`, `planChecks`, `planCounts`, `planTags`,
  `resultsView`, `setupOf`, `sharedFaces` (was `planHatch`), `shownFaces` (was `planPaint`), `tagSet`,
  and the types `CheckContext`, `CheckedDraft`, `ConfirmContext`, `ConstraintsCoverage`,
  `ResultsCoverage` and `ResultsView`.

- 9dba80a: Breaking: the pointer, the rows and the pixels of a drag are the app's, and the click edit is named
  for what it does.

  - `flattenFolders` and `gapAt` are removed. The app lists the groups it shows as `FlatGroup`s and
    finds the gap the pointer is in itself.
  - `projectFolder(items, activeId, gap, offsetX, indent, maxDepth)` is
    `projectGroup(items, { activeId, gap, wantedDepth, maxDepth })` (`ProjectGroupOptions`). It takes
    the depth the group is dragged to, not a distance in pixels: to migrate, pass the group's own
    depth plus `Math.round(offsetX / indent)`.
  - `folderClick` is `toggleAssignment`: it assigns a feature to a group, or takes it out if it is
    assigned there.

- 8aad03d: Breaking: the plan is named as the Engine names it, and the package gives kinds and facts where it
  gave screen text. The app words them.

  Renamed, as the Engine's `setupPlan.setups[].orientations[]` and `doneRegions` say:

  - Ignore → done: `ignoreEdit`/`unignoreEdit` → `markDoneEdit`/`unmarkDoneEdit`,
    `withIgnored`/`withoutIgnored` → `withDone`/`withoutDone`, `IgnoredAs` → `DoneAs`, `ignoredAs` →
    `doneAs`, `ignoredAsSaved` → `doneAsSaved`, `takeBackIgnore` → `takeBackDone`. The actions
    `ignore`, `unignore`, `chooseIgnoreReading` are `markDone`, `unmarkDone`, `chooseDoneReading`; the
    coverage kind `ignored` is `done`; the fact `unignored` is `unmarked`.
  - Pin → assign: `pinEdit` → `assignEdit`, `pinInto`/`pinFrom` → `assignInto`/`assignFrom`, `withPin`
    → `withAssignment`, `unpinFeature` → `unassignFeature`, `pinsWhere` → `assignmentsWhere`,
    `pinHomes` → `assignedGroupByTag`, `unignorePinned` → `unmarkAssigned`, and the types `PinEdit`,
    `PinChange`, `PinContext`, `Pinned`, `PinnedFeature` → `AssignEdit`, `AssignChange`,
    `AssignContext`, `Assigned`, `AssignedFeature`. The actions `pinInto`, `pinFrom`, `unpin`,
    `choosePinReading` are `assignInto`, `assignFrom`, `unassign`, `chooseAssignReading` (its target
    `'pin'` is `'assign'`); the coverage kind `pinned` is `assigned`; the fact `unpinned` is
    `unassigned`.
  - Folder → group: `DraftFolder` → `DraftGroup` (its children under `groups`), `addFolder`,
    `renameFolder`, `removeFolder`, `removeFolders`, `moveFolder`, `withFolders`, `foldersFromPlan`,
    `nextFolderName`, `liftLoneFolder`, `placedFolders` → the same with `Group`; `FlatFolder`,
    `PlacedFolder` → `FlatGroup`, `PlacedGroup`.
    The actions `addFolder`, `renameFolder`, `moveFolder` are `addGroup`, `renameGroup`, `moveGroup`;
    an action target is `{ group }`. A new group is named by the rule `nameGroup` (`NameGroup`), and
    is "Group N" without it; `nextGroupName(names, word)` numbers names in another word. A draft
    stored with `folders` reads the same (`withGroups`, `parseDraftSetups`).
  - `addGroup`, `moveGroup`, `moveFeature`, `assignInto` and `assignFrom` take `(setups, options)`:
    one object of named fields, the same as their actions' (`AddGroupOptions`, `MoveGroupOptions`,
    `MoveFeatureOptions`, `AssignIntoOptions`, `AssignFromOptions`). To migrate, name each argument:
    `moveGroup(setups, id, to)` is `moveGroup(setups, { id, to })`.
  - Tool orientation → orientation: `setToolOrientation` (function and action) → `setOrientation`.
  - A feature type's header in the tree is a section: `FeatureGroupView` → `FeatureSectionView` (its
    bores under `sections`), `featureGroups` → `featureSections`.

  The session, named for what it does:

  - `planSession` → `nextSession`, `isHeld` → `hasEdits`, `HISTORY` → `UNDO_LIMIT`, and
    `startSession(saved, { held })` → `startSession(saved, { draft })`. The events `act`, `edit`,
    `applied`, `read` are `action`, `editFields`, `saved`, `reloaded`. `PlanSession.run` is
    `coalescing`; the rule `same` is `isSame`, and the rule `undoLimit` sets how far Undo reaches.
  - What the app can read itself leaves the action's result: `DraftResult.folderId` and
    `PlanSession.folderId` (the group to open: the id the app chose, or `details.find`), and the
    facts `letGo` and `home` (where the feature is assigned: `details.find.assignmentOf`). `facts`
    keeps `replaced`, `unmarked`, `unassigned` and `added`.

  Kinds in place of text and colours:

  - An edit that can't be made answers `{ refused: Refusal }`, and `PlanSession.refused` is a
    `Refusal`: a union keyed by `kind` (`groupGone`, `tooDeep`, `tooManySetups`, `idTaken`,
    `notAnAction`, `noTool`, `needsSaved`, `notEmpty`, `notWholeMove`, `directionTaken`,
    `directionIsSetup`, `noGroupFacing`, `otherWay`, `intoItself`, `hasOrientations`,
    `orientationOutsideSetup`, `orientationNeedsAxes`, `holdOnlySetup`) with its facts. A group it
    names is a `GroupRef`.
  - `PlanCheck` and `ConfirmCheck` are unions keyed by `kind` with their facts, and carry `severity`
    where they carried `tone`.
  - `NotMachinedWhy` carries each reason as a kind; `REASON_SHORT`, `reasonLine`, `whyText` and
    `NotMachinedReason` are removed.
  - `stateOf(tag, plan, regionsOf)` answers a `FeatureState`: a coverage kind, or `partOf` a larger
    assigned feature (`whole`), and the `groups` that hold it. It no longer takes the open group.
  - A face is a kind, which the app colours. `planPaint` and `planHatch` are `shownFaces` and
    `sharedFaces` (on `@toolpath/plan/parts`) and take no `colorOf`: each face is a `ShownFace`
    (`direction`, with its `direction` and `directionIndex`; `otherDirection`; `done`;
    `notMachined`), and each other direction that takes a face a `SharedFace`. `FacePaint`,
    `FaceHatch`, `DONE_COLOR`, `UNMACHINED_FACE_COLOR` and `OTHER_FOLDER_COLOR` are removed. To look
    as before: `done` 0x64748b at 0.6, `notMachined` 0xdc2626 at 0.6, `otherDirection` 0x525252 at
    0.75, and `direction` in that direction's colour, at 0.85 with no group open and 0.8 with one.
  - `refusalClauses` answers each statement Toolpath refused as a `RefusalClause`: `staleRegions` and
    `unknownRegions` (faces marked done on another analysis), or a `clause` with Toolpath's `text`.
    `describeClause` answers a `DescribedClause`: the `clause` with its setup and features named, or
    `notOffered`, whose `text` names the stated feature Toolpath did not offer. Neither writes a
    sentence of its own.
  - `parseDraftSetups` answers `{ invalid: DraftInvalid }` where it answered a sentence: a union keyed
    by `kind` (`noSetups`, `tooManySetups`, `setupDirection`, `setupProcess`, `groupId`, `tooDeep`,
    `groupDirection`, `notFeatureTags`, `featuresAndGroups`, `assignedTwice`, `directionTwice`), with
    `max` for the two limits. Test with `'invalid' in result`.
  - `toggleAssignment` (was `folderClick`; see `plan-drag-and-click.md`) answers
    `{ intent, unmarked }` and writes no note. `COVERAGE_LABELS`, `readingDetail`, `unpinnedNote`,
    `unignoredNote`, `regionLabel` and `FolderFeature` are removed.

  Removed, for the app to keep: the click-reading helpers `readingsFor`, `featuresAt`,
  `ignoreSelection`, `ignoreClick`, `faceRegions`, and the types `IgnoreMode`, `ReadingAt`,
  `ReadingContext`, `ReadingScope` and `SplitRegion`.

- 8aad03d: Move the stock, the tool crib and units out of `@toolpath/plan` into two new `@toolpath/quoting`
  entries. `@toolpath/plan` now has no dependencies.

  **Breaking for `@toolpath/plan`.** It no longer exports the stock (`StockOption`, `parseStock`,
  `sameStock`, `stockRequest`, `stockPlacement`, `fixedBoxCheck` and the rest of `stock`), the tool
  crib (`ToolCrib`, `startingLibrary`, `addLibrary` and the rest of `tool-crib`) or units (`Units`,
  `formatLength`, `toInput`, `fromInput` and the rest of `units`). To migrate, import the same names
  from the new entries; nothing else changes:

  - stock and tool crib: `@toolpath/quoting/inputs`
  - units: `@toolpath/quoting/units`

  `@toolpath/quoting` now depends on `@toolpath/tool-support`, for the inch.

- 2241cea: Breaking: `PART_ROW` and `IGNORE` are removed. They were the Plan page's own tree ids, so the app
  keeps them. With no group open, `openId` is `null` in `details.faces(shown)`, `shownFaces` and
  `sharedFaces`. A `DropAt` at the top of the tree is `{ zone: 'first' }` or `{ zone: 'last' }`, with
  no `id`.

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
