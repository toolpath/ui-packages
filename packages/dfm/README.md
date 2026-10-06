# Toolpath DFM

`@toolpath/dfm` is the DFM (design for manufacturing) rule list: each rule
written as the sentence it is — "Holes with L/D to top of part ≥ 8" — whose
words are its fields, beside its colour and how many of a part's features
break it. Under the list, Import, Export and Copy LLM prompt share a rule set
as one JSON file.

It also draws a feature's reach chart: the walls beside the feature, how high
they stand and how far out.

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

| Entry point             | What it is                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `@toolpath/dfm`         | `RuleList`, `Swatch`, the list's keyboard helpers, `ReachChart`, `ReachDrawing`, their types |
| `@toolpath/dfm/model`   | The rules, `checkPart`, the rule-set file — no React, no DOM                                 |
| `@toolpath/dfm/dfm.css` | Lets the app's Tailwind see the list's and chart's classes                                   |

## The rules are an input

The package ships no default rules and stores nothing. The app keeps the rules
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
