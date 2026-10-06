# Toolpath DFM

`@toolpath/dfm` is the DFM (design for manufacturing) rule list: each rule
written as the sentence it is — "Holes with L/D to top of part ≥ 8" — whose
words are its fields, beside its colour and how many of a part's features
break it. Under the list, Import, Export and Copy LLM prompt share a rule set
as one JSON file.

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

| Entry point             | What it is                                                     |
| ----------------------- | -------------------------------------------------------------- |
| `@toolpath/dfm`         | `RuleList`, `Swatch`, the list's keyboard helpers, their types |
| `@toolpath/dfm/model`   | The rules, `checkPart`, the rule-set file — no React, no DOM   |
| `@toolpath/dfm/dfm.css` | Lets the app's Tailwind see the list's classes                 |

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
