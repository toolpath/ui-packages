import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComparisonTable, type ComparedFace } from '../../src/index.js'

const UP = { x: 0, y: 0, z: 1 }

const faces: ComparedFace[] = [
  {
    feature: { tag: 'P1', featureType: 'pocket', machiningDirection: UP },
    directionColor: '#3b82f6',
    rules: [{ key: 'deep', color: '#e5484d', text: 'Milled features with L/D ≥ 5' }],
    measurements: [
      { key: 'featureDepth', label: 'Feature depth', value: '10 mm', derivation: [] },
      { key: 'diameter', label: 'Diameter', value: '6 mm', derivation: [] },
    ],
  },
  {
    feature: { tag: 'W1', featureType: 'wall', machiningDirection: UP },
    directionColor: '#3b82f6',
    rules: [],
    measurements: [{ key: 'featureDepth', label: 'Feature depth', value: '12 mm', derivation: [] }],
  },
]

const rowOf = (label: string) => screen.getByRole('rowheader', { name: label }).closest('tr')!

describe('ComparisonTable', () => {
  it('puts each face in a column, a row for everything any face has, in order', () => {
    render(<ComparisonTable faces={faces} active={0} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'Type',
      'Machined from',
      'Rules broken',
      'Feature depth',
      'Diameter',
    ])
    expect(
      within(rowOf('Diameter'))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['6 mm', '—'])
  })

  it('marks the rows whose readings disagree', () => {
    render(<ComparisonTable faces={faces} active={0} onSelect={vi.fn()} />)
    expect(rowOf('Type')).toHaveAttribute('data-differs')
    expect(rowOf('Machined from')).not.toHaveAttribute('data-differs')
    expect(rowOf('Feature depth')).toHaveAttribute('data-differs')
  })

  it('counts the rules each breaks, naming them on hover, and has a Required row only when told', () => {
    const { unmount } = render(<ComparisonTable faces={faces} active={0} onSelect={vi.fn()} />)
    const [first, second] = within(rowOf('Rules broken')).getAllByRole('cell')
    expect(first).toHaveTextContent('1')
    expect(first!.querySelector('[title]')).toHaveAttribute('title', 'Milled features with L/D ≥ 5')
    expect(second).toHaveTextContent('None')
    expect(screen.queryByRole('rowheader', { name: 'Required' })).not.toBeInTheDocument()
    unmount()
    render(
      <ComparisonTable
        faces={[{ ...faces[0]!, required: true }, faces[1]!]}
        active={0}
        onSelect={vi.fn()}
      />,
    )
    expect(
      within(rowOf('Required'))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Yes', 'No'])
  })

  it("reads a face's feature from its column head", () => {
    const onSelect = vi.fn()
    render(<ComparisonTable faces={faces} active={0} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /BWall from \+Z/ }))
    expect(onSelect).toHaveBeenCalledWith('W1', 1)
  })
})
