import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Callout } from '../src'

const renderCallout = (closeLabel?: string) =>
  render(
    <Callout id="explode-tip">
      <Callout.Trigger>Explode</Callout.Trigger>
      <Callout.Content closeLabel={closeLabel}>Pull the parts apart.</Callout.Content>
    </Callout>,
  )

afterEach(() => localStorage.clear())

describe('Callout', () => {
  it('names its close button "Close" by default, or as told', async () => {
    const { unmount } = renderCallout()
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument()
    unmount()
    renderCallout('Hide tip')
    expect(await screen.findByRole('button', { name: 'Hide tip' })).toBeInTheDocument()
  })

  it('remembers a dismissal under the shared dismissed-callouts key', async () => {
    renderCallout()
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Pull the parts apart.')).toBeNull())
    expect(JSON.parse(localStorage.getItem('dismissed-callouts') ?? '[]')).toEqual(['explode-tip'])
  })
})
