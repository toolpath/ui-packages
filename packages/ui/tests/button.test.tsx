import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '../src'

const Harness = () => {
  const [count, setCount] = useState(0)

  return (
    <>
      <button type="button" data-testid="rerender" onClick={() => setCount(count + 1)}>
        rerendered {count} times
      </button>
      <Button variant="danger">Delete</Button>
    </>
  )
}

describe('Button', () => {
  // The suite runs without Vitest globals, so nothing unmounts a render on its own.
  afterEach(cleanup)

  it('keeps its label node mounted across a re-render', () => {
    render(<Harness />)

    const label = screen.getByRole('button', { name: 'Delete' }).firstElementChild
    fireEvent.click(screen.getByTestId('rerender'))

    // A remounted label detaches the node the pointer is pressing, so the browser
    // never synthesizes the click on it.
    expect(screen.getByRole('button', { name: 'Delete' }).firstElementChild).toBe(label)
    expect(label).toBeInTheDocument()
  })

  it('keeps its label node mounted while its own props change', () => {
    const { rerender } = render(<Button variant="danger">Delete</Button>)

    const label = screen.getByRole('button', { name: 'Delete' }).firstElementChild
    rerender(
      <Button variant="danger" size="lg">
        Delete
      </Button>,
    )

    const relabelled = screen.getByRole('button', { name: 'Delete' }).firstElementChild
    expect(relabelled).toBe(label)
    expect(relabelled).toHaveClass('px-4', 'py-2', 'text-base')
  })

  it('swaps in the loading indicator without replacing the label node', () => {
    const { rerender } = render(<Button>Delete</Button>)

    const label = screen.getByRole('button', { name: 'Delete' }).firstElementChild
    rerender(<Button isLoading>Delete</Button>)

    expect(screen.getByRole('button', { name: 'Loading...' }).firstElementChild).toBe(label)
    expect(label).not.toHaveTextContent('Delete')
  })
})
