import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CandidateList, candidateListKeys, type CandidateRow } from '../../src/index.js'

const UP = { x: 0, y: 0, z: 1 }
const SIDE = { x: 1, y: 0, z: 0 }

const rows: CandidateRow[] = [
  {
    feature: { tag: 'P1', featureType: 'pocket', machiningDirection: UP },
    color: '#e5484d',
    ruleCount: 2,
    required: true,
  },
  { feature: { tag: 'W1', featureType: 'wall', machiningDirection: SIDE }, ruleCount: 1 },
  {
    feature: { tag: 'F1', featureType: 'face', machiningDirection: UP },
    detail: 'Folder 1',
    note: 'Shares 2 faces with Pocket',
    action: <button type="button">Pin</button>,
  },
]

const list = (over: Partial<Parameters<typeof CandidateList>[0]> = {}) => {
  const onSelect = vi.fn()
  render(
    <div onKeyDown={candidateListKeys}>
      <CandidateList rows={rows} selected="W1" onSelect={onSelect} {...over} />
    </div>,
  )
  return onSelect
}

const row = (name: RegExp) => screen.getByRole('button', { name })

describe('CandidateList', () => {
  it('lists the candidates in order, the chosen one pressed', () => {
    list()
    expect(screen.getByRole('button', { name: 'Candidate features (3)' })).toBeInTheDocument()
    expect(row(/Wall from \+X/)).toHaveAttribute('aria-pressed', 'true')
    expect(row(/Pocket from \+Z/)).toHaveAttribute('aria-pressed', 'false')
  })

  it('says how many rules each breaks, and which are required', () => {
    list()
    expect(within(row(/^Pocket from/)).getByText('2 rules')).toBeInTheDocument()
    expect(within(row(/^Pocket from/)).getByText('Required')).toBeInTheDocument()
    expect(within(row(/^Wall from/)).getByText('1 rule')).toBeInTheDocument()
  })

  it("carries the app's detail and note in the row, and its action beside it", () => {
    list()
    const face = row(/Face from \+Z/)
    expect(within(face).getByText('Folder 1')).toBeInTheDocument()
    expect(within(face).getByText('Shares 2 faces with Pocket')).toBeInTheDocument()
    const pin = screen.getByRole('button', { name: 'Pin' })
    expect(face).not.toContainElement(pin)
  })

  it('chooses a row on a click, and walks them with the keys', () => {
    const onSelect = list()
    fireEvent.click(row(/^Pocket from/))
    expect(onSelect).toHaveBeenLastCalledWith('P1')
    row(/^Wall from/).focus()
    fireEvent.keyDown(row(/^Wall from/), { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenLastCalledWith('F1')
  })

  it('previews a row on the part only when the app asks', () => {
    const onHover = vi.fn()
    list({ onHover })
    fireEvent.pointerEnter(row(/^Pocket from/))
    expect(onHover).toHaveBeenLastCalledWith('P1')
    fireEvent.pointerLeave(row(/^Pocket from/))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('names a compared face by its letter, and stops comparing it', () => {
    const onStop = vi.fn()
    list({ face: { index: 1, active: true, onStop } })
    expect(screen.getByRole('button', { name: /^BCandidate features \(3\)$/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stop comparing face B' }))
    expect(onStop).toHaveBeenCalled()
  })
})

describe('CandidateList: the look', () => {
  it('greys the chosen row by default, and tints it blue with the info look', () => {
    const { unmount } = render(<CandidateList rows={rows} selected="P1" onSelect={vi.fn()} />)
    expect(row(/^Pocket from/)).toHaveClass('bg-gray-100')
    unmount()
    render(
      <CandidateList rows={rows} selected="P1" onSelect={vi.fn()} look={{ selected: 'info' }} />,
    )
    expect(row(/^Pocket from/).closest('li')).toHaveClass('bg-info/15')
  })
})
