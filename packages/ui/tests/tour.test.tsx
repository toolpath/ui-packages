import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tour, type TourCloseReason, type TourStep } from '../src'

const byId = (id: string) => () => document.getElementById(id)

const STEPS: ReadonlyArray<TourStep> = [
  { id: 'add', anchor: byId('add'), title: 'Add a folder', body: 'Folders group faces.' },
  { id: 'undo', anchor: byId('undo'), title: 'Undo', body: 'Edits wait until Apply.' },
  { id: 'apply', anchor: byId('apply'), title: 'Apply', body: 'Apply plans the part.' },
]

const closed = vi.fn<(reason: TourCloseReason) => void>()

/** A page with the three controls, and a Help button that starts the tour at its first step. */
const Page = ({
  steps = STEPS,
  hidden = [],
  focusBack = false,
}: {
  steps?: ReadonlyArray<TourStep>
  hidden?: Array<string>
  focusBack?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const help = useRef<HTMLButtonElement>(null)
  return (
    <>
      {['add', 'undo', 'apply'].map((id) => (
        <button key={id} id={id} type="button" hidden={hidden.includes(id)}>
          {id}
        </button>
      ))}
      <button ref={help} type="button" onClick={() => setOpen(true)}>
        Help
      </button>
      <Tour
        open={open}
        steps={steps}
        step={step}
        onStepChange={setStep}
        onClose={(reason) => {
          closed(reason)
          setOpen(false)
          setStep(0)
        }}
        finalFocus={focusBack ? help : undefined}
      />
    </>
  )
}

const start = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Help' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  // jsdom lays nothing out; a hidden element has no box, as in a browser.
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this.closest('[hidden]') ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList
  })
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  closed.mockReset()
})

describe('Tour', () => {
  it('shows a step as a named dialog, counted, with focus on Next', async () => {
    render(<Page />)
    const dialog = await start()
    expect(dialog).toHaveAccessibleName('Add a folder')
    expect(dialog).toHaveAccessibleDescription('Folders group faces.')
    expect(dialog).toHaveAttribute('data-tip')
    expect(dialog).toHaveTextContent('1 of 3')
    // Readable on white: the kit's secondary text, not its placeholder grey.
    expect(within(dialog).getByText('1 of 3')).toHaveClass('text-gray-500')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus())
    // Nothing to go back to on the first step.
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(document.getElementById('add')!.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
    })
  })

  it('walks forward and back, and ends with Done', async () => {
    render(<Page focusBack />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Undo' })).toHaveTextContent('2 of 3')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('dialog', { name: 'Add a folder' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Apply' })).toHaveTextContent('3 of 3')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(closed).toHaveBeenCalledWith('done')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Help' })).toHaveFocus()
  })

  it('closes as skipped from Skip', async () => {
    render(<Page />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(closed).toHaveBeenCalledWith('skip')
  })

  it('takes Escape as skip, from the page as well as its own handlers', async () => {
    const pageKeys = vi.fn()
    window.addEventListener('keydown', pageKeys)
    render(<Page />)
    await start()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus())
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    screen.getByRole('button', { name: 'Next' }).dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(closed).toHaveBeenCalledTimes(1)
    expect(closed).toHaveBeenCalledWith('skip')
    expect(pageKeys).not.toHaveBeenCalled()
    window.removeEventListener('keydown', pageKeys)
  })

  it('stays open on a press elsewhere', async () => {
    render(<Page />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'apply' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(closed).not.toHaveBeenCalled()
  })

  it('leaves out a step not on screen as it opens', async () => {
    render(<Page hidden={['undo']} />)
    expect(await start()).toHaveTextContent('1 of 2')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Apply' })).toHaveTextContent('2 of 2')
  })

  it('keeps a step its application brings on screen, looking its anchor up as it is shown', async () => {
    const steps: ReadonlyArray<TourStep> = STEPS.map((step) =>
      step.id === 'undo' ? { ...step, available: () => true } : step,
    )
    const { rerender } = render(<Page steps={steps} hidden={['undo']} />)
    expect(await start()).toHaveTextContent('1 of 3')
    // On screen by the time the tour moves to it.
    rerender(<Page steps={steps} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Undo' })).toHaveTextContent('2 of 3')
  })

  it('leaves out a step its application says it can’t bring on screen', async () => {
    const steps: ReadonlyArray<TourStep> = STEPS.map((step) =>
      step.id === 'undo' ? { ...step, available: () => false } : step,
    )
    render(<Page steps={steps} />)
    expect(await start()).toHaveTextContent('1 of 2')
  })

  it('skips a step whose anchor has gone since', async () => {
    const steps = STEPS.map((step) =>
      step.id === 'undo' ? { ...step, anchor: vi.fn(byId('undo')) } : step,
    )
    render(<Page steps={steps} />)
    await start()
    // Gone after the tour opened.
    vi.mocked(steps[1]!.anchor).mockReturnValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Apply' })).toBeInTheDocument()
  })

  it('skips a vanished step going back, too', async () => {
    const steps = STEPS.map((step) =>
      step.id === 'undo' ? { ...step, anchor: vi.fn(byId('undo')) } : step,
    )
    render(<Page steps={steps} />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Apply' })).toBeInTheDocument()
    vi.mocked(steps[1]!.anchor).mockReturnValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('dialog', { name: 'Add a folder' })).toBeInTheDocument()
  })

  it('closes as anchor-lost when nothing it could show is on screen', async () => {
    render(<Page hidden={['add', 'undo', 'apply']} />)
    await userEvent.click(screen.getByRole('button', { name: 'Help' }))
    await waitFor(() => expect(closed).toHaveBeenCalledWith('anchor-lost'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ends with Done on the last step still on screen', async () => {
    const { rerender } = render(<Page />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Undo' })).toBeInTheDocument()
    // The last step's control goes while the tour is on the one before it.
    rerender(<Page hidden={['apply']} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Done' }))
    expect(closed).toHaveBeenCalledExactlyOnceWith('done')
  })

  it('ends as done when Next finds nothing ahead on screen', async () => {
    render(<Page />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Undo' })).toBeInTheDocument()
    // Gone without the page drawing again, so the button still says Next.
    document.getElementById('apply')!.hidden = true
    await userEvent.click(screen.getByRole('button', { name: /^(Next|Done)$/ }))
    expect(closed).toHaveBeenCalledExactlyOnceWith('done')
  })

  it('says each step as it moves to it, in a polite region around its words', async () => {
    render(<Page />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    const dialog = await screen.findByRole('dialog', { name: 'Undo' })
    const region = within(dialog).getByText('Undo').closest('[aria-live]')
    await waitFor(() => expect(region).toHaveAttribute('aria-live', 'polite'))
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toHaveTextContent('Edits wait until Apply.')
    // The progress and the buttons are not part of what is said.
    expect(region).not.toHaveTextContent('2 of 3')
  })

  it('moves on when the shown step’s control goes, with nothing else drawn again', async () => {
    render(<Page />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('dialog', { name: 'Undo' })).toBeInTheDocument()
    document.getElementById('undo')!.hidden = true
    expect(await screen.findByRole('dialog', { name: 'Apply' })).toBeInTheDocument()
  })

  it('moves on when the shown step’s control is taken off the page', async () => {
    const lone = document.createElement('button')
    document.body.append(lone)
    const steps = STEPS.map((step) => (step.id === 'add' ? { ...step, anchor: () => lone } : step))
    render(<Page steps={steps} />)
    expect(await start()).toHaveAccessibleName('Add a folder')
    lone.remove()
    expect(await screen.findByRole('dialog', { name: 'Undo' })).toBeInTheDocument()
  })

  it('closes once, however often the page draws it again with new callbacks before closing', async () => {
    const Stuck = () => (
      <Tour open steps={STEPS} step={0} onStepChange={() => undefined} onClose={closed} />
    )
    // No controls on the page at all: nothing to show.
    const { rerender } = render(<Stuck />)
    await waitFor(() => expect(closed).toHaveBeenCalledWith('anchor-lost'))
    rerender(<Stuck />)
    rerender(<Stuck />)
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('keeps its own words for labels given as undefined', async () => {
    const Labelled = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button id="add" type="button">
            add
          </button>
          <button type="button" onClick={() => setOpen(true)}>
            Help
          </button>
          <Tour
            open={open}
            steps={STEPS.slice(0, 1)}
            step={0}
            onStepChange={() => undefined}
            onClose={closed}
            labels={{ done: undefined, skip: undefined }}
          />
        </>
      )
    }
    render(<Labelled />)
    await start()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  })
})
