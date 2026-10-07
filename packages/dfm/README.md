# Toolpath DFM

`@toolpath/dfm` is the DFM (design for manufacturing) rule list: each rule
written as the sentence it is — "Holes with L/D to top of part ≥ 8" — whose
words are its fields, beside its colour and how many of a part's features
break it. Under the list, Import, Export and Copy LLM prompt share a rule set
as one JSON file.

It also draws a feature's reach chart: the walls beside the feature, how high
they stand and how far out.

And it shows a feature as the Engine read it — the feature panel: the features
a clicked face could mean, the rules the chosen one breaks, what was measured
of it, its reach, and its datasheet as sent. Its pinch points, the widest tool
standing where the feature is tightest, are placed here and drawn by
`@toolpath/viewer`.

The rules and the checker that counts them ship too, with no React, under
`@toolpath/dfm/model`.

## Install

```sh
npm install @toolpath/dfm @toolpath/ui react react-dom
```

Add the styles after Tailwind and the `@toolpath/ui` theme:

```css
@import 'tailwindcss';
@import '@toolpath/ui/theme.css';
@import '@toolpath/dfm/dfm.css';
```

## Exports

| Entry point             | What it is                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@toolpath/dfm`         | `RuleList`, `Swatch`, the list's keyboard helpers, `ReachChart`, `ReachDrawing`, the feature panel (`FeaturePanel`, `FeatureDetails`, `CandidateList`, `ComparisonTable`, `storageFolds`), their types |
| `@toolpath/dfm/model`   | The rules, `checkPart`, the rule-set file, the feature panel's rows, pinch points — no React, no DOM                                                                                                   |
| `@toolpath/dfm/dfm.css` | Lets the app's Tailwind see the list's and chart's classes                                                                                                                                             |

## The rules are an input

The package ships no default rules and stores nothing — not the rules, nor
which of the feature panel's sections are open. The app keeps the rules
— in memory, `localStorage`, a server — and passes them in with the functions
that change them:

```tsx
import { RuleList, type DfmRules } from '@toolpath/dfm'
import { checkPart, dfmFeatures } from '@toolpath/dfm/model'

const rules: DfmRules = { rules, add, update, remove, replace }

// From a part analysis: the Engine's report, and each feature's datasheet.
const features = dfmFeatures(report.features)
const check = checkPart(features, { sheets, datasheets, regionAreas }, rules.rules)

<RuleList
  rules={rules}
  check={check} // null while the part is still being analysed
  features={features}
  sheets={sheets}
  units="mm"
  selected={selectedTag}
  selectedGroup={selectedGroup}
  onInspect={(tag, group) => inspect(tag, group)}
  onHover={(hovered) => highlight(hovered)}
/>
```

`sheets` is each feature's measurements, built with `featureSheet` from its
datasheet; `datasheets` is the datasheets as the API sent them, both by
lower-cased feature tag; `regionAreas` is each face's area by region index.

Put `ruleListKeys` on the panel that holds the list, so the arrow keys walk the
rules from anywhere in it.

## Reach chart

`ReachChart` draws a feature's reach curve: the section through the part at the
feature's wall, to scale. The feature is on the left, in blue; the walls step up
on the right, with their heights and their distances from the feature written
on. Pointing at the walls reads the curve at that distance.

```tsx
import { ReachChart, ReachDrawing } from '@toolpath/dfm'
import { featureProfile, readReachCurve } from '@toolpath/dfm/model'

const curve = readReachCurve(datasheet) // null where the feature has none
const feature = featureProfile(sheets[tag], featureType)

export const Reach = () =>
  curve ? <ReachChart curve={curve} units="mm" feature={feature} /> : null
```

`ReachChart` is as wide as its container. `ReachDrawing` is the same section
with a caption and a note on how to read it, for a larger window of its own.
Both stop drawing the curve half an inch past where the walls reach full
height; `ReachDrawing` says so in its note.

This is not the clearance overlay in `@toolpath/tool-drawing/clearance`: that
draws the walls beside a cutting tool, to show whether the tool fits. This
draws the walls alone.

## Feature panel

`FeaturePanel` is the card a click on the part opens: every feature the face
belongs to, then the details of the one being read. With several faces
shift-clicked, each face's candidates sit under a letter, above a table of
what each was read as. It fills what it is put in — where it sits, and
whether it can be dragged, is the app's — and the app decides what a click
means: which faces, which candidates in which order, which is read.

```tsx
import { FeatureDetails, FeaturePanel, storageFolds } from '@toolpath/dfm'
import { brokenRules, featureMeasurements, featureProfile } from '@toolpath/dfm/model'

const folds = storageFolds(localStorage, 'toolpath.fold.')

export const Inspector = () => (
  <FeaturePanel
    faces={[{ region, rows, selected }]}
    active={0}
    onSelect={(tag) => setSelected(tag)}
    onHover={setHovered}
    onClose={close}
    folds={folds}
  >
    <FeatureDetails
      feature={feature}
      units="mm"
      directionColor={directionHex}
      profile={featureProfile(sheets[key], feature.featureType)}
      required={check.required.has(key)}
      onFrame={() => frame(feature.tag)}
      rules={brokenRules(check, feature.tag, 'mm')}
      measurements={{
        status: 'ready',
        value: featureMeasurements({ features, feature, sheets, units: 'mm' }),
      }}
      record={{ status: 'ready', value: records[key] ?? null }}
      PopOut={AppWindow}
      folds={folds}
    />
  </FeaturePanel>
)
```

The parts work alone too. An app with an inspect panel of its own puts
`CandidateList` and `FeatureDetails` in it and fills their slots with its own
controls — a folder in a row's `detail`, a Pin button in its `action`, Zoom to
in the details' `actions`, a folder badge in `status`.

- **Rules broken** are `BrokenRule` rows: a colour, the rule's text, the figure
  that broke it, and optionally the limit and a note on hover. `brokenRules`
  builds them from this package's check; an app with a checker of its own
  builds them from its hits.
- **Measurements** are `featureMeasurements` rows, each with how it was worked
  out behind an ⓘ. `inchMark` writes inches as `0.46"`.
- **Reach, the datasheet fields and the raw record** read the feature's
  `FeatureRecord`: its report entry and datasheet as the API sent them.
- **Reads take time.** `measurements` and `record` are `Loadable`. While
  `loading`, a section says what it is reading; on `error` it shows the app's
  message and a Retry, held until `retryAt`.
- **The look** differs where apps want it to: `look.rules`, `look.selected` and
  `look.muted`. Left out, it is the CAD viewer's.
- **Folds** are kept in the app's `FoldStore`; `storageFolds(storage, prefix)`
  builds one over a `Storage`. Without one, a section remembers only while it
  is mounted.
- **Pop-outs** need `PopOut`, the app's window component: the panel decides
  what is open and fills it, and the app draws the frame. Define it at module
  level, and render it through a portal to the page's body: the panel's blur
  makes it the box a `fixed` window inside it would be placed in.
- **Keys:** Escape closes the panel and the arrow keys walk the candidates. On
  a `CandidateList` used alone, put `candidateListKeys` on whatever holds it.

## Pinch points

The widest tool a feature admits, standing where the feature is tightest. The
data is here; the drawing is `@toolpath/viewer`'s `<ToolMarks>`, which knows
nothing of datasheets:

```tsx
import { useMemo } from 'react'
import { pinchLabel, pinchMark, placePinchTool } from '@toolpath/dfm/model'
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
