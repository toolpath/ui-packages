import { createPortal } from 'react-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  FeaturePanel,
  type CandidateRow,
  type FeaturePanelProps,
  type InspectedFace,
} from '../../src/index.js'

const UP = { x: 0, y: 0, z: 1 }
const rows: CandidateRow[] = [
  { feature: { tag: 'P1', featureType: 'pocket', machiningDirection: UP } },
  { feature: { tag: 'W1', featureType: 'wall', machiningDirection: UP } },
]
const face = (over: Partial<InspectedFace> = {}): InspectedFace => ({
  region: 4,
  rows,
  selected: 'P1',
  ...over,
})

const panel = (over: Partial<FeaturePanelProps> = {}) => {
  const props = { onSelect: vi.fn(), onClose: vi.fn(), onDropFace: vi.fn() }
  render(
    <FeaturePanel faces={[face()]} active={0} {...props} {...over}>
      <p>details of the feature</p>
    </FeaturePanel>,
  )
  return props
}

describe('FeaturePanel', () => {
  it("lists a clicked face's features, then the details of the one read", () => {
    panel()
    expect(screen.getByRole('heading', { name: 'Features on this face' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Candidate features (2)' })).toBeInTheDocument()
    expect(screen.getByText('details of the feature')).toBeInTheDocument()
  })

  it('titles a feature chosen from a list, and a group of holes, and shows them no candidates', () => {
    const { unmount } = render(
      <FeaturePanel
        faces={[face({ region: null })]}
        active={0}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Feature' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Candidate features/ })).not.toBeInTheDocument()
    unmount()
    render(
      <FeaturePanel
        faces={[face({ region: null })]}
        active={0}
        group={4}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: '4 identical holes' })).toBeInTheDocument()
  })

  it('says when no feature owns the face', () => {
    panel({ faces: [face({ rows: [], selected: null })] })
    expect(screen.getByText('No feature owns this face.')).toBeInTheDocument()
    expect(screen.queryByText('details of the feature')).not.toBeInTheDocument()
  })

  it('letters each compared face, and chooses, drops and compares them', () => {
    const comparison = [
      { feature: rows[0]!.feature, directionColor: '#000', rules: [], measurements: [] },
      { feature: rows[1]!.feature, directionColor: '#000', rules: [], measurements: [] },
    ]
    const { onSelect, onDropFace } = panel({
      faces: [face(), face({ region: 7, selected: 'W1' })],
      active: 1,
      comparison,
    })
    expect(screen.getByRole('heading', { name: 'Comparing 2 faces' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comparison' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^Pocket from/ })[1]!)
    expect(onSelect).toHaveBeenCalledWith('P1', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Stop comparing face A' }))
    expect(onDropFace).toHaveBeenCalledWith(0)
  })

  it('closes on Escape and on its ✕, and walks the candidates from anywhere in it', () => {
    const { onClose, onSelect } = panel()
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Features on this face' }), {
      key: 'Escape',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenLastCalledWith('W1', 0)
  })

  it("spreads the app's drag handle on its header", () => {
    panel({ headerProps: { title: 'Drag to move' } })
    expect(screen.getByTitle('Drag to move').tagName).toBe('HEADER')
  })
})

describe('FeaturePanel: what it answers', () => {
  it('asks for a choice when the face has candidates but none is read', () => {
    panel({ faces: [face({ selected: null })] })
    expect(screen.getByText('Choose a feature to read its details.')).toBeInTheDocument()
  })

  it('leaves keys alone that come from outside the card, as from a portalled pop-out', () => {
    const outside = document.createElement('div')
    document.body.append(outside)
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(
      <FeaturePanel faces={[face()]} active={0} onSelect={onSelect} onClose={onClose}>
        {createPortal(<button type="button">in a window</button>, outside)}
      </FeaturePanel>,
    )
    const inWindow = screen.getByRole('button', { name: 'in a window' })
    fireEvent.keyDown(inWindow, { key: 'Escape' })
    fireEvent.keyDown(inWindow, { key: 'ArrowDown' })
    expect(onClose).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
    outside.remove()
  })
})
