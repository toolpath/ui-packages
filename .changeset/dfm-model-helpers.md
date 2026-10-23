---
'@toolpath/dfm': minor
---

Exposes the rule-list, feature-panel and reach-chart logic from `/model`, so non-DOM UIs can build the
same views:

- The reach chart's reading: `readingAt`, `readingText`, `offsetUnder`, `readingLabelX` and
  `ReachReading`, and the section drawing's type sizes and label offsets, `SECTION_TYPE` and
  `SECTION_LABEL`.
- The feature panel's comparison: `comparisonRows` and `faceLetter`.
- The rule editor's pickers: `comparisonChoices`, `rangeLowChoices` and `rangeHighChoices`, and
  `takesNumber` for a measure with no number to compare. An `OpLabel` words each choice from its
  symbol, comparison and title, the title reading the same way as the symbol (a range's low end is
  `≤ at most`).
- The rule list: `ruleListOrder`, and `importNote` and `importError` for what an import says.
- `storageFolds` takes `{ shutAtFirst }`, for sections that start shut until someone opens them.

Both entry points gain a `default` export condition beside `import`, so a resolver that asks for
`require`, such as Jest under `jest-expo`, finds them. The README says how to test with Jest.
