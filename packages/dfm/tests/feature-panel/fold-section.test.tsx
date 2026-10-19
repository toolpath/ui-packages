import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FoldSection } from '../../src/feature-panel/fold-section.js'
import { storageFolds } from '../../src/feature-panel/fold-store.js'

const memory = (): Storage => {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  } as Storage
}

describe('FoldSection', () => {
  it('opens as it starts, and folds its contents away', () => {
    render(
      <FoldSection id="rules" title="Rules broken">
        <p>inside</p>
      </FoldSection>,
    )
    const toggle = screen.getByRole('button', { name: 'Rules broken' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(screen.queryByText('inside')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts shut where asked', () => {
    render(
      <FoldSection id="raw" title="Raw" defaultOpen={false}>
        <p>inside</p>
      </FoldSection>,
    )
    expect(screen.queryByText('inside')).not.toBeInTheDocument()
  })

  it("keeps its state in the app's store, under the app's prefix", () => {
    const storage = memory()
    const folds = storageFolds(storage, 'toolpath.fold.')
    const { unmount } = render(
      <FoldSection id="reach" title="Reach" folds={folds}>
        <p>inside</p>
      </FoldSection>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reach' }))
    expect(storage.getItem('toolpath.fold.reach')).toBe('shut')
    unmount()
    render(
      <FoldSection id="reach" title="Reach" folds={folds}>
        <p>inside</p>
      </FoldSection>,
    )
    expect(screen.queryByText('inside')).not.toBeInTheDocument()
  })
})

describe('storageFolds', () => {
  it('reads nothing from no storage, and from storage that throws', () => {
    expect(storageFolds(null, 'p.').read('x')).toBeUndefined()
    const refusing = {
      getItem: vi.fn(() => {
        throw new Error('denied')
      }),
      setItem: vi.fn(() => {
        throw new Error('denied')
      }),
    }
    const folds = storageFolds(refusing, 'p.')
    expect(folds.read('x')).toBeUndefined()
    expect(() => folds.write('x', true)).not.toThrow()
  })
})
