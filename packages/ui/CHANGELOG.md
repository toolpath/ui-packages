# @toolpath/ui

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
