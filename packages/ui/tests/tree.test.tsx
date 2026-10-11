import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tree, type TreeNode } from '../src'
import { treeKey, visibleRows } from '../src/tree/tree-rows'

const nodes: TreeNode[] = [
  {
    id: 'local',
    label: 'Local',
    children: [
      { id: 'mills', label: 'Mills' },
      { id: 'drills', label: 'Drills', disabled: true },
      { id: 'empty', label: 'Empty folder', muted: true, children: [] },
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    children: [{ id: 'shop', label: 'Shop', children: [{ id: 'syil', label: 'Syil' }] }],
  },
]

afterEach(cleanup)

const item = (name: string) => screen.getByRole('treeitem', { name })

/** A tree holding its own state, as a caller would. */
const Harness = ({
  onSelect = () => {},
  selectableBranches,
  initial = ['local'],
}: {
  onSelect?: (node: TreeNode) => void
  selectableBranches?: boolean
  initial?: string[]
}) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(initial))
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <Tree
      aria-label="Libraries"
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
      onSelect={(node) => {
        setSelected(node.id)
        onSelect(node)
      }}
      selectableBranches={selectableBranches}
    />
  )
}

describe('visibleRows', () => {
  it('flattens the tree through the open nodes, with depth and position', () => {
    const rows = visibleRows(nodes, new Set(['cloud', 'shop']))
    expect(
      rows.map((row) => [row.node.id, row.depth, row.parentId, row.posInSet, row.setSize]),
    ).toEqual([
      ['local', 0, null, 1, 2],
      ['cloud', 0, null, 2, 2],
      ['shop', 1, 'cloud', 1, 1],
      ['syil', 2, 'shop', 1, 1],
    ])
  })
})

describe('treeKey', () => {
  const rows = visibleRows(nodes, new Set(['local']))

  it('moves with Up, Down, Home and End, and stops at the ends', () => {
    expect(treeKey(rows, 'local', 'ArrowDown')).toEqual({ type: 'focus', id: 'mills' })
    expect(treeKey(rows, 'local', 'ArrowUp')).toEqual({ type: 'focus', id: 'local' })
    expect(treeKey(rows, 'mills', 'End')).toEqual({ type: 'focus', id: 'cloud' })
    expect(treeKey(rows, 'cloud', 'Home')).toEqual({ type: 'focus', id: 'local' })
    expect(treeKey(rows, 'cloud', 'ArrowDown')).toEqual({ type: 'focus', id: 'cloud' })
  })

  it('opens or steps in with Right, closes or steps out with Left', () => {
    expect(treeKey(rows, 'cloud', 'ArrowRight')).toEqual({ type: 'expand', id: 'cloud' })
    expect(treeKey(rows, 'local', 'ArrowRight')).toEqual({ type: 'focus', id: 'mills' })
    expect(treeKey(rows, 'mills', 'ArrowRight')).toBeNull()
    expect(treeKey(rows, 'local', 'ArrowLeft')).toEqual({ type: 'collapse', id: 'local' })
    expect(treeKey(rows, 'mills', 'ArrowLeft')).toEqual({ type: 'focus', id: 'local' })
    expect(treeKey(rows, 'cloud', 'ArrowLeft')).toBeNull()
  })

  it('selects with Enter and Space, but not a disabled node', () => {
    expect(treeKey(rows, 'mills', 'Enter')).toEqual({ type: 'select', id: 'mills' })
    expect(treeKey(rows, 'local', ' ')).toEqual({ type: 'select', id: 'local' })
    expect(treeKey(rows, 'drills', 'Enter')).toBeNull()
  })

  it('opens and closes a branch on Enter where branches cannot be selected', () => {
    expect(treeKey(rows, 'local', 'Enter', false)).toEqual({ type: 'collapse', id: 'local' })
    expect(treeKey(rows, 'cloud', ' ', false)).toEqual({ type: 'expand', id: 'cloud' })
    expect(treeKey(rows, 'mills', 'Enter', false)).toEqual({ type: 'select', id: 'mills' })
  })

  it('does nothing in an empty tree or for another key', () => {
    expect(treeKey([], null, 'ArrowDown')).toBeNull()
    expect(treeKey(rows, 'local', 'a')).toBeNull()
  })
})

describe('Tree', () => {
  it('is a tree of treeitems with their level, position and state', () => {
    render(<Harness />)
    expect(screen.getByRole('tree', { name: 'Libraries' })).toBeInTheDocument()
    expect(item('Local')).toHaveAttribute('aria-expanded', 'true')
    expect(item('Local')).toHaveAttribute('aria-level', '1')
    expect(item('Mills')).toHaveAttribute('aria-level', '2')
    expect(item('Mills')).toHaveAttribute('aria-posinset', '1')
    expect(item('Mills')).toHaveAttribute('aria-setsize', '3')
    expect(item('Mills')).not.toHaveAttribute('aria-expanded')
    expect(item('Cloud')).toHaveAttribute('aria-expanded', 'false')
    expect(item('Drills')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('treeitem', { name: 'Shop' })).not.toBeInTheDocument()
  })

  it('is one tab stop, the first row until something is selected', () => {
    render(<Harness />)
    const stops = screen.getAllByRole('treeitem').filter((row) => row.tabIndex === 0)
    expect(stops).toEqual([item('Local')])
  })

  it('selects a row, a branch included, on a click', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    fireEvent.click(item('Mills'))
    expect(item('Mills')).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(item('Cloud'))
    expect(item('Cloud')).toHaveAttribute('aria-selected', 'true')
    expect(item('Mills')).toHaveAttribute('aria-selected', 'false')
    expect(onSelect.mock.calls.map(([node]) => node.id)).toEqual(['mills', 'cloud'])
    // Still shut: selecting a branch does not open it.
    expect(item('Cloud')).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects a muted node, and never a disabled one', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    fireEvent.click(item('Drills'))
    fireEvent.keyDown(item('Drills'), { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(item('Empty folder'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('opens and closes on the chevron without selecting', () => {
    const onSelect = vi.fn()
    const { container } = render(<Harness onSelect={onSelect} />)
    const toggle = item('Cloud').querySelector('[data-tree-toggle]')!
    fireEvent.click(toggle)
    expect(item('Cloud')).toHaveAttribute('aria-expanded', 'true')
    expect(item('Shop')).toBeInTheDocument()
    fireEvent.click(item('Cloud').querySelector('[data-tree-toggle]')!)
    expect(screen.queryByRole('treeitem', { name: 'Shop' })).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
    // A leaf, and an empty folder, have no chevron.
    expect(item('Mills').querySelector('[data-tree-toggle]')).toBeNull()
    expect(container.querySelectorAll('[data-tree-toggle]')).toHaveLength(2)
  })

  it('walks, opens, closes and selects from the keyboard, moving focus with it', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    const tree = screen.getByRole('tree')
    item('Local').focus()
    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    expect(item('Mills')).toHaveFocus()
    expect(item('Mills').tabIndex).toBe(0)
    fireEvent.keyDown(tree, { key: 'End' })
    expect(item('Cloud')).toHaveFocus()
    fireEvent.keyDown(tree, { key: 'ArrowRight' })
    expect(item('Cloud')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(tree, { key: 'ArrowRight' })
    expect(item('Shop')).toHaveFocus()
    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    expect(item('Cloud')).toHaveFocus()
    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    expect(item('Cloud')).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(tree, { key: 'Home' })
    fireEvent.keyDown(tree, { key: ' ' })
    expect(onSelect.mock.calls.map(([node]) => node.id)).toEqual(['local'])
  })

  it('opens and closes a branch instead of selecting it where branches cannot be selected', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} selectableBranches={false} />)
    fireEvent.click(item('Cloud'))
    expect(item('Cloud')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(item('Shop'))
    expect(item('Shop')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(item('Syil'))
    expect(onSelect.mock.calls.map(([node]) => node.id)).toEqual(['syil'])
  })

  it('makes the selected row the tab stop when it is showing', () => {
    render(
      <Tree
        aria-label="Libraries"
        nodes={nodes}
        expanded={new Set(['local'])}
        onToggle={() => {}}
        selected="mills"
        onSelect={() => {}}
      />,
    )
    expect(item('Mills').tabIndex).toBe(0)
    expect(item('Local').tabIndex).toBe(-1)
  })
})
