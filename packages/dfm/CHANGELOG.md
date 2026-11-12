# @toolpath/dfm

## 1.5.1

### Patch Changes

- Updated dependencies [652f050]
  - @toolpath/tool-support@1.0.0

## 1.5.0

### Minor Changes

- b0068c2: A stud's thread reads as a tapped hole's does. `featureSheet` fills `threading` from a circular
  wall's `facts.threading`, with `external: true` where its `side` is `External`, and the feature
  details' Thread row says "external". A sheet's `threading`, a hole's or a stud's, also carries
  `leftHand: true` for a left-hand thread, so a viewer can draw one from the sheet alone, and the
  Thread row says "left-hand". The thread measures (`threaded`, `threadPitch`, `threadDiameter`, and
  the minor and major diameters) are offered for circular walls too, while `threadPercentage` stays
  with holes, since a stud's thread reads none of it. A new `thread` subject, "Threads", names every
  threaded feature, holes and studs, and is on the quick list. `threadedHole` now names holes only,
  as it did before studs carried threads.

## 1.4.1

### Patch Changes

- 2b77996: Build with tsdown instead of tsup, which is no longer maintained. Entry points, exports and types are unchanged. Published JavaScript now keeps source comments, and internal chunk file names differ.

## 1.4.0

### Minor Changes

- a01c765: Exposes the rule-list, feature-panel and reach-chart logic from `/model` (and the root, the same
  entry), so non-DOM UIs can build the same views:

  - The views' data types: `CandidateRowData`, `ComparedFace`, `ComparedFaceList`, `InspectedFaceData`,
    `Hovered`, `FeatureIdentity`, `DfmRules`, `Choice`, `ChoiceGroup` and `Choices`, and `ListedRule`,
    `ComparisonRow` and `RuleSetRead`.
  - The rule editor's pickers: `subjectChoices`, `metricChoices`, `comparisonChoices`,
    `rangeLowChoices` and `rangeHighChoices`, `OP_TITLES`, `LOW_TITLES` (a range's low end in
    words), `rangeEnd` for a range's end, and `takesNumber` for a measure with no number to compare.
    An `OpLabel` words each choice from its symbol, comparison and title, the title reading the same
    way as the symbol (a range's low end is `≤ at most`).
  - The rule list: `ruleListOrder`, whose `ListedRule`s carry each rule's result and whether it is
    quiet, and `importNote` and `importError` for what an import says.
  - The feature panel's comparison: `comparisonRows`, whose rows say what they read (`kind`, a
    `ComparisonRowKind`), and `faceLetter`.
  - The fold store moves here from `@toolpath/ui`: `storageFolds`, `FoldStore`, `FoldStorage` and
    `FoldOptions`. It gains `{ shutAtFirst }`, for sections that start shut until someone opens them.
  - The reach chart's section drawing: `sectionGeometry` and `SectionGeometry`, `Riser` and
    `featureBreak`, and its sizes in drawing pixels, `SECTION_PAD`, `SECTION_TYPE`, `SECTION_LABEL`,
    `READ_CHAR_PX`, `READ_INSET`, `AXIS_LABEL_HALF_PX`, `FLOOR_STRIP` and `DEPTH_WORD_PX`; and its
    reading under a pointer or finger, `readingAt`, `readingText`, `offsetUnder`, `readingLabelX` and
    `ReachReading`.

  `fromField` takes `{ decimalComma }` (a `FieldOptions`): with it, a lone comma reads as the decimal
  point, so `2,5` is 2.5, for a comma-decimal region, where a phone's decimal keypad offers only the
  comma. Without it a comma is refused as before, so `1,000` is not read as 1.

  Both entry points gain a `default` export condition beside `import`, so a resolver that asks for
  `require`, such as Jest under `jest-expo`, finds them. They stay ES modules: a plain Node
  `require()` of them needs Node 20.19+ or 22.12+. The README says how to test with Jest.

### Patch Changes

- Updated dependencies [a01c765]
  - @toolpath/tool-support@0.6.1

## 1.3.0

### Minor Changes

- 5734e4c: Leave out features nothing machines, the same way in every app.
  - `@toolpath/dfm`: `featureSheet` marks `invalidGeometry` where the Engine measured a feature and found it is not one of its kind (a T-slot with `facts.isInvalidGeometry`, or an all-zero cutter band from an older kernel), and `unplannable` where Toolpath plans no pass for it whatever the tools (invalid geometry, a failed clearance measurement, or a clearance that admits no tool; never a chamfer). `invalidFeatureTags(sheets)` and `unplannableFeatureTags(sheets)` list them by tag. A dovetail's deprecated `isInvalidGeometry`, a failed measurement, is never read as invalid geometry. `isNoReading` now reads `facts.isInvalidGeometry` and leaves the slot's blend radius out of the zero check, so it finds the invalid T-slots the Engine sends; a T-slot whose measurement failed is not among them. Feature details say "None fits" for an invalid groove and keep "Not measured" for a failed measurement.
  - `@toolpath/viewer`: `withoutFeatures(model, tags)`, a `withoutFeatures` option on `normalizePartReport` and a `withoutFeatures` prop on `EnginePart` leave features out of the model and its region index, so picks and the direction wash go to the faces' other owners while every face stays drawn. `EnginePart` reads the list by its tags and keeps the loaded mesh.
  - `@toolpath/plan`: an optional `PlanRules.unplannable` refuses a pin that adds a feature Toolpath plans no pass for ("No tool can cut that feature, so a pin machines nothing.") and `actionsFor` stops offering one. A feature pinned already can still be let go or moved. Without it, nothing changes.

## 1.2.0

### Minor Changes

- c675f0b: Support complete multi-body scenes: `PartCollection` with body-scoped picking and shared section bounds, `usePartCollection` to load every body's mesh and swap in each analysis mesh as it arrives, `displayMeshModel` to draw a part's display mesh before its analysis, and combined DFM results with body identities. `@toolpath/dfm` adds `combineBodyChecks` and its `BodyDfmSummary`, with `ruleSeverity`, `featureSeverities`, `featuresByType`, `bodiesByRule` and the `DfmSeverity` type to present it. `@toolpath/ui` adds `BodyDfmResults`, which lists the rules as the rule list does and the features by body, and `SeverityIcon`, which marks a feature that breaks a rule.

## 1.1.0

### Minor Changes

- e35f7bb: Read the circular walls Engine API 1.34.0 reports: the outside of a whole cylinder standing along
  its machining direction. One that stands on a floor, a stud or round boss, is machined as a boss,
  and the `boss` subject names it; any other, such as a turned part's outline, is machined as a wall,
  and the `wall` subject names it. Before, the `wall` subject named every circular wall.

  `FeatureSheet` carries `standsOnAFloor`, read from the datasheet's `facts.standsOnAFloor`.
  `FactsKind` includes `CircularWall`, the `boss` and `wall` subjects list it, `type:circular_wall`
  names the type alone, and the pass length is offered for it. A circular wall has no floor fillet
  reading: the Engine reports the blend at a stud's foot as a feature of its own.

## 1.0.0

### Major Changes

- 99cb5a8: `@toolpath/dfm` is now the DFM rules and the part checker only: logic, data types and functions,
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

## 0.5.0

### Minor Changes

- 91d86f4: Add turning rules: `TURNING_RULES` gives `RuleList`, the rule helpers and the rule-set file a turned part's subjects and measures, and `turnedStretches` and `checkTurnedPart` check a part's turned features against them. Milling stays the default everywhere. An exported rule set now records which process it is for, so its JSON (and the LLM prompt's example) gains a `"process"` field, and `DfmMetric.kinds` and `DfmSubject.kinds` now admit turned kinds too. `FeaturePanel`, `CandidateList` and `FeatureDetails` take the same `vocabulary`, to name a turned feature by the ends it is cut from and head its considerations "Turning considerations"; `RuleVocabulary` gains `considerationsTitle`, and its `featureLabel` takes just a feature's type and direction.

## 0.4.0

### Minor Changes

- 44a031d: `featureMeasurements` gives T-slots and dovetails their own rows: undercut width (a T-slot's groove
  height), floor and opening widths, undercut depth and dovetail angle, and under milling the max
  cutting diameter (with a dovetail's angle and the corner radius), the max
  shaft diameter and the L/D to the top of the part over the cutting diameter. A closed T-slot's head
  is no wider than the opening it comes down through, and the shaft leaves the head reaching the
  back of the groove. They no longer read their cutter band as walls, so they have no minimum radius,
  max tool diameter or feature L/D rows. `featureSheet` carries the figures as `undercut`
  (`FeatureUndercut`), and marks one the Engine could not measure.

## 0.3.1

### Patch Changes

- f2d2f76: `FeaturePanel` is titled "Feature details" for one feature, whether a face was clicked or it was
  chosen from a list, in place of "Features on this face" and "Feature".

## 0.3.0

### Minor Changes

- d45900f: `RuleList` takes `actions`: the app's own buttons, at the end of the footer's row after Import…,
  Export and Copy LLM prompt.

## 0.2.1

### Patch Changes

- ed88855: Draw the rule list's pickers — a rule's features, measure and comparisons, and "+ New Rule" — as `@toolpath/ui` menus in place of native `<select>`s, so their open lists take the kit's popover, items and dark theme rather than the operating system's. Each word is a button named for its field and value, "Measure: any size"; its menu opens on the value it holds, and "More…" lists the rest in the open menu.

## 0.2.0

### Minor Changes

- ce6b5a3: `<PartMesh>` and `<EnginePart>` take `children`, drawn on the part, which read its model and mesh with
  `usePartContext()`.

  `featureTriangles(model, geometry, tag)` reads a feature's triangles and outward normals out of the mesh as
  plain arrays.

  `<ToolMarks>` draws cutting tools on the part to scale — an end mill, flat, bull nose or ball, or any tool by
  its `profile` — with a dimension and a label each, in the measure tool's style. `ViewerToolbar.ToolsButton`, on a `tools` control,
  shows and hides them.

  `@toolpath/dfm/model` adds `brokenRules` and the neutral `BrokenRule` row a feature's details list, `featureColor`
  for the colour a feature is painted, and the `FeatureRecord` type for a feature's raw report entry and datasheet.

  `pinchMark` and `pinchLabel` read the pinch discs a feature's widest tool stands in, and `placePinchTool` finds
  the datasheet's tool frame against the feature's faces and places that tool on the part, as plain vectors for
  `<ToolMarks>`.

  `FoldStore` and `storageFolds(storage, prefix)` keep which of the feature panel's sections are open, in a storage
  and under a key prefix the app chooses.

  `<FeatureDetails>` shows one feature as the Engine read it: its name and machining direction, the rules it breaks,
  its measurements and milling considerations with how each was measured, and its reach. It takes loading and
  failed reads with a Retry, slots for the app's own buttons and status, an optional REQUIRED pill and "Show this
  feature", and a `look`. `featureMeasurements` takes `inchMark`
  to write inches as `0.46"`.

  It also lists every field of the feature's datasheet and shows its raw API record, with a copy button.

  With `PopOut`, the app's own window component, the reach, the datasheet fields and the raw record pop out, larger,
  into it.

  `<CandidateList>` lists the features a clicked face could mean, with each one's colour, rule count, REQUIRED pill
  and the app's detail, note and action, chosen by click or by `candidateListKeys`.

  `<ComparisonTable>` sets the features several faces were read as side by side, marking the rows where they differ.

  `<FeaturePanel>` is the whole card: a clicked face's candidates, several faces compared under letters, and the
  read feature's details, with Escape and the arrow keys. The app places it.

## 0.1.0

### Minor Changes

- c69a1e3: Add the reach chart (`ReachChart`, and `ReachDrawing` for a larger window): the walls beside a feature, to scale, with their heights and distances, read off under the pointer.
- 87e45e2: New package: the DFM rule list (`RuleList`), with Import, Export and Copy LLM prompt as buttons, and the DFM rules and part checker under `@toolpath/dfm/model`. The rules are an input; the package ships no default rules.
