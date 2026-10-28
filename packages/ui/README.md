# Toolpath UI

React components and a Tailwind CSS theme for Toolpath applications: form controls,
menus, dialogs, tables, resizable panels, and feedback, and the DFM views. No Engine
API key or SDK is required to use this package.

- [Install and configure styles](#install)
- [Quick start](#quick-start)
- [Theme and dark mode](#theme-and-dark-mode)
- [Component catalog](#component-catalog)
- [Composition examples](#composition-examples)
- [DFM views](#dfm-views)
- [Troubleshooting](#troubleshooting)
- [Working on this package](#working-on-this-package)

## Install

```sh
npm install @toolpath/ui
```

Your application must provide these peer dependencies:

| Dependency    | Supported range |
| ------------- | --------------- |
| `react`       | `^19.2.0`       |
| `react-dom`   | `^19.2.0`       |
| `tailwindcss` | `^4.0.0`        |

For a new application, install them alongside the package:

```sh
npm install @toolpath/ui react@^19.2.0 react-dom@^19.2.0 tailwindcss@^4
```

The DFM views bring `@toolpath/dfm` with them. To import its rules and checker in
your own code, add it to your own dependencies too:

```sh
npm install @toolpath/dfm
```

The JavaScript package is ESM; use `import`, not `require()`. TypeScript declarations
are included. The package declares Node.js 20 or newer for Node-based consumers;
the repository's contributor toolchain is separate.

Use this package through a React application bundler. Direct, unbundled Node ESM
imports currently fail on the table dependency's directory imports
(`ERR_UNSUPPORTED_DIR_IMPORT`). For server-rendered applications, verify the
framework's server bundling configuration as well as the client build.

### Configure Tailwind CSS v4

Configure Tailwind's build integration for your application first. Installing
`tailwindcss` alone does not configure your bundler: follow the official
[Vite](https://tailwindcss.com/docs/installation/using-vite) or
[PostCSS](https://tailwindcss.com/docs/installation/using-postcss) instructions.

In the global stylesheet processed by Tailwind, import these in order:

```css
@import 'tailwindcss';
@import '@toolpath/ui/theme.css';
```

Load that stylesheet through your application's entry point or framework root.
The theme is Tailwind input, not a precompiled component stylesheet. Its
`@source './src'` directive scans the component source shipped in the package;
you do not need to add `node_modules/@toolpath/ui` to a separate content list.

Import components and types from `@toolpath/ui`. The other public subpaths are
`@toolpath/ui/theme.css` and `@toolpath/ui/package.json`; paths such as
`@toolpath/ui/button` and `@toolpath/ui/src/button` are not public imports.

## Quick start

This controlled form labels its input and leaves saving to the application:

```tsx
import { useState } from 'react'
import { Button, Input } from '@toolpath/ui'

export const PartForm = ({ onSave }: { onSave: (name: string) => void }) => {
  const [name, setName] = useState('')

  return (
    <form
      className="flex max-w-sm flex-col gap-3 font-body"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(name.trim())
      }}
    >
      <label htmlFor="part-name">Part name</label>
      <Input
        id="part-name"
        name="part-name"
        value={name}
        onValueChange={(value) => setName(value ?? '')}
        placeholder="Mounting bracket"
        required
      />
      <Button variant="primary" type="submit" disabled={!name.trim()}>
        Save part
      </Button>
    </form>
  )
}
```

Interactive examples belong in a client component when your framework uses React
Server Components. Place `'use client'` before imports in that component; import
the global stylesheet through the framework's supported CSS entry point.

## Theme and dark mode

The theme defines Toolpath colors, font families, and small text sizes. It also
replaces Tailwind's `gray` and `zinc` palettes, so importing it affects your
application's utilities as well as these components.

Useful utilities include `bg-primary`, `text-info`, `text-danger`, `bg-tag-blue`,
`font-body`, `font-display`, `font-mono`, `text-2xs`, and `text-3xs`.

### Fonts

The font families are Open Sans (`font-body`), Nunito (`font-display`), and Roboto
Mono (`font-mono`). Font files are not bundled or downloaded by this package.
Load them through your application's font setup, or use the supplied system-font
fallbacks. Apply `font-body` to your application shell if you want it as the
application's default font.

Override tokens after importing the theme, for example:

```css
@import 'tailwindcss';
@import '@toolpath/ui/theme.css';

@theme {
  --color-primary: #2563eb;
  --color-primary-darken: #1d4ed8;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

Load Inter yourself if you use that override. Change a color's companion tokens,
such as `primary-darken`, when you also want its hover/active color to change.

### Dark mode

Add the `dark` class to the document's `<html>` element to activate the theme's
`dark:` utilities. Remove it for light mode. There is no package-wide theme
provider, automatic OS preference selection, or persisted theme preference.

Use the document root rather than only a nested application container: menus,
combobox popovers, tooltips, dialogs, and feedback use portals outside their
trigger's DOM subtree.

Set your application's background and text colors too, for example
`bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100` on its shell. The theme
does not apply page-wide background or text styles automatically.

### Classes and icons

Most components accept `className`, merged with their defaults using the exported
`cn` helper (`clsx` plus `tailwind-merge`). The target varies: `Input.className`
styles its wrapper, while `Button.className` styles its inner visual surface.
Use component props for supported sizes and variants before overriding classes.

Icons are application-supplied children or icon components where supported. The
package uses Phosphor internally but does not re-export its icon library. Give
icon-only buttons an accessible name; a tooltip alone is not a label.

## Component catalog

All names below are root exports from `@toolpath/ui`. Compound components expose
their parts as properties, such as `Menu.Item`, rather than separate imports.
The included TypeScript declarations describe the complete prop types for your
installed version.

| Export                                   | Use and notable API                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                 | Actions or links (`asLink` + `href`). `variant`, `size`, `shape`, `full`, `disabled`, `isLoading`.                                                                                |
| `IconButton`                             | Icon-only actions, optionally `toggled` or with `IconButton.Indicator`.                                                                                                           |
| `Input`                                  | Text, search, or numeric input; requires `id` and `name`. `onValueChange` receives a string, or `null` when a number input is cleared.                                            |
| `TextArea`                               | Multiline text input.                                                                                                                                                             |
| `QuantityInput`                          | Controlled number with increment/decrement buttons; `value`, `onValueChange`, `min`, `max`, `step`.                                                                               |
| `Checkbox`, `Star`, `Pin`                | Controlled `checked`, required `name`, and `onChange(checked, { shiftKey })`. Checkbox also supports `indeterminate`.                                                             |
| `Switch`                                 | Boolean control with `checked` and `onCheckedChange`.                                                                                                                             |
| `Slider`                                 | Numeric control with `value` and `onValueChange`; the callback receives a number.                                                                                                 |
| `Combobox`                               | Selection/search with required `items`; `Button`, `Trigger`, `Value`, `Input`, `Popover`, `List`, `Item`, `ItemIndicator`, `Empty`, `Group`, `GroupLabel`, `Icon`, `useCombobox`. |
| `Menu`                                   | Dropdown or context menu (`context`); `Trigger`, `Popover`, `Item`, `Divider`, `Submenu`, `SubmenuTrigger`, `useMenu`.                                                            |
| `Tooltip`                                | Wrap one element and supply `tip`; supports placement and delay props. Creates its own provider.                                                                                  |
| `Dialog`                                 | Promise-based confirmations; `Provider`, `useDialog`, `Title`, `Message`, `Actions`, `Confirm`, `Dismiss`.                                                                        |
| `Toast`                                  | Bottom-right feedback stack; `Provider`, `List`, `useToastManager`.                                                                                                               |
| `Notification`                           | Top-center feedback stack; `Provider`, `List`, `useNotificationManager`.                                                                                                          |
| `Tabs`                                   | Controlled navigation with `value` and `onValueChange`; `List`, `Tab`, `useTabs`. Render the selected content yourself.                                                           |
| `Toggle`                                 | Controlled segmented choice with `value` and `onValueChange`; `Item`, `useToggle`. With exactly two items, activating either switches to the other value.                         |
| `ToolDock`                               | Toolbar for many tools, `spread` (pins and All tools) or `grouped` (menus); `defaultLayout`, `LayoutToggle`. See below.                                                           |
| `Table`                                  | Data table with a header element and row render function; sorting, selection, grouping, tree, and virtualization options. See below.                                              |
| `EditableCell`, `useEditableGrid`        | Inline editing and grid navigation. The application parses/validates committed strings and persists changes.                                                                      |
| `Panels`                                 | Resizable layout; `Group`, `Panel`, `Separator`, `Collapsed`, layout/ref hooks, and related types.                                                                                |
| `ScrollArea`                             | Scrollable container; optional render function receives `{ hasOverflow }`. Give it a constrained size.                                                                            |
| `Pagination`                             | One-based `page`, `onClick(page)`, and `pagination: { totalPages, perPage }`. The application fetches or slices the data.                                                         |
| `Breadcrumbs`                            | Responsive trail with `Breadcrumbs.Item`; each item uses `to`, with optional `current` or `previous`.                                                                             |
| `Link`, `LinkProvider`, `useLinkContext` | Styled anchors, with an optional application router adapter.                                                                                                                      |
| `Callout`, `useDismissedCallouts`        | Anchored guidance with `Trigger` and `Content`; dismissal is remembered by `id` unless `rememberDismissed={false}`.                                                               |
| `Badge`                                  | Compact label with `size` and `variant`.                                                                                                                                          |
| `ProgressBar`                            | Numeric `progress` in the range 0–100, not 0–1.                                                                                                                                   |
| `Card`                                   | Bordered content container.                                                                                                                                                       |
| `Field`                                  | Settings-row layout with `title`, optional `description`/`content`, and a control as children. It does not create an input label.                                                 |
| `PageHeader`                             | Page title with optional actions as children.                                                                                                                                     |
| `Attribution`                            | Activity metadata composed with `Action`, `By`, and `At` (`date`, optional `hideTime`).                                                                                           |
| `RuleList`, `FeaturePanel`, `ReachChart` | The DFM views over `@toolpath/dfm`, and their parts. See [DFM views](#dfm-views).                                                                                                 |
| `cn`                                     | Merge conditional classes and conflicting Tailwind utilities.                                                                                                                     |

Unit preference helpers live in
[`@toolpath/app-support`](https://www.npmjs.com/package/@toolpath/app-support),
with React hooks at `@toolpath/app-support/react`.

## Composition examples

### Forms and control state

Callback names are component-specific: use `onValueChange` for `Input` and
`QuantityInput`, `onChange` for `Checkbox`, and `onCheckedChange` for `Switch`.
Input number values are still strings; parse them explicitly at your application
boundary. A checkbox cannot be both `checked` and `indeterminate`.

`Button` defaults to `type="button"`. Set `type="submit"` for form submission
and handle submission on the form, as in the quick start. On a native Button, an
`onClick` handler prevents the button's default action. `isLoading` replaces the label
with an animation; also pass `disabled` to prevent repeated activation.

| Prop             | Values                                                                  | Default   |
| ---------------- | ----------------------------------------------------------------------- | --------- |
| `Button.variant` | `default`, `primary`, `secondary`, `info`, `muted`, `danger`, `success` | `default` |
| `Button.size`    | `sm`, `md`, `lg`                                                        | `md`      |
| `Button.shape`   | `default`, `pill`                                                       | `default` |
| `Input.variant`  | `default`, `secondary`, `muted`, `ghost`                                | `default` |
| `Input.size`     | `md`, `lg`, `xl`                                                        | `lg`      |

Size and variant options are component-specific; they are not a shared enum.

### Searchable selection

`items` supplies the available values. The example uses strings. For object
values, `itemToStringLabel` controls display text, `itemToStringValue` controls
the submitted string, and `isItemEqualToValue` customizes equality checks.

```tsx
import { useState } from 'react'
import { Combobox } from '@toolpath/ui'

const materials = ['Aluminum', 'Steel', 'Titanium']

export const MaterialSelect = () => {
  const [material, setMaterial] = useState<string | null>(null)

  return (
    <Combobox items={materials} value={material} onValueChange={setMaterial} name="material">
      <Combobox.Trigger nativeButton aria-label="Material" className="rounded border px-3 py-1">
        <Combobox.Value placeholder="Choose material" />
      </Combobox.Trigger>
      <Combobox.Input aria-label="Search materials" placeholder="Search materials" />
      <Combobox.Popover>
        <Combobox.Empty>No matching materials</Combobox.Empty>
        <Combobox.List>
          {(item: string) => (
            <Combobox.Item key={item} value={item}>
              {item}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Popover>
    </Combobox>
  )
}
```

`Combobox.Button` is the styled convenience trigger with a value, placeholder,
and caret. Its `className` goes after its own classes, so where yours and one
of its own set the same thing, such as the ring color, yours is used. Use
`Combobox.Trigger` when you need custom trigger attributes or rendering. Keep the input beside the trigger; it appears while the popup is open.

### Menus

Use the `render` prop to make the trigger a Button without nesting two buttons:

```tsx
import { Button, Menu } from '@toolpath/ui'

export const PartMenu = ({ onRename }: { onRename: () => void }) => (
  <Menu>
    <Menu.Trigger nativeButton render={<Button>Part actions</Button>} />
    <Menu.Popover>
      <Menu.Item onClick={onRename}>Rename</Menu.Item>
      <Menu.Divider />
      <Menu.Item disabled>Download unavailable</Menu.Item>
    </Menu.Popover>
  </Menu>
)
```

For a right-click menu, use `<Menu context>` and put the target inside
`Menu.Trigger`. Submenus use `Menu.Submenu`, `Menu.SubmenuTrigger`, and their own
`Menu.Popover`.

### Tool dock

`ToolDock` is a toolbar for more tools than fit on a bar. It has two layouts:

- `spread`: the pinned tools sit on the bar as buttons. **All tools** opens a
  panel with every tool, a column per group, where each tool can be flipped and
  pinned.
- `grouped`: each group is a menu of its tools on the bar, and the pinned
  tools sit on the bar as buttons beside the menus. Each row in a menu has a
  pin too.

The two layouts share one list of pins, so a tool pinned in one is on the bar
in the other.

The tools are plain data: each has an `id`, `label`, `icon` and `onClick`, an
optional `note`, `on` (leave it out for an action, such as a camera move) and
`gate` (why it cannot work yet; it is dimmed, and its click still calls
`onClick`). A switch keeps its menu or panel open; an action closes it.
`@toolpath/viewer`'s `viewerToolGroups` gives the viewer's toolbar controls in
this shape.

Pick the layout each app opens in with `defaultLayout`, and its first pins with
`defaultPins`. To keep the layout or the pins, hold them yourself
with `layout` and `onLayoutChange`, or `pins` and `onPinsChange`; the dock saves
nothing. Children
go at the end of the bar. Put `ToolDock.LayoutToggle` among them, such as in a
settings menu, to let people switch layouts. A control of your own there can
read and set the layout with `ToolDock.useToolDock()`.

Every menu and panel from the bar opens 4px above it. A popup of your own
there can do the same with `ToolDock.useBarPopout()`: put its `trigger` ref on
the button, and its `anchor` and `sideOffset` on the popup. `useToolDock()`
also gives the bar.

The dock's focus ring is gray (`focus-visible:ring-zinc-300`), and
`LayoutToggle` has it too. Give a kit control of your own in a dock menu the
same ring, such as `<Combobox.Button className="ring-zinc-300 focus-visible:border-zinc-300" />`.

```tsx
import { Menu, ToolDock, type DockGroup } from '@toolpath/ui'

export const PartTools = ({ groups }: { groups: Array<DockGroup> }) => (
  <ToolDock groups={groups} defaultLayout="grouped" defaultPins={['section', 'measure']}>
    <Settings />
  </ToolDock>
)

const Settings = () => {
  const popout = ToolDock.useBarPopout<HTMLButtonElement>()
  return (
    <Menu>
      <Menu.Trigger>
        <button ref={popout.trigger}>…</button>
      </Menu.Trigger>
      <Menu.Popover
        side="top"
        anchor={popout.anchor}
        sideOffset={popout.sideOffset}
        className="dark"
      >
        Toolbar layout <ToolDock.LayoutToggle />
      </Menu.Popover>
    </Menu>
  )
}
```

The dock is dark in either theme. It floats over a 3D view, and a bar that
turned white with the page would be the brightest thing over the part. Its
menus and panels carry `dark` too, as they open outside the bar; give a popup
of your own there the `dark` class to match. Its tooltips are on the bar's own
plate: a bar button's opens 4px above the bar, and a row's in All tools 4px
above the row. Wrap a control of your own on the bar in `ToolDock.Tooltip` for
the same.

### Confirmations

Wrap the part of the application that opens confirmations in `Dialog.Provider`.
The hook must be called by a descendant of that provider.

```tsx
import { Button, Dialog } from '@toolpath/ui'

const RemoveButton = ({ onRemove }: { onRemove: () => void }) => {
  const { confirm } = Dialog.useDialog()

  const remove = async () => {
    const accepted = await confirm(
      <Dialog variant="danger">
        <Dialog.Title>Remove this part?</Dialog.Title>
        <Dialog.Message>This removes the part from your project.</Dialog.Message>
        <Dialog.Actions>
          <Dialog.Dismiss>Keep part</Dialog.Dismiss>
          <Dialog.Confirm>Remove part</Dialog.Confirm>
        </Dialog.Actions>
      </Dialog>,
    )
    if (accepted) {
      onRemove()
    }
  }

  return <Button onClick={remove}>Remove part</Button>
}

export const RemovePart = ({ onRemove }: { onRemove: () => void }) => (
  <Dialog.Provider>
    <RemoveButton onRemove={onRemove} />
  </Dialog.Provider>
)
```

`confirm` resolves to `true` on confirmation and `false` on dismissal, including
Escape. Await one confirmation before opening another; the provider has one active
confirmation slot. Supported Dialog variants are `danger` and `success`.

### Toasts and notifications

Both systems need their provider **and** a list to display messages. They have
separate managers and can be nested. This example uses Notification's description
for the visible message and Toast's title/description for a longer message.

```tsx
import { Button, Notification, Toast } from '@toolpath/ui'

const FeedbackButtons = () => {
  const notifications = Notification.useNotificationManager()
  const toasts = Toast.useToastManager()

  return (
    <div className="flex gap-2">
      <Button onClick={() => notifications.add({ description: 'Part saved.', variant: 'success' })}>
        Show notification
      </Button>
      <Button
        onClick={() => toasts.add({ title: 'Export ready', description: 'Your file is ready.' })}
      >
        Show toast
      </Button>
    </div>
  )
}

export const FeedbackExample = () => (
  <Notification.Provider>
    <Toast.Provider>
      <FeedbackButtons />
      <Notification.List />
      <Toast.List />
    </Toast.Provider>
  </Notification.Provider>
)
```

Manager `add` returns a message ID; retain it for `update` or `close`. Notification
variants are `info`, `warning`, `danger`, and `success`. Toast also supports custom
content through `data.content`. `timeout: 0` disables automatic dismissal;
`data.persistent: true` disables swipe dismissal. The standard toast still has
a close button.

### Tables

Pass a header element and a function that renders each row. Start with
`virtualized={false}` for a small list; virtualization is enabled by default.

```tsx
import { Table } from '@toolpath/ui'

const parts = [
  { id: 'bracket', name: 'Bracket', quantity: 10 },
  { id: 'plate', name: 'Plate', quantity: 4 },
]

export const PartsTable = () => (
  <div className="h-64">
    <Table
      data={parts}
      virtualized={false}
      header={
        <Table.HeaderRow>
          <Table.HeaderCell sortKey="name">Part</Table.HeaderCell>
          <Table.HeaderCell sortKey="quantity">Quantity</Table.HeaderCell>
        </Table.HeaderRow>
      }
    >
      {(part) => (
        <Table.Row key={part.id}>
          <Table.Cell>{part.name}</Table.Cell>
          <Table.Cell>{part.quantity}</Table.Cell>
        </Table.Row>
      )}
    </Table>
  </div>
)
```

Use stable row IDs. Selection (`select` or `multiselect`) requires an `id` on every
record and uses `selectedRows` / `setSelectedRows`. `defaultSort` accepts a column
index, header `sortKey`, or `[key, 'asc' | 'desc']`; `onSortChange` reports sorting.
Give scrollable or virtualized tables an explicitly sized parent. Tree and grouped
modes cannot be combined. Column layout is stored in localStorage when you supply
a table `id`; use a distinct ID for each table layout.

### Resizable panels

```tsx
import { Panels } from '@toolpath/ui'

export const Workspace = () => (
  <Panels.Group orientation="horizontal" className="h-80">
    <Panels.Panel defaultSize="30%" minSize="160px">
      Part list
    </Panels.Panel>
    <Panels.Separator />
    <Panels.Panel>Part details</Panels.Panel>
  </Panels.Group>
)
```

Panels use the `react-resizable-panels` v4 API. Numeric sizes are pixels; use strings
such as `"30%"` for percentages. Collapsible panels show `Panels.Collapsed` at their
collapsed size. The `Panels` namespace also exposes layout persistence and
imperative ref hooks; use the installed types for their options.

### Routing and callouts

`Link` renders an anchor by default. `LinkProvider` accepts a `component` implementing
`LinkComponentProps`; for an application router, map its `href` to the router's
navigation prop and forward the anchor attributes and ref. Buttons with `asLink`,
breadcrumbs, and link-style tabs use the same provider.

Callouts have a stable `id`, `Callout.Trigger`, and `Callout.Content`. By default,
dismissal persists in localStorage, shared across apps
on the same origin. Use unique IDs, or set `rememberDismissed={false}` for local
component state. `useDismissedCallouts().reset(id)` clears a remembered dismissal;
`reset()` clears all remembered callouts for that origin.

## DFM views

The DFM (design for manufacturing) views are here: the rule list, the reach
chart and the feature panel. The rules and the checker they show are
[`@toolpath/dfm`](https://www.npmjs.com/package/@toolpath/dfm), which has no
React and no CSS; this package installs it. The theme above covers the views'
classes, so they need no stylesheet of their own.

### Rule list

`RuleList` shows each rule written as the sentence it is — "Holes with L/D to
top of part ≥ 8" — whose words are its fields, beside its colour and how many
of a part's features break it. Under the list, Import and Export share a rule
set as one JSON file. The rules are an input: the app keeps them and passes
them in with the functions that change them.

```tsx
import { RuleList, type DfmRules } from '@toolpath/ui'
import { checkPart, dfmFeatures } from '@toolpath/dfm'

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

`actions` puts the app's own buttons at the end of the footer's row, after
Import… and Export — a way back to the app's default rules, say, since neither
package has any of its own. The list has no LLM button. An app that wants one
adds it here, over `llmRulePrompt` from `@toolpath/dfm`:

```tsx
import { Button, RuleList, type DfmRules, type RuleListProps } from '@toolpath/ui'
import { llmRulePrompt } from '@toolpath/dfm'

const copyPrompt = (rules: DfmRules) => navigator.clipboard.writeText(llmRulePrompt(rules.rules))

export const Rules = ({ rules, ...props }: RuleListProps) => (
  <RuleList
    rules={rules}
    {...props}
    actions={
      <Button variant="secondary" onClick={() => void copyPrompt(rules)}>
        Copy LLM prompt
      </Button>
    }
  />
)
```

For turning rules, pass `vocabulary={TURNING_RULES}`:

```tsx
import { RuleList } from '@toolpath/ui'
import { TURNING_RULES, checkTurnedPart, turnedStretches } from '@toolpath/dfm'

// From a part analysis's `turning.features`.
const stretches = turnedStretches(report.turning.features)
const check = checkTurnedPart(stretches, rules.rules)

<RuleList
  rules={rules}
  vocabulary={TURNING_RULES}
  check={check}
  features={stretches}
  sheets={{}}
  units="mm"
  {...rest}
/>
```

### Reach chart

`ReachChart` draws a feature's reach curve: the section through the part at the
feature's wall, to scale. The feature is on the left, in blue; the walls step up
on the right, with their heights and their distances from the feature written
on. Pointing at the walls reads the curve at that distance.

```tsx
import { ReachChart, ReachDrawing } from '@toolpath/ui'
import { featureProfile, readReachCurve } from '@toolpath/dfm'

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

### Feature panel

`FeaturePanel` is the card a click on the part opens: every feature the face
belongs to, then the details of the one being read. With several faces
shift-clicked, each face's candidates sit under a letter, above a table of
what each was read as. It fills what it is put in — where it sits, and
whether it can be dragged, is the app's — and the app decides what a click
means: which faces, which candidates in which order, which is read.

```tsx
import { FeatureDetails, FeaturePanel, storageFolds } from '@toolpath/ui'
import { brokenRules, featureMeasurements, featureProfile } from '@toolpath/dfm'

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

A turned feature reads the same way: give `FeaturePanel`, `CandidateList` and
`FeatureDetails` `vocabulary={TURNING_RULES}` and a stretch from
`turnedStretches`, and the feature is named as a turned one — "OD groove from
both ends", "Machined from both ends" — with its considerations under
"Turning considerations". Milling is the default.

- **Rules broken** are `BrokenRule` rows: a colour, the rule's text, the figure
  that broke it, and optionally the limit and a note on hover. `brokenRules`
  builds them from `@toolpath/dfm`'s check; an app with a checker of its own
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

## Troubleshooting

| Symptom                                       | Check                                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components are unstyled                       | Ensure Tailwind v4 processes the stylesheet, both CSS imports are present, and the compiled stylesheet is loaded. Importing the JS alone does not load CSS. |
| A popup stays light in a dark page            | Put `dark` on `<html>`, so portaled content inherits it too.                                                                                                |
| Fonts look different                          | Load the font files yourself; the theme only declares family names and fallbacks.                                                                           |
| A feedback hook throws, or no message appears | Call the hook below its matching provider and render that system's `List`.                                                                                  |
| A form does not submit                        | Set `type="submit"`, and put submission logic on the form's `onSubmit` rather than the Button's `onClick`.                                                  |
| A loading button can still be activated       | Set `disabled` as well as `isLoading`.                                                                                                                      |
| An import cannot be resolved                  | Use root exports; icons, `ListItem`, and unit preference helpers are not exported by this package.                                                          |

## Working on this package

From the repository root, using its pinned toolchain:

```sh
pnpm --filter @toolpath/ui build
pnpm --filter @toolpath/ui check-types
pnpm --filter @toolpath/ui test
pnpm test:ui-package
```

The package test command builds first. `test:ui-package` checks that the tarball
contains JavaScript, declarations, the theme, and the component source Tailwind
scans. When changing packaging or styling, also try a packed install in a consumer;
workspace resolution can hide missing files or dependencies.

Keep usage examples consistent with the public exports. Components and their
helpers belong here; shared application logic belongs in `@toolpath/app-support`.
See the repository's [contributor guide](https://github.com/toolpath/ui-packages/blob/main/AGENTS.md)
for release and validation rules, and the [changelog](https://github.com/toolpath/ui-packages/blob/main/packages/ui/CHANGELOG.md)
for published changes.

## License

[MIT](https://github.com/toolpath/ui-packages/blob/main/packages/ui/LICENSE).

### Combined body results

`BodyDfmResults` displays a `combineBodyChecks` summary from `@toolpath/dfm`.
Pass `tab="rules"` or `tab="features"`, `units`, and
`onInspect(bodyId, featureTag)`. The Rules tab lists every rule as the rule list
does, with how many features break it in all bodies together, and opens into the
bodies that break it and then their features. The Features tab lists each body
with how many features of each kind it has and how many break a rule, and opens
into its groups and then their features, each marked with `SeverityIcon`. Pass
`featureGroups` (each body's `BodyFeatureGroup`s, by id) for an application's
own kinds of feature, colours and measurements; a body without them is grouped
by feature type. Optional `onHover(bodyId, featureTag | null)`,
`onHoverRule(ruleId | null, bodyId | null)`, `onHoverFeatures(focus | null)` and
`onRetry(bodyId)` connect the rows to an application's viewer and retries, and
`bodyColors` puts each body's colour beside its name. Pending and failed checks
remain explicit alongside available results; the application owns analysis and
selection.
