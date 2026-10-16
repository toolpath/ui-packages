# Toolpath UI

React components and a Tailwind CSS theme for Toolpath applications: form controls,
menus, dialogs, tables, resizable panels, and feedback. No Engine API key or SDK is
required to use this package.

- [Install and configure styles](#install)
- [Quick start](#quick-start)
- [Theme and dark mode](#theme-and-dark-mode)
- [Component catalog](#component-catalog)
- [Composition examples](#composition-examples)
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
and caret. Use `Combobox.Trigger` when you need custom trigger attributes or
rendering. Keep the input beside the trigger; it appears while the popup is open.

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
