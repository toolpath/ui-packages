import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Table } from '../src'

interface Tool {
  id: string
  tool: { name: string }
}

const data: Tool[] = [
  { id: 'a', tool: { name: 'Alpha' } },
  { id: 'b', tool: { name: 'Bravo' } },
  { id: 'c', tool: { name: 'Charlie' } },
]

const header = (
  <Table.HeaderRow>
    <Table.HeaderCell>Name</Table.HeaderCell>
  </Table.HeaderRow>
)

// Reads a field of the item, as a real row does: a group header handed to it
// as if it were a row throws here.
const row = ({ tool }: Tool) => (
  <Table.Row>
    <Table.Cell>{tool.name}</Table.Cell>
  </Table.Row>
)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Table, grouped and not virtualized', () => {
  const grouped = (over: Partial<Parameters<typeof Table<Tool>>[0]> = {}) => {
    const children = vi.fn(row)
    render(
      <Table
        data={data}
        header={header}
        select
        selectedRows={{ id: null, ids: [] }}
        setSelectedRows={() => {}}
        virtualized={false}
        grouped={{ counts: [2, 1], header: (i) => (i === 0 ? 'Fits' : 'Closest') }}
        {...over}
      >
        {children}
      </Table>,
    )
    return children
  }

  it('renders each group under its header, and hands only data rows to children', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const children = grouped()
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    // Each group's header is a row of its own, and only that.
    expect(screen.getByRole('button', { name: 'Closest' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fits' })).toBeInTheDocument()
    expect(new Set(children.mock.calls.map(([item]) => item.id))).toEqual(new Set(['a', 'b', 'c']))
    // No missing-key warning from the plain body.
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/unique "key"/)
  })

  it('folds a group away from its header', () => {
    grouped()
    fireEvent.click(screen.getByRole('button', { name: 'Closest' }))
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it("shows a group's empty state where it has no rows", () => {
    grouped({
      grouped: {
        counts: [3, 0],
        header: (i) => (i === 0 ? 'Fits' : 'Closest'),
        emptyState: () => 'Nothing comes close',
      },
    })
    expect(screen.getByText('Nothing comes close')).toBeInTheDocument()
  })
})

describe('Table, not virtualized', () => {
  it('renders every row', () => {
    render(
      <Table data={data} header={header} virtualized={false}>
        {row}
      </Table>,
    )
    expect(screen.getAllByText(/Alpha|Bravo|Charlie/)).toHaveLength(3)
  })

  it('shows the empty state for no data', () => {
    render(
      <Table data={[] as Tool[]} header={header} virtualized={false}>
        {row}
      </Table>,
    )
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })
})
