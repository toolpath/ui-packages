# Toolpath UI

`@toolpath/ui` is Toolpath's React component kit for applications that use the
Toolpath Engine API. It is intentionally Tailwind-first and uses Toolpath's
shared design tokens.

**It is styling and display, and nothing else.** This package is the surface
[Storybook](https://storybook.staging.toolpath.com) documents: a resource for
reusable UI elements and a guide for building them. Code that persists a
preference, reads a route, calls an API or holds application state belongs in
[`@toolpath/app-support`](https://www.npmjs.com/package/@toolpath/app-support),
which renders nothing and which this package does not depend on.

## Install

```sh
npm install @toolpath/ui react react-dom tailwindcss
```

## Tailwind v4 setup

Import Tailwind and the Toolpath theme in your application stylesheet. The
theme scans the package's component source, provides the Toolpath tokens, and
uses the document's `dark` class for dark mode.

```css
@import 'tailwindcss';
@import '@toolpath/ui/theme.css';
```

Load Open Sans, Nunito, and Roboto Mono to use the exact Toolpath typography.

## Use components

```tsx
import { Button, Input } from '@toolpath/ui'

export const PartForm = () => (
  <form className="space-y-4">
    <Input id="part-name" name="part-name" placeholder="Part name" />
    <Button variant="primary" type="submit">
      Analyze part
    </Button>
  </form>
)
```

Components retain their existing `className` extension points so applications
can layer their own Tailwind utilities. The package exports UI primitives only:
Toolpath's icon library and `list-item` components are intentionally not part of
the public API.

## Table

`Table` takes the rows as `data` (each with an `id` when rows can be
selected), a header row, and a function that renders one row. Column widths are
CSS grid track sizes. Rows are virtualized by default; the table's parent then
needs a height. `virtualized={false}` renders every row instead.

```tsx
import { Table, type TableSelectedRows } from '@toolpath/ui'
import { useState } from 'react'

interface ToolRow {
  id: string
  name: string
  diameter: number
}

export const ToolTable = ({ tools }: { tools: ToolRow[] }) => {
  const [selected, setSelected] = useState<TableSelectedRows>({ id: null, ids: [] })
  return (
    <div className="h-80">
      <Table
        data={tools}
        select
        selectedRows={selected}
        setSelectedRows={setSelected}
        header={
          <Table.HeaderRow>
            <Table.HeaderCell width="minmax(160px, 2fr)" sortKey="name">
              Name
            </Table.HeaderCell>
            <Table.HeaderCell width="80px">DC</Table.HeaderCell>
          </Table.HeaderRow>
        }
      >
        {(tool) => (
          <Table.Row>
            <Table.Cell>{tool.name}</Table.Cell>
            <Table.Cell className="font-mono">{tool.diameter}</Table.Cell>
          </Table.Row>
        )}
      </Table>
    </div>
  )
}
```

`grouped` splits `data`, in order, into runs of `counts`, each under a header
that folds it away. Virtualized, the header of the group in view also stays
pinned at the top of the table; with `virtualized={false}` each header is only
its own row. The row function is only called for rows of `data`.

```tsx
<Table
  data={[...fitting, ...closest]}
  header={header}
  virtualized={false}
  grouped={{
    counts: [fitting.length, closest.length],
    header: (index) => (index === 0 ? 'Fits' : 'Closest'),
    emptyState: () => 'Nothing here',
  }}
>
  {(tool) => <ToolRowView tool={tool} />}
</Table>
```

## Tree

`Tree` draws nested nodes to choose from — folders, libraries, a part's
features — with chevrons, indentation and the selected row highlighted. Which
nodes are open and which is selected are the caller's state. A node can be
`disabled` (greyed, not selectable) or `muted` (greyed, still selectable), and
`selectableBranches={false}` makes a click on a branch open it instead of
selecting it.

```tsx
import { Tree, type TreeNode } from '@toolpath/ui'
import { useState } from 'react'

const nodes: TreeNode[] = [
  {
    id: 'local',
    label: 'Local',
    children: [
      { id: 'mills', label: 'End mills' },
      { id: 'archive', label: 'Archive', muted: true, title: 'No tools' },
    ],
  },
]

export const Libraries = () => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(['local']))
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <Tree
      aria-label="Tool libraries"
      nodes={nodes}
      expanded={expanded}
      onToggle={(id, open) =>
        setExpanded((was) => {
          const next = new Set(was)
          if (open) next.add(id)
          else next.delete(id)
          return next
        })
      }
      selected={selected}
      onSelect={(node) => setSelected(node.id)}
    />
  )
}
```

It follows the WAI-ARIA tree pattern: `role="tree"` and `treeitem`s with
`aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` and
`aria-selected`, one tab stop, and Up/Down, Home/End, Right (open, or step in),
Left (close, or step out), and Enter or Space to select.
