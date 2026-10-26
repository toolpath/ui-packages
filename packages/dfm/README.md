# Toolpath DFM

`@toolpath/dfm` is the DFM (design for manufacturing) rules and the part
checker: what a rule is, how a part's features break it, and the rule-set file
a set is shared in. **It is logic, data types and functions only** — no React,
no DOM, no CSS — so a server route can import it as readily as a browser.

The views that show and edit the rules — `RuleList`, `ReachChart`,
`FeaturePanel` — are in [`@toolpath/ui`](https://www.npmjs.com/package/@toolpath/ui).
The logic they read is here, so a view in another renderer (React Native, say)
builds the same thing:

- the views' data types (`CandidateRowData`, `InspectedFaceData`, `ComparedFace`,
  `DfmRules`, `Choices`)
- the rule editor's choices (`subjectChoices`, `metricChoices`,
  `comparisonChoices`, `rangeLowChoices`, `rangeHighChoices`, `OP_TITLES`,
  `rangeEnd`) and `takesNumber`, for a measure with no number to compare
- the rule list's order (`ruleListOrder`) and what an import says
  (`importNote`, `importError`)
- the feature panel's comparison (`comparisonRows`, `faceLetter`) and its fold
  store (`storageFolds`, with `shutAtFirst` for sections that start shut)
- the reach chart's section geometry and type (`sectionGeometry`,
  `SECTION_PAD`, `SECTION_TYPE`, `SECTION_LABEL`), in drawing pixels — CSS
  pixels on the web, points on React Native — and its reading under a pointer
  or finger (`readingAt`, `readingText`, `offsetUnder`, `readingLabelX`)

## Install

```sh
npm install @toolpath/dfm
```

## Exports

| Entry point           | What it is                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@toolpath/dfm`       | The rules and both vocabularies (`MILLING_RULES`, `TURNING_RULES`), `checkPart` and `checkTurnedPart`, the rule-set file and `llmRulePrompt`, the feature panel's rows, pinch points |
| `@toolpath/dfm/model` | The same entry, under its name from before the views moved                                                                                                                           |

Both are ES modules. A resolver that asks for `require` rather than `import`
gets the same files through the `default` condition, as it does for the one
package dfm imports, `@toolpath/tool-support`.

### Testing with Jest

Jest runs CommonJS, so an app's Jest (`jest-expo`, say) must transform the
package: add `@toolpath` to the packages `transformIgnorePatterns` lets through.

```js
transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native|expo|@toolpath)/)']
```

## The rules are an input

The package ships no default rules and stores nothing. The app keeps the rules
— in memory, `localStorage`, a server — and checks a part against them:

```ts
import { checkPart, dfmFeatures } from '@toolpath/dfm'

// From a part analysis: the Engine's report, and each feature's datasheet.
const features = dfmFeatures(report.features)
const check = checkPart(features, { sheets, datasheets, regionAreas }, rules)
```

`sheets` is each feature's measurements, built with `featureSheet` from its
datasheet; `datasheets` is the datasheets as the API sent them, both by
lower-cased feature tag; `regionAreas` is each face's area by region index.

## Turning rules

`TURNING_RULES` is the turning vocabulary: turned subjects (grooves, threads,
axial holes, OD and ID features) and their measures. Each vocabulary keeps its
own rules: a rule-set file of the other process is refused, and
`parseRules(raw, TURNING_RULES)` drops milling ones. Every helper that reads a
rule takes the vocabulary last, and reads milling where it is left out.

```ts
import { checkTurnedPart, turnedStretches } from '@toolpath/dfm'

// From a part analysis's `turning.features`.
const stretches = turnedStretches(report.turning.features)
const check = checkTurnedPart(stretches, rules)
```

The Engine reports a stretch both ends of the part reach as two features, one
per end; `turnedStretches` makes them one again, under the first one's tag. A
stretch breaks a rule only if it breaks it from every end it is cut from, and
every stretch counts — a turned face has one reading — so nothing is left in
`otherTags`. Turning is experimental in the API, so a datasheet field that is
missing or malformed is no figure, never an error.

## Rule-set files and the LLM prompt

`serializeRuleSet` writes a set as one JSON file and `parseRuleSetFile` reads
one back. `llmRulePrompt(rules, vocabulary)` is a prompt that walks an LLM
through writing a set for a shop. The rule list in `@toolpath/ui` has no button
for it; an app that wants one adds it through the list's `actions`.

## Pinch points

The widest tool a feature admits, standing where the feature is tightest. The
data is here. **Drawing it is the viewer's job, and needs `@toolpath/viewer`**;
this package does not depend on it. The viewer's `<ToolMarks>` knows nothing of
datasheets:

```tsx
import { useMemo } from 'react'
import { pinchLabel, pinchMark, placePinchTool } from '@toolpath/dfm'
import { featureTriangles, ToolMarks, usePartContext } from '@toolpath/viewer'

// A child of <EnginePart> or <PartMesh>, which gives it the part.
export const PinchPoints = ({ datasheet, sheet, feature, units, shown }) => {
  const { model, geometry } = usePartContext()
  // Placing the tool searches the feature's faces: once per feature, not once per render.
  const marks = useMemo(() => {
    const mark = pinchMark(datasheet, sheet, feature.featureType)
    const triangles = featureTriangles(model, geometry, feature.tag)
    const tool = mark ? placePinchTool(mark, triangles, feature.machiningDirection) : null
    return tool && mark ? [{ ...tool, ...pinchLabel(mark, units) }] : []
  }, [datasheet, sheet, feature, model, geometry, units])
  return <ToolMarks marks={marks} visible={shown} />
}
```

`placePinchTool` finds the datasheet's tool frame against the feature's faces —
the API gives its discs across the tool without saying which way x and y lie —
and stands the tool on the tightest disc, turned toward the wall that pinches
it. If the app moved the geometry to centre it, pass `origin`: where the CAD
file's zero now sits.

Show and hide it from the viewer's toolbar — `ViewerToolbar.ToolsButton` on a
`tools` control — with the state held by the app; start it shown. The tool is
an end mill made from its diameter and corner; to draw it as the app's other
tools are drawn, give the mark a `profile` from `@toolpath/tool-drawing`'s
outline of a flat or bull nose end mill that size.
