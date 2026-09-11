# @toolpath/ui

## 1.0.0

### Major Changes

- 6eb38c7: **Breaking:** `loadUnit`, `saveUnit` and `useUnit` are gone. They are
  `@toolpath/app-support` now, unchanged in behavior.

  ```diff
  -import { loadUnit, saveUnit } from '@toolpath/ui'
  +import { loadUnit, saveUnit } from '@toolpath/app-support'

  -import { useUnit } from '@toolpath/ui'
  +import { useUnit } from '@toolpath/app-support/react'
  ```

  They were never this package's to hold. `@toolpath/ui` is styling and display —
  the surface Storybook documents — and where a person's unit preference is stored
  is not that. They shipped here in 0.2.0 and 0.3.0 and are removed in the next
  release either way; taking them out now is the smallest window in which an
  application depends on the wrong package for them.

  `cn` stays, and stays public. It merges Tailwind classes, which is this
  package's own subject, and every component uses it.

  `tests/boundary.test.ts` is the check that keeps this true: every directory
  under `src/` contains a component, nothing sits loose at the top of `src/`, and
  no module imports a Toolpath sibling. Nothing shipped in this package's files
  changes for a consumer who imported only components.

## 0.3.0

### Minor Changes

- 309c8ea: Export `useUnit`, the React state around `loadUnit`/`saveUnit` this package
  already ships. It takes the storage key, like they do, so two applications on
  one origin keep their own units; it opens on millimetres and reads the stored
  preference on the first effect, so a server render and its hydration agree.

  The Toolpath template had written those three lines twice, character for
  character in both applications and differing only in the key. This is the copy
  that stops the third one being made.

## 0.2.0

### Minor Changes

- 9c3b124: Export two helpers an application had to keep beside this package: `cn`, which
  was here all along but internal, and `loadUnit`/`saveUnit` for the unit a person
  reads in. `loadUnit` reads the older `'in'`/`'mm'` spellings as well as
  `'inches'`/`'millimeters'`, so a preference already in a browser survives.

## 0.1.3

### Patch Changes

- 022bf37: `ShapeKind` and `KnownShapeKind` are now exported from `@toolpath/viewer`. They type
  `PartModelRegion.shapeKind`, which was already public and whose type a consumer had no way to
  write down — the same gap `FeatureType` and `KnownFeatureType` were already exported to close.

  Everything else here is plumbing that was exported and imported by nothing, found by `pnpm knip`
  and now module-private: the `Context` objects and provider value types behind `@toolpath/ui`'s
  combobox, menu, table, tabs, toggle, breadcrumbs and link, its `ROW_HEIGHT` constants and the
  inner `Table` that `TableRoot` wraps; and `IndexableFeature` in the viewer. Neither package's
  entry point changes shape, but `@toolpath/ui` ships `src`, so the files a consumer receives
  differ. An unused `ThreePoint` alias and an unused `three-stdlib` devDependency are gone.

- 66b7be1: Remove a stale `eslint-disable` directive naming a rule this repo does not configure. No behavior
  change; `@toolpath/ui` ships `src`, so the file a consumer receives differs.

## 0.1.2

### Patch Changes

- 340ed33: Declare the supported Node version. Both packages now carry `engines.node: ">=20"`, matching
  `@toolpath/api` and `@toolpath/tool-scraper` and the ES2022 output they already build.

## 0.1.1

### Patch Changes

- 9f87ad9: Retune icons across the component set. Carets, checks, and close buttons pick
  up explicit Phosphor weights (`bold`/`regular`) instead of inheriting the
  default, the combobox trigger trades `ArrowsOutLineVertical` for the
  conventional `CaretUpDown`, and the "press enter" affordance in combobox items
  and editable cells trades `ArrowBendUpLeft` for `ArrowElbowDownLeft`. Sizes
  shift a step where icons sat visually heavy (breadcrumb separators, pagination
  chevrons), and `Input` icons now self-center so suffix icons stay aligned at
  every input size.
- 2dc3546: Update published package repository links after the repository rename.
- c02c8d4: Stop `Button` throwing away a click when something re-renders mid-press.

  The inner surface was a component declared inside `Button`, which makes it a new
  component _type_ on every render. React therefore unmounted the content subtree and
  mounted a fresh one each time — and a `click` is only dispatched when `mousedown` and
  `mouseup` land on the same element, so any render occurring between the two halves of
  a press silently swallowed the click. A hover handler on an ancestor is enough to
  cause that render, which is why it presented as intermittent.

  Nothing said anything was wrong: the button stayed in the tree, matched by role and
  name, and reported enabled throughout. It cost two long debugging sessions in the part
  viewer before the cause was found.

  The surface is now an element built by a plain function rather than a component
  declared during render, so its identity survives. Covered by a test that asserts node
  identity across a re-render — `fireEvent.click` dispatches straight at the element and
  jsdom does not build a click from `mousedown` and `mouseup`, so a click-based test
  passes either way.
