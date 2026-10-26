---
'@toolpath/dfm': minor
---

Exposes the rule-list, feature-panel and reach-chart logic from `/model` (and the root, the same
entry), so non-DOM UIs can build the same views:

- The views' data types: `CandidateRow`, `ComparedFace`, `ComparedFaceList`, `InspectedFace`,
  `Hovered`, `FeatureIdentity`, `DfmRules`, `Choice`, `ChoiceGroup` and `Choices`, and `ListedRule`,
  `ComparisonRow` and `RuleSetRead`.
- The rule editor's pickers: `subjectChoices`, `metricChoices`, `comparisonChoices`,
  `rangeLowChoices` and `rangeHighChoices`, `OP_TITLES` and `LOW_SYMBOLS`, `rangeEnd` for a range's
  end, and `takesNumber` for a measure with no number to compare. An `OpLabel` words each choice
  from its symbol, comparison and title, the title reading the same way as the symbol (a range's
  low end is `≤ at most`).
- The rule list: `ruleListOrder`, and `importNote` and `importError` for what an import says.
- The feature panel's comparison: `comparisonRows`, whose rows say what they read (`kind`, a
  `ComparisonRowKind`), and `faceLetter`.
- The fold store moves here from `@toolpath/ui`: `storageFolds`, `FoldStore`, `FoldStorage` and
  `FoldOptions`. It gains `{ shutAtFirst }`, for sections that start shut until someone opens them.
- The reach chart's section drawing: `sectionGeometry` and `SectionGeometry`, `Riser` and
  `featureBreak`, and its sizes in drawing pixels, `SECTION_PAD`, `SECTION_TYPE`, `SECTION_LABEL`,
  `READ_CHAR_PX`, `READ_INSET`, `AXIS_LABEL_HALF_PX`, `FLOOR_STRIP` and `DEPTH_WORD_PX`; and its
  reading under a pointer or finger, `readingAt`, `readingText`, `offsetUnder`, `readingLabelX` and
  `ReachReading`.

`fromField` reads a lone decimal comma as a point, so `2,5` is 2.5: in a comma-decimal region a
phone's decimal keypad offers only the comma.

Both entry points gain a `default` export condition beside `import`, so a resolver that asks for
`require`, such as Jest under `jest-expo`, finds them. The README says how to test with Jest.
