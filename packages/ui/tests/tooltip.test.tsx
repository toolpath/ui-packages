import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from '../src'

describe('Tooltip', () => {
  it('keeps its child, and the focus on it, as its tip comes and goes', () => {
    const { rerender } = render(
      <Tooltip tip={null}>
        <button type="button">Undo</button>
      </Tooltip>,
    )
    const button = screen.getByRole('button', { name: 'Undo' })
    button.focus()
    rerender(
      <Tooltip tip="Nothing to undo">
        <button type="button">Undo</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Undo' })).toBe(button)
    expect(button).toHaveFocus()
    rerender(
      <Tooltip tip={null}>
        <button type="button">Undo</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Undo' })).toBe(button)
    expect(button).toHaveFocus()
  })

  it('opens nothing without a tip', async () => {
    render(
      <Tooltip tip={null}>
        <button type="button">Undo</button>
      </Tooltip>,
    )
    const button = screen.getByRole('button', { name: 'Undo' })
    fireEvent.mouseEnter(button.parentElement!)
    fireEvent.focus(button)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(document.querySelector('[data-side]')).toBeNull()
  })
})
