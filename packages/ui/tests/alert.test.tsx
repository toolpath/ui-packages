import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Alert, Button } from '../src'

describe('Alert', () => {
  it.each([
    ['danger', 'alert'],
    ['warning', 'alert'],
    ['info', 'status'],
    ['success', 'status'],
  ] as const)('announces %s as %s', (variant, role) => {
    render(<Alert variant={variant}>Stock size pending.</Alert>)
    expect(screen.getByRole(role)).toHaveTextContent('Stock size pending.')
  })

  it('is info by default, with an icon hidden from assistive technology', () => {
    render(<Alert>Estimate without times.</Alert>)
    const alert = screen.getByRole('status')
    expect(alert).toHaveAttribute('data-variant', 'info')
    expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes a role given, and the attributes passed through', () => {
    render(
      <Alert variant="danger" role="status" id="apply-error" aria-live="off">
        Apply failed.
      </Alert>,
    )
    const alert = screen.getByRole('status')
    expect(alert).toHaveAttribute('id', 'apply-error')
    expect(alert).toHaveAttribute('aria-live', 'off')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows its title, its action, and no icon when told to', () => {
    const retry = vi.fn()
    render(
      <Alert
        variant="warning"
        title="Not planned"
        icon={null}
        action={<Button onClick={retry}>Try again</Button>}
      >
        Toolpath could not plan the part.
      </Alert>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Not planned')
    expect(alert.querySelector('svg')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('offers a named dismiss button only with onDismiss', () => {
    const dismiss = vi.fn()
    const { rerender } = render(<Alert>Saved elsewhere.</Alert>)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(
      <Alert onDismiss={dismiss} dismissLabel="Hide message">
        Saved elsewhere.
      </Alert>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hide message' }))
    expect(dismiss).toHaveBeenCalledTimes(1)
    rerender(<Alert onDismiss={dismiss}>Saved elsewhere.</Alert>)
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('makes its dismiss button a 24 px target', () => {
    render(<Alert onDismiss={() => undefined}>Saved elsewhere.</Alert>)
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('size-6')
  })

  it('draws a warning in the darker amber on a light page, the yellow only on a dark one', () => {
    render(<Alert variant="warning">Estimate without times.</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('svg')).toHaveClass('text-warning-darken', 'dark:text-warning')
    expect(alert.querySelector('svg')).not.toHaveClass('text-warning')
    expect(alert).toHaveClass('border-warning-darken/60')
  })
})
