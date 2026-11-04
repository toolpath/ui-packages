import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { type DateRange, DatePicker, DateRangePicker, DateTimePicker } from '../src'

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.hasPointerCapture = vi.fn()
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const Example = ({
  initial = '2026-11-02',
  precision,
  min,
  max,
}: {
  initial?: string
  precision?: 'day' | 'month' | 'year'
  min?: string
  max?: string
}) => {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <form aria-label="Example">
      <DatePicker
        label="Date"
        value={value}
        onValueChange={setValue}
        name="chosenDate"
        precision={precision}
        min={min}
        max={max}
      />
      <output aria-label="Selected value">{value ?? ''}</output>
    </form>
  )
}

// Each test drives the real popup through user-event; shared CI runners can take several seconds.
describe('DatePicker', { timeout: 30_000 }, () => {
  it('selects a day and submits an ISO date rather than a localized display string', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByLabelText('Open date calendar'))
    await user.click(await screen.findByRole('button', { name: /November 12, 2026/ }))
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2026-11-12')
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('chosenDate')).toBe(
      '2026-11-12',
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Date calendar' })).not.toBeInTheDocument(),
    )
  })

  it('selects a month through the month/year views without showing day cells', async () => {
    const user = userEvent.setup()
    render(<Example initial="2026-10" precision="month" />)
    await user.click(screen.getByLabelText('Open date calendar'))
    expect(await screen.findByText('Nov')).toBeInTheDocument()
    expect(screen.queryByText('Su')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /November 2026/ }))
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2026-11')
  })

  it('enforces month bounds, including the end of the maximum month', async () => {
    const user = userEvent.setup()
    render(<Example initial="2026-10" precision="month" min="2026-02" max="2026-11" />)
    await user.click(screen.getByLabelText('Open date calendar'))
    expect(await screen.findByRole('button', { name: /January 2026/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: /December 2026/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: /November 2026/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.click(screen.getByRole('button', { name: /January 2026/ }))
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2026-10')
    await user.click(screen.getByRole('button', { name: /November 2026/ }))
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2026-11')
  })

  it('selects a year without requiring month or day selection', async () => {
    const user = userEvent.setup()
    render(<Example initial="2026" precision="year" />)
    await user.click(screen.getByLabelText('Open date calendar'))
    await user.click(await screen.findByRole('button', { name: '2027' }))
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2027')
  })

  it('dismisses with Escape and restores focus', async () => {
    const user = userEvent.setup()
    render(<Example initial="2026-10" precision="month" />)
    const trigger = screen.getByLabelText('Open date calendar')
    await user.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Date calendar' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Date calendar' })).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Date')).toHaveFocus()
  })

  it('leaves focus where an outside click puts it', async () => {
    // Browsers read `preventScroll`; Base UI only returns focus after an outside press when they do.
    const focus = HTMLElement.prototype.focus
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      void options?.preventScroll
      focus.call(this, options)
    })
    const user = userEvent.setup()
    render(
      <>
        <Example />
        <input aria-label="Other field" />
      </>,
    )
    await user.click(screen.getByLabelText('Open date calendar'))
    await screen.findByRole('dialog', { name: 'Date calendar' })
    await user.click(screen.getByLabelText('Other field'))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Date calendar' })).not.toBeInTheDocument(),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByLabelText('Other field')).toHaveFocus()
  })

  it('supports keyboard month selection', async () => {
    const user = userEvent.setup()
    render(<Example initial="2026-10" precision="month" />)
    await user.click(screen.getByLabelText('Open date calendar'))
    await waitFor(() => expect(screen.getByRole('button', { name: /October 2026/ })).toHaveFocus())
    await user.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2026-11')
  })

  it('accepts typed dates while retaining ISO form values', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), '2026-11-14')
    await user.tab()
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2026-11-14')
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('chosenDate')).toBe(
      '2026-11-14',
    )
  })

  it('honors external updates, required, read-only, disabled and field descriptions', async () => {
    const user = userEvent.setup()
    const change = vi.fn()
    const { rerender } = render(
      <DatePicker label="Date" value={null} onValueChange={change} required />,
    )
    expect(screen.getByLabelText('Date')).toBeInvalid()
    rerender(
      <DatePicker
        label="Date"
        value="2030-01-22"
        onValueChange={change}
        readOnly
        aria-describedby="help"
      />,
    )
    const input = screen.getByLabelText('Date')
    expect(input).toHaveValue('2030-01-22')
    expect(input.getAttribute('aria-describedby')).toContain('help')
    await user.type(input, '1')
    expect(change).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Open date calendar')).toBeDisabled()
    rerender(
      <form aria-label="Disabled">
        <DatePicker label="Date" value="2030-01-22" onValueChange={change} name="date" disabled />
      </form>,
    )
    expect(screen.getByLabelText('Date')).toBeDisabled()
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).has('date')).toBe(false)
  })

  it('clears stale submitted values and blocks malformed input', async () => {
    const user = userEvent.setup()
    render(<Example />)
    const input = screen.getByLabelText('Date')
    await user.clear(input)
    await user.type(input, '2026-02-30')
    expect(input).toHaveValue('2026-02-30')
    expect(input).toBeInvalid()
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('chosenDate')).toBe('')
  })

  it('moves through days, weeks and months from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByLabelText('Open date calendar'))
    const focused = (name: string) =>
      waitFor(() => expect(screen.getByRole('button', { name })).toHaveFocus())
    await focused('Monday, November 2, 2026')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    await focused('Saturday, October 31, 2026')
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
    await user.keyboard('{Home}')
    await focused('Sunday, October 25, 2026')
    await user.keyboard('{End}{ArrowDown}')
    await focused('Saturday, November 7, 2026')
    await user.keyboard('{PageDown}')
    await focused('Monday, December 7, 2026')
    await user.keyboard('{Shift>}{PageUp}{/Shift}{ArrowUp}')
    await focused('Sunday, November 30, 2025')
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2025-11-30')
  })

  it('keeps keyboard focus and paging within the bounds', async () => {
    const user = userEvent.setup()
    render(<Example min="2026-11-01" max="2026-11-30" />)
    await user.click(screen.getByLabelText('Open date calendar'))
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sunday, November 1, 2026' })).toHaveFocus(),
    )
    await user.keyboard('{PageDown}')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Monday, November 30, 2026' })).toHaveFocus(),
    )
  })

  it('drills down from years to months to days', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByLabelText('Open date calendar'))
    await user.click(await screen.findByRole('button', { name: 'November 2026' }))
    await user.click(screen.getByRole('button', { name: '2026' }))
    expect(screen.getByRole('grid', { name: '2020 – 2029' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next decade' }))
    await user.click(screen.getByRole('button', { name: '2031' }))
    await user.click(screen.getByRole('button', { name: 'February 2031' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sunday, February 2, 2031' })).toHaveFocus(),
    )
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('2031-02-02')
  })

  it('knows leap years', async () => {
    const user = userEvent.setup()
    render(<Example initial="2028-02-10" />)
    await user.click(screen.getByLabelText('Open date calendar'))
    expect(
      await screen.findByRole('button', { name: 'Tuesday, February 29, 2028' }),
    ).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), '2027-02-29')
    expect(screen.getByLabelText('Date')).toBeInvalid()
  })

  it('uses the Input sizes and variants for its field', () => {
    render(
      <DatePicker label="Date" value={null} onValueChange={() => {}} size="xl" variant="ghost" />,
    )
    const input = screen.getByLabelText('Date')
    expect(input).toHaveClass('px-0')
    expect(input.parentElement).toHaveClass('h-9', 'bg-transparent')
  })
})

const DateTimeExample = ({
  initial = null,
  hourCycle = 24,
  min,
  max,
}: {
  initial?: string | null
  hourCycle?: 12 | 24
  min?: string
  max?: string
}) => {
  const [value, setValue] = useState(initial)
  return (
    <div role="dialog" aria-label="Host modal">
      <form aria-label="Example">
        <DateTimePicker
          label="Expiration"
          value={value}
          onValueChange={setValue}
          name="expiration"
          hourCycle={hourCycle}
          min={min}
          max={max}
        />
        <output aria-label="Selected value">{value ?? ''}</output>
      </form>
    </div>
  )
}

const submitted = () => new FormData(screen.getByRole('form') as HTMLFormElement).get('expiration')
const radio = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name })

describe('DateTimePicker', { timeout: 30_000 }, () => {
  it('types local wall-clock values and clears stale submissions during incomplete edits', async () => {
    const user = userEvent.setup()
    render(<DateTimeExample initial="2030-01-22T14:37" />)
    const input = screen.getByLabelText('Expiration')
    expect(input).toHaveValue('2030-01-22 14:37')
    await user.clear(input)
    await user.type(input, '2030-01-23 14:')
    expect(input).toHaveValue('2030-01-23 14:')
    expect(input).toBeInvalid()
    expect(submitted()).toBe('')
    await user.type(input, '38')
    expect(input).toBeValid()
    expect(submitted()).toBe('2030-01-23T14:38')
  })

  it('selects date, hour and every minute in one popup inside a modal', async () => {
    const user = userEvent.setup()
    render(<DateTimeExample initial="2030-01-22T14:37" />)
    await user.click(screen.getByLabelText('Open expiration calendar'))
    expect(screen.getByRole('dialog', { name: 'Host modal' })).toContainElement(
      await screen.findByRole('dialog', { name: 'Expiration calendar' }),
    )
    await user.click(screen.getByRole('button', { name: /January 23, 2030/ }))
    expect(submitted()).toBe('2030-01-23T14:37')
    await user.click(radio('Hour', '15'))
    await user.click(radio('Minute', '43'))
    expect(submitted()).toBe('2030-01-23T15:43')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Expiration calendar' })).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Expiration')).toHaveFocus()
  })

  it('opens programmatically and reports dismissal to its parent', async () => {
    const user = userEvent.setup()
    const Controlled = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Custom</button>
          <DateTimePicker
            label="Expiration"
            value="2030-01-22T14:37"
            onValueChange={() => {}}
            open={open}
            onOpenChange={setOpen}
          />
        </>
      )
    }
    render(<Controlled />)
    await user.click(screen.getByRole('button', { name: 'Custom' }))
    expect(await screen.findByRole('dialog', { name: 'Expiration calendar' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Expiration calendar' })).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Expiration')).toHaveFocus()
  })

  it('supports keyboard time selection and keeps the popup open', async () => {
    const user = userEvent.setup()
    render(<DateTimeExample initial="2030-01-22T14:37" />)
    await user.click(screen.getByLabelText('Open expiration calendar'))
    await user.click(radio('Minute', '37'))
    await user.keyboard('{ArrowDown}')
    expect(submitted()).toBe('2030-01-22T14:38')
    expect(screen.getByRole('dialog', { name: 'Expiration calendar' })).toBeInTheDocument()
  })

  it('requires both time segments instead of inventing midnight', async () => {
    const user = userEvent.setup()
    render(<DateTimeExample />)
    await user.type(screen.getByLabelText('Expiration'), '2030-01-22')
    await user.click(screen.getByLabelText('Open expiration calendar'))
    await user.click(radio('Hour', '00'))
    expect(submitted()).toBe('')
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
    await user.click(radio('Minute', '00'))
    expect(submitted()).toBe('2030-01-22T00:00')
  })

  it.each([false, true])(
    'submits a typed date with its default time on Enter (noValidate=%s)',
    async (noValidate) => {
      const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        return new FormData(event.currentTarget).get('expiration')
      })
      const Example = () => {
        const [value, setValue] = useState<string | null>(null)
        return (
          <form onSubmit={submit} noValidate={noValidate}>
            <DateTimePicker
              label="Expiration"
              value={value}
              onValueChange={setValue}
              name="expiration"
              hourCycle={24}
              defaultTime="00:00"
              required
            />
            <button type="submit">Save</button>
          </form>
        )
      }
      render(<Example />)
      const user = userEvent.setup()
      await user.type(screen.getByLabelText('Expiration'), '2030-01-22{Enter}')
      expect(submit).toHaveBeenCalledOnce()
      expect(submit.mock.results[0]?.value).toBe('2030-01-22T00:00')
    },
  )

  it('displays 12-hour time while submitting canonical 24-hour values', async () => {
    const user = userEvent.setup()
    render(<DateTimeExample hourCycle={12} initial="2030-01-22T00:00" />)
    const input = screen.getByLabelText('Expiration')
    expect(input).toHaveValue('2030-01-22 12:00 AM')
    await user.clear(input)
    await user.type(input, '2030-01-22 12:37 PM')
    expect(submitted()).toBe('2030-01-22T12:37')
    await user.click(screen.getByLabelText('Open expiration calendar'))
    await user.click(radio('Period', 'AM'))
    expect(submitted()).toBe('2030-01-22T00:37')
  })

  it('enforces date-time bounds within the same day', async () => {
    const user = userEvent.setup()
    render(<DateTimeExample min="2030-01-22T14:30" max="2030-01-22T15:00" />)
    const input = screen.getByLabelText('Expiration')
    await user.type(input, '2030-01-22 14:29')
    expect(input).toBeInvalid()
    expect(submitted()).toBe('')
    await user.clear(input)
    await user.type(input, '2030-01-22 14:30')
    expect(input).toBeValid()
    expect(submitted()).toBe('2030-01-22T14:30')
  })
})

const RangeExample = ({
  initial = { from: '2026-01-20', to: '2026-02-09' },
  min,
  max,
  maxDays,
}: {
  initial?: DateRange | null
  min?: string
  max?: string
  maxDays?: number
}) => {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DateRangePicker
        label="Period"
        value={value}
        onValueChange={setValue}
        min={min}
        max={max}
        maxDays={maxDays}
      />
      <output aria-label="Selected range">{value ? `${value.from}/${value.to}` : ''}</output>
    </>
  )
}

const day = (name: string) => screen.getByRole('button', { name })
const selectedRange = () => screen.getByLabelText('Selected range')

describe('DateRangePicker', { timeout: 30_000 }, () => {
  it('shows two months and selects a range across them', async () => {
    const user = userEvent.setup()
    render(<RangeExample />)
    const trigger = screen.getByRole('button', { name: /^Period/ })
    expect(trigger).toHaveTextContent(/Jan 20\s–\sFeb 9, 2026/)
    await user.click(trigger)
    expect(await screen.findByRole('grid', { name: 'January 2026' })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'February 2026' })).toBeInTheDocument()
    expect(day('Tuesday, January 20, 2026')).toHaveAttribute('data-selected')
    expect(day('Saturday, January 31, 2026')).toHaveAttribute('data-in-range')
    expect(day('Monday, February 9, 2026')).toHaveAttribute('data-selected')
    expect(day('Tuesday, February 10, 2026')).not.toHaveAttribute('data-in-range')

    await user.click(day('Sunday, January 25, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-20/2026-02-09')
    expect(day('Saturday, January 31, 2026')).not.toHaveAttribute('data-in-range')
    await user.click(day('Tuesday, February 3, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-25/2026-02-03')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Period calendar' })).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveTextContent(/Jan 25\s–\sFeb 3, 2026/)
    expect(trigger).toHaveFocus()
  })

  it('takes the two days in either order', async () => {
    const user = userEvent.setup()
    render(<RangeExample />)
    await user.click(screen.getByRole('button', { name: /^Period/ }))
    await user.click(await screen.findByRole('button', { name: 'Tuesday, February 3, 2026' }))
    await user.click(day('Thursday, January 22, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-22/2026-02-03')

    await user.click(screen.getByRole('button', { name: /^Period/ }))
    await user.click(await screen.findByRole('button', { name: 'Sunday, January 25, 2026' }))
    await user.click(day('Sunday, January 25, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-25/2026-01-25')
  })

  it('keeps the range within the bounds and the longest span', async () => {
    const user = userEvent.setup()
    render(<RangeExample min="2026-01-05" max="2026-02-15" maxDays={7} />)
    await user.click(screen.getByRole('button', { name: /^Period/ }))
    const disabled = (name: string) => expect(day(name)).toHaveAttribute('aria-disabled', 'true')
    const enabled = (name: string) => expect(day(name)).not.toHaveAttribute('aria-disabled')
    await screen.findByRole('grid', { name: 'January 2026' })
    disabled('Sunday, January 4, 2026')
    disabled('Monday, February 16, 2026')
    await user.click(day('Saturday, January 10, 2026'))
    enabled('Friday, January 16, 2026')
    disabled('Saturday, January 17, 2026')
    enabled('Monday, January 5, 2026')
    await user.click(day('Saturday, January 17, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-20/2026-02-09')
    await user.click(day('Friday, January 16, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-10/2026-01-16')

    await user.click(screen.getByRole('button', { name: /^Period/ }))
    await user.click(await screen.findByRole('button', { name: 'Tuesday, January 20, 2026' }))
    enabled('Wednesday, January 14, 2026')
    disabled('Tuesday, January 13, 2026')
    await user.click(day('Wednesday, January 14, 2026'))
    expect(selectedRange()).toHaveTextContent('2026-01-14/2026-01-20')
  })

  it('moves the two months with paging and the keyboard', async () => {
    const user = userEvent.setup()
    render(<RangeExample />)
    await user.click(screen.getByRole('button', { name: /^Period/ }))
    const focused = (name: string) =>
      waitFor(() => expect(screen.getByRole('button', { name })).toHaveFocus())
    await focused('Tuesday, January 20, 2026')
    await user.keyboard('{PageDown}')
    await focused('Friday, February 20, 2026')
    expect(screen.getByRole('grid', { name: 'January 2026' })).toBeInTheDocument()
    await user.keyboard('{PageDown}')
    await focused('Friday, March 20, 2026')
    expect(screen.queryByRole('grid', { name: 'January 2026' })).not.toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'February 2026' })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'March 2026' })).toBeInTheDocument()
    await user.keyboard('{Enter}{ArrowRight}{Enter}')
    expect(selectedRange()).toHaveTextContent('2026-03-20/2026-03-21')

    await user.click(screen.getByRole('button', { name: /^Period/ }))
    await user.click(await screen.findByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('grid', { name: 'February 2026' })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'March 2026' })).toBeInTheDocument()
  })

  it('opens on the latest months it allows', async () => {
    const user = userEvent.setup()
    render(<RangeExample initial={{ from: '2026-11-01', to: '2026-11-04' }} max="2026-11-04" />)
    await user.click(screen.getByRole('button', { name: /^Period/ }))
    expect(await screen.findByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
  })

  it('keeps the chosen range when dismissed with Escape', async () => {
    const user = userEvent.setup()
    render(<RangeExample />)
    const trigger = screen.getByRole('button', { name: /^Period/ })
    await user.click(trigger)
    await user.click(await screen.findByRole('button', { name: 'Sunday, January 25, 2026' }))
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Period calendar' })).not.toBeInTheDocument(),
    )
    expect(selectedRange()).toHaveTextContent('2026-01-20/2026-02-09')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    expect(
      await screen.findByRole('button', { name: 'Tuesday, January 20, 2026' }),
    ).toHaveAttribute('data-selected')
  })

  it('uses the Input sizes and variants, with its own classes last', () => {
    const { rerender } = render(
      <DateRangePicker
        label="Period"
        value={null}
        onValueChange={() => {}}
        size="xl"
        variant="ghost"
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Period' })
    expect(trigger).toHaveClass('h-9', 'text-lg', 'bg-transparent')
    expect(trigger).toHaveTextContent('Pick a date range')
    rerender(
      <DateRangePicker label="Period" value={null} onValueChange={() => {}} className="text-xs" />,
    )
    expect(trigger).toHaveClass('h-7', 'text-xs')
    expect(trigger).not.toHaveClass('text-sm')
  })
})
