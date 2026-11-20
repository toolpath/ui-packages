import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button, EmptyState } from '../src'

describe('EmptyState', () => {
  it('names what is missing as a heading, says what to do, and offers it', () => {
    const create = vi.fn()
    render(
      <EmptyState
        title="No quotes"
        description="Create your first quote to start estimating."
        action={<Button onClick={create}>New quote</Button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'No quotes' })).toBeInTheDocument()
    // Readable on white: the kit's secondary text, not its placeholder grey.
    expect(screen.getByText('Create your first quote to start estimating.')).toHaveClass(
      'text-gray-500',
      'dark:text-zinc-300',
    )
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }))
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('has no text of its own: only the title given, without a description or action', () => {
    const { container } = render(<EmptyState title="No parts" />)
    expect(container).toHaveTextContent(/^No parts$/)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fits the page outline, and sits compactly in a panel', () => {
    render(<EmptyState title="No folders" headingLevel={3} size="compact" icon={<svg />} />)
    const heading = screen.getByRole('heading', { level: 3, name: 'No folders' })
    expect(heading).toHaveClass('text-sm')
    const root = heading.parentElement!.parentElement!
    expect(root).toHaveClass('py-6')
    expect(root.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
  })
})
