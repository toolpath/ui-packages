import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useUnit } from '../src/react/index.js'

const Harness = ({ storageKey }: { storageKey: string }) => {
  const [unit, choose] = useUnit(storageKey)

  return (
    <>
      <span data-testid="unit">{unit}</span>
      <button type="button" onClick={() => choose('inches')}>
        inches
      </button>
    </>
  )
}

const shown = () => screen.getByTestId('unit').textContent

describe('useUnit', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  // The suite runs without Vitest globals, so nothing unmounts a render on its own.
  afterEach(cleanup)

  it('opens on millimetres and takes the stored preference on the first effect', () => {
    globalThis.localStorage.setItem('app.unit', 'inches')
    render(<Harness storageKey="app.unit" />)

    expect(shown()).toBe('inches')
  })

  it('defaults to millimetres where nothing is stored', () => {
    render(<Harness storageKey="app.unit" />)

    expect(shown()).toBe('millimeters')
  })

  /**
   * The whole point of taking a key: two applications on one origin hold
   * their own units, and neither reads the other's.
   */
  it('keeps one application’s unit out of another’s', () => {
    globalThis.localStorage.setItem('dfm.unit', 'inches')
    render(<Harness storageKey="catalog.unit" />)

    expect(shown()).toBe('millimeters')
  })

  it('writes the choice through, under the caller’s key', () => {
    render(<Harness storageKey="app.unit" />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'inches' }))
    })

    expect(shown()).toBe('inches')
    expect(globalThis.localStorage.getItem('app.unit')).toBe('inches')
  })

  /**
   * `loadUnit` reads the spelling that is already in people's browsers; this
   * pins that the hook does not lose it on the way through.
   */
  it('reads a preference stored under the old spelling', () => {
    globalThis.localStorage.setItem('app.unit', 'in')
    render(<Harness storageKey="app.unit" />)

    expect(shown()).toBe('inches')
  })
})
