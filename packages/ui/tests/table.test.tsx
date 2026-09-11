import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Table } from '../src'

interface Part {
  id: number
  catalogNumber: string
}

const data: Array<Part> = [
  { id: 1, catalogNumber: 'B' },
  { id: 2, catalogNumber: 'A' },
]

/**
 * A sortable heading that also carries a control, which is what the table
 * library's own header cell cannot do: it wraps the whole cell in a `<button>`.
 */
const Sortable = ({ onFilter = () => undefined }: { onFilter?: () => void }) => (
  <Table
    virtualized={false}
    data={data}
    header={
      <Table.HeaderRow>
        <Table.HeaderCell sortKey="catalogNumber">
          <Table.HeaderCellContent
            accessory={
              <Table.HeaderCellInteractive>
                <button type="button" aria-label="Filter by Catalog number" onClick={onFilter} />
              </Table.HeaderCellInteractive>
            }
          >
            Catalog number
          </Table.HeaderCellContent>
        </Table.HeaderCell>
      </Table.HeaderRow>
    }
  >
    {(item: Part) => (
      <Table.Row item={item}>
        <Table.Cell>{item.catalogNumber}</Table.Cell>
      </Table.Row>
    )}
  </Table>
)

// Nothing configures Testing Library's automatic cleanup in this package, so
// a left-behind table would answer the next test's queries.
afterEach(cleanup)

describe('Table.HeaderCell', () => {
  it('keeps a heading accessory out of the button that sorts the column', () => {
    const { container } = render(<Sortable />)

    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter by Catalog number' })).toBeInTheDocument()
  })

  it('sorts on the heading and leaves the accessory its own press', () => {
    let filtered = 0
    render(<Sortable onFilter={() => (filtered += 1)} />)

    const heading = screen.getByRole('button', { name: 'Catalog number' })
    const order = () => screen.getAllByRole('gridcell').map((cell) => cell.textContent)

    expect(order()).toEqual(['B', 'A'])

    fireEvent.click(heading)
    expect(order()).toEqual(['A', 'B'])

    fireEvent.click(heading)
    expect(order()).toEqual(['B', 'A'])

    fireEvent.click(screen.getByRole('button', { name: 'Filter by Catalog number' }))
    expect(filtered).toBe(1)
    expect(order()).toEqual(['B', 'A'])
  })
})
