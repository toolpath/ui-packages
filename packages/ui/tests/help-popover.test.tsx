import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpPopover } from '../src'

const renderHelp = (props: Partial<Parameters<typeof HelpPopover>[0]> = {}) =>
  render(
    <HelpPopover label="About revisions" {...props}>
      Each send makes a revision; older ones are read-only.
    </HelpPopover>,
  )

describe('HelpPopover', () => {
  it('is a named button that opens its text on click and says it is open', async () => {
    renderHelp()
    const button = screen.getByRole('button', { name: 'About revisions' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    const popup = await screen.findByRole('dialog', { name: 'About revisions' })
    expect(popup).toHaveTextContent('Each send makes a revision; older ones are read-only.')
    expect(popup).toHaveAttribute('data-tip')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens as the pointer rests on it, and stays open when it is then clicked', async () => {
    renderHelp()
    const button = screen.getByRole('button', { name: 'About revisions' })
    const user = userEvent.setup()
    await user.hover(button)
    expect(await screen.findByRole('dialog', { name: 'About revisions' })).toBeInTheDocument()
    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'About revisions' })).toBeInTheDocument()
  })

  it('opens from the keyboard, and Escape closes it and gives focus back', async () => {
    renderHelp()
    await userEvent.tab()
    const button = screen.getByRole('button', { name: 'About revisions' })
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on Space too', async () => {
    renderHelp()
    screen.getByRole('button', { name: 'About revisions' }).focus()
    await userEvent.keyboard(' ')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('names its popup by a title when it has one', async () => {
    renderHelp({ title: 'Revisions' })
    await userEvent.click(screen.getByRole('button', { name: 'About revisions' }))
    expect(await screen.findByRole('dialog', { name: 'Revisions' })).toBeInTheDocument()
  })

  it('spreads popupProps onto the popup, an app’s own markers included', async () => {
    renderHelp({ popupProps: { 'data-dropdown': '', className: 'max-w-96' } })
    await userEvent.click(screen.getByRole('button', { name: 'About revisions' }))
    const popup = await screen.findByRole('dialog')
    expect(popup).toHaveAttribute('data-dropdown', '')
    expect(popup).toHaveAttribute('data-tip')
    expect(popup).toHaveClass('max-w-96')
  })

  it('keeps its own name and marker over popupProps that would replace them', async () => {
    renderHelp({ popupProps: { 'aria-label': 'Something else', 'data-tip': undefined } })
    await userEvent.click(screen.getByRole('button', { name: 'About revisions' }))
    const popup = await screen.findByRole('dialog', { name: 'About revisions' })
    expect(popup).toHaveAttribute('data-tip', '')
  })
})
