import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { TreeGroup, TreeGuide } from '../src'

const Group = ({ initial = true }: { initial?: boolean }) => {
  const [expanded, setExpanded] = useState(initial)
  return (
    <TreeGroup label="Fixture" expanded={expanded} onExpandedChange={setExpanded}>
      <TreeGroup.Header>
        <TreeGroup.Toggle />
        Fixture
      </TreeGroup.Header>
      <TreeGroup.Items>
        <div>
          <TreeGuide />
          Plate
        </div>
        <div>
          <TreeGuide last />
          Bolt
        </div>
      </TreeGroup.Items>
    </TreeGroup>
  )
}

describe('TreeGroup', () => {
  it('shows its items as a named group the toggle says is expanded and controls', () => {
    render(<Group />)
    const toggle = screen.getByRole('button', { name: 'Collapse Fixture' })
    const items = screen.getByRole('group', { name: 'Fixture' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', items.id)
    expect(items).toHaveTextContent('Plate')
    expect(items).toHaveTextContent('Bolt')
  })

  it('folds its items away and back from the toggle', () => {
    render(<Group />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Fixture' }))
    const toggle = screen.getByRole('button', { name: 'Expand Fixture' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).not.toHaveAttribute('aria-controls')
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText('Plate')).toBeNull()
    // The header stays.
    expect(screen.getByText('Fixture')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('group', { name: 'Fixture' })).toHaveTextContent('Plate')
  })

  it('starts collapsed when told to', () => {
    render(<Group initial={false} />)
    expect(screen.getByRole('button', { name: 'Expand Fixture' })).toBeInTheDocument()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('refuses a part rendered outside a group', () => {
    expect(() => render(<TreeGroup.Toggle />)).toThrow('inside a TreeGroup')
  })
})

describe('TreeGroup.Toggle with a reason it is disabled', () => {
  const Held = () => {
    const [expanded, setExpanded] = useState(true)
    return (
      <TreeGroup label="Fixture" expanded={expanded} onExpandedChange={setExpanded}>
        <TreeGroup.Header>
          <TreeGroup.Toggle disabledReason="Clear the search to fold" />
        </TreeGroup.Header>
        <TreeGroup.Items>Plate</TreeGroup.Items>
      </TreeGroup>
    )
  }

  it('stays focusable, says it is unavailable and why, and does nothing when pressed', async () => {
    render(<Held />)
    await userEvent.tab()
    const toggle = screen.getByRole('button', { name: 'Collapse Fixture' })
    expect(toggle).toHaveFocus()
    expect(toggle).not.toBeDisabled()
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    expect(toggle).toHaveAccessibleDescription('Clear the search to fold')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(toggle)
    expect(screen.getByRole('group', { name: 'Fixture' })).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows its reason as a tooltip on focus', async () => {
    render(<Held />)
    // Once in its description, and once more in the tooltip that opens.
    expect(screen.getAllByText('Clear the search to fold')).toHaveLength(1)
    await userEvent.tab()
    expect(await screen.findAllByText('Clear the search to fold')).toHaveLength(2)
  })

  it('shows its reason as a tooltip on hover', async () => {
    render(<Held />)
    await userEvent.hover(screen.getByRole('button', { name: 'Collapse Fixture' }))
    expect(await screen.findAllByText('Clear the search to fold')).toHaveLength(2)
  })

  it('is a 24px target by default', () => {
    render(<Held />)
    expect(screen.getByRole('button', { name: 'Collapse Fixture' })).toHaveClass('size-6')
  })
})

describe('TreeGroup props', () => {
  it('passes HTML props and refs to its root, header and items', () => {
    const root = createRef<HTMLDivElement>()
    const header = createRef<HTMLDivElement>()
    const items = createRef<HTMLDivElement>()
    render(
      <TreeGroup
        ref={root}
        label="Fixture"
        expanded
        onExpandedChange={() => undefined}
        className="mt-2"
        data-testid="root"
      >
        <TreeGroup.Header ref={header} className="px-4" data-testid="header">
          Fixture
        </TreeGroup.Header>
        <TreeGroup.Items ref={items} className="pl-2" data-testid="items">
          Plate
        </TreeGroup.Items>
      </TreeGroup>,
    )
    expect(root.current).toBe(screen.getByTestId('root'))
    expect(header.current).toBe(screen.getByTestId('header'))
    expect(items.current).toBe(screen.getByRole('group', { name: 'Fixture' }))
    expect(root.current).toHaveClass('mt-2', 'border-b')
    expect(header.current).toHaveClass('px-4', 'bg-gray-50')
    expect(items.current).toHaveClass('pl-2')
  })

  it('draws one rule between groups: an end below each, none above its header', () => {
    render(
      <>
        <TreeGroup label="A" expanded onExpandedChange={() => undefined} data-testid="a">
          <TreeGroup.Header data-testid="header">A</TreeGroup.Header>
        </TreeGroup>
        <TreeGroup label="B" expanded onExpandedChange={() => undefined}>
          <TreeGroup.Header>B</TreeGroup.Header>
        </TreeGroup>
      </>,
    )
    expect(screen.getByTestId('a')).toHaveClass('border-b')
    expect(screen.getByTestId('header').className).not.toMatch(/border-t/)
  })
})

describe('TreeGuide', () => {
  it('is hidden from assistive technology, and marks the last item', () => {
    const { container } = render(
      <>
        <TreeGuide />
        <TreeGuide last className="absolute inset-y-0" />
      </>,
    )
    const [guide, last] = [...container.children]
    expect(guide).toHaveAttribute('aria-hidden', 'true')
    expect(guide).not.toHaveAttribute('data-last')
    expect(last).toHaveAttribute('data-last', 'true')
    // A placement given replaces its own, rather than fighting it.
    expect(last).toHaveClass('absolute')
    expect(last).not.toHaveClass('relative')
  })

  it('runs the line through the row, and stops the last one at its branch', () => {
    const { container } = render(
      <>
        <TreeGuide branchAt="28px" />
        <TreeGuide branchAt="28px" last />
      </>,
    )
    const [through, last] = [...container.children].map(
      (guide) => [...guide.children] as Array<HTMLElement>,
    )
    expect(through[0]!.style.bottom).toBe('-1px')
    expect(through[1]!.style.top).toBe('28px')
    expect(last[0]!.style.height).toBe('28px')
  })
})
