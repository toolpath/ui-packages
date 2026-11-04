import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { type KeyboardEvent, type RefObject, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../common/cn'
import { IconButton } from '../icon-button'

export type CalendarView = 'day' | 'month' | 'year'

interface CalendarDate {
  year: number
  month: number
  day: number
}

interface Cell {
  key: string
  date: CalendarDate
  label: string
  name: string
}

const VIEWS: Array<CalendarView> = ['day', 'month', 'year']
const COLUMNS: Record<CalendarView, number> = { day: 7, month: 3, year: 5 }
const PAGE_UNIT: Record<CalendarView, string> = { day: 'month', month: 'year', year: 'decade' }
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SAKAMOTO = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]

const cellClass =
  'flex w-full items-center justify-center rounded text-xs outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-info/60 data-[selected]:bg-info/20 data-[selected]:font-semibold data-[selected]:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-25 dark:hover:bg-zinc-800 dark:data-[selected]:text-white'

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const daysInMonth = (year: number, month: number) => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Day of the week, 0 for Sunday, by Sakamoto's method on the proleptic Gregorian calendar. */
const weekday = ({ year, month, day }: CalendarDate) => {
  const y = month < 3 ? year - 1 : year
  return (
    (y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) +
      SAKAMOTO[month - 1]! +
      day) %
    7
  )
}

const toKey = ({ year, month, day }: CalendarDate, view: CalendarView) => {
  if (view === 'year') {
    return pad(year, 4)
  }
  return view === 'month'
    ? `${pad(year, 4)}-${pad(month)}`
    : `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, at the start of the period it names. */
const fromKey = (key: string): CalendarDate => {
  const [year = 1, month = 1, day = 1] = key.split('-').map(Number)
  return { year, month, day }
}

/** The last day of the period `key` names. */
const endOf = (key: string): CalendarDate => {
  const { year, month, day } = fromKey(key)
  if (key.length === 4) {
    return { year, month: 12, day: 31 }
  }
  return { year, month, day: key.length === 7 ? daysInMonth(year, month) : day }
}

/** Whether `text` is a real date written exactly as `YYYY`, `YYYY-MM` or `YYYY-MM-DD` for `view`. */
export const isCalendarValue = (text: string, view: CalendarView) => {
  const pattern =
    view === 'year' ? /^\d{4}$/ : view === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/
  if (!pattern.test(text)) {
    return false
  }
  const { year, month, day } = fromKey(text)
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

/** Compares at the coarser of the two precisions, so a month is in range when any of its days is. */
const compare = (key: string, bound: string) => {
  const length = Math.min(key.length, bound.length)
  const a = key.slice(0, length)
  const b = bound.slice(0, length)
  return a < b ? -1 : a > b ? 1 : 0
}

const shiftMonths = (date: CalendarDate, months: number): CalendarDate => {
  const index = date.year * 12 + date.month - 1 + months
  const year = Math.floor(index / 12)
  const month = index - year * 12 + 1
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) }
}

const shiftDays = (date: CalendarDate, days: number): CalendarDate => {
  let month = { ...date, day: 1 }
  let day = date.day + days
  while (day < 1) {
    month = shiftMonths(month, -1)
    day += daysInMonth(month.year, month.month)
  }
  while (day > daysInMonth(month.year, month.month)) {
    day -= daysInMonth(month.year, month.month)
    month = shiftMonths(month, 1)
  }
  return { ...month, day }
}

/** Moves by whole cells of `view`. */
const shift = (date: CalendarDate, view: CalendarView, cells: number) => {
  if (view === 'day') {
    return shiftDays(date, cells)
  }
  return shiftMonths(date, view === 'month' ? cells : cells * 12)
}

/** The `YYYY-MM-DD` date `days` after `date`. */
export const addDays = (date: string, days: number) => toKey(shiftDays(fromKey(date), days), 'day')

const monthIndex = ({ year, month }: CalendarDate) => year * 12 + month - 1

const decadeOf = (year: number) => year - (year % 10)

/** The first and last keys of the page showing `date`, at the precision its pages turn by. */
const pageRange = (date: CalendarDate, view: CalendarView): [string, string] => {
  if (view === 'year') {
    const start = decadeOf(date.year)
    return [pad(start, 4), pad(start + 9, 4)]
  }
  const key = toKey(date, view === 'day' ? 'month' : 'year')
  return [key, key]
}

const PAGE_MONTHS: Record<CalendarView, number> = { day: 1, month: 12, year: 120 }

const cellsOf = (date: CalendarDate, view: CalendarView): Array<Cell | null> => {
  if (view === 'year') {
    const start = decadeOf(date.year)
    return Array.from({ length: 10 }, (_, index) => {
      const year = start + index
      const cell = { year, month: date.month, day: 1 }
      return { key: pad(year, 4), date: cell, label: String(year), name: String(year) }
    })
  }
  if (view === 'month') {
    return MONTHS.map((name, index) => {
      const cell = { year: date.year, month: index + 1, day: 1 }
      return {
        key: toKey(cell, 'month'),
        date: cell,
        label: name.slice(0, 3),
        name: `${name} ${date.year}`,
      }
    })
  }
  const first = { ...date, day: 1 }
  const days = Array.from({ length: daysInMonth(date.year, date.month) }, (_, index) => {
    const cell = { ...first, day: index + 1 }
    return {
      key: toKey(cell, 'day'),
      date: cell,
      label: String(cell.day),
      name: `${WEEKDAYS[weekday(cell)]}, ${MONTHS[cell.month - 1]} ${cell.day}, ${cell.year}`,
    }
  })
  const cells: Array<Cell | null> = [...Array<null>(weekday(first)).fill(null), ...days]
  return [...cells, ...Array<null>((7 - (cells.length % 7)) % 7).fill(null)]
}

const titleOf = (date: CalendarDate, view: CalendarView) => {
  if (view === 'year') {
    const start = decadeOf(date.year)
    return `${start} – ${start + 9}`
  }
  return view === 'month' ? String(date.year) : `${MONTHS[date.month - 1]} ${date.year}`
}

const today = (): CalendarDate => {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

/**
 * Day, month and year grids with the WAI-ARIA date picker keyboard model. Values and bounds are
 * `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; selection happens at `precision`, and coarser views drill down.
 */
export const Calendar = ({
  precision,
  value,
  range,
  months = 1,
  min = '0001',
  max = '9999',
  onSelect,
  focusRef,
}: {
  precision: CalendarView
  value: string | null
  /** Day-precision range to highlight instead of `value`; `to` is null while the end is chosen. */
  range?: { from: string; to: string | null } | null
  /** Consecutive months the day view shows side by side. */
  months?: number
  min?: string
  max?: string
  onSelect: (value: string) => void
  /** Receives the focusable cell, for the popup's initial focus. */
  focusRef: RefObject<HTMLButtonElement | null>
}) => {
  const clamp = (date: CalendarDate) => {
    const key = toKey(date, 'day')
    if (date.year < 1 || key < toKey(fromKey(min), 'day')) {
      return fromKey(min)
    }
    if (date.year > 9999 || key > toKey(endOf(max), 'day')) {
      return endOf(max)
    }
    return date
  }
  /** The first month of the day view, moved as little as needed to show `date` and kept within the bounds. */
  const fit = (first: CalendarDate, date: CalendarDate): CalendarDate => {
    const offset = monthIndex(date) - monthIndex(first)
    const shown = offset < 0 ? date : offset >= months ? shiftMonths(date, 1 - months) : first
    const latest = shiftMonths(endOf(max), 1 - months)
    const earliest = fromKey(min)
    const start = monthIndex(shown) > monthIndex(latest) ? latest : shown
    return { ...(monthIndex(start) < monthIndex(earliest) ? earliest : start), day: 1 }
  }
  const [view, setView] = useState(precision)
  const [focused, setFocused] = useState(() => clamp(value ? fromKey(value) : today()))
  const [first, setFirst] = useState(() => fit(focused, focused))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    if (value) {
      const date = clamp(fromKey(value))
      setFocused(date)
      setFirst(fit(first, date))
    }
  }
  const moveFocus = useRef(false)
  useLayoutEffect(() => {
    if (moveFocus.current) {
      moveFocus.current = false
      focusRef.current?.focus()
    }
  })
  const titleId = useId()

  const inRange = (key: string) => compare(key, min) >= 0 && compare(key, max) <= 0
  /** The grids shown: `months` of them from `start` in the day view, otherwise the focused page. */
  const gridsOf = (start: CalendarDate, date: CalendarDate) =>
    view === 'day'
      ? Array.from({ length: months }, (_, index) => shiftMonths(start, index))
      : [date]
  const canPage = (grids: Array<CalendarDate>, direction: -1 | 1) => {
    const edge = direction < 0 ? grids[0]! : grids[grids.length - 1]!
    const [start, end] = pageRange(shiftMonths(edge, direction * PAGE_MONTHS[view]), view)
    return direction < 0 ? compare(end, min) >= 0 : compare(start, max) <= 0
  }
  const focus = (date: CalendarDate, start = first) => {
    const next = clamp(date)
    setFocused(next)
    setFirst(fit(start, next))
    moveFocus.current = true
  }
  const page = (direction: -1 | 1) => {
    const next = clamp(shiftMonths(focused, direction * PAGE_MONTHS[view]))
    const nextFirst = fit(shiftMonths(first, direction), next)
    setFocused(next)
    setFirst(nextFirst)
    // A page button disabled by its own press would drop focus, so hand it to the grid.
    moveFocus.current = !canPage(gridsOf(nextFirst, next), direction)
  }
  const choose = (cell: Cell) => {
    if (!inRange(cell.key)) {
      return
    }
    if (view === precision) {
      setFocused(cell.date)
      onSelect(cell.key)
      return
    }
    // Year cells carry the focused month, so drilling down keeps the month and day.
    const { year, month } = cell.date
    setView(VIEWS[VIEWS.indexOf(view) - 1]!)
    focus({ year, month, day: Math.min(focused.day, daysInMonth(year, month)) }, cell.date)
  }
  const handleKeyDown = (event: KeyboardEvent) => {
    const columns = COLUMNS[view]
    const column =
      view === 'day'
        ? weekday(focused)
        : view === 'month'
          ? (focused.month - 1) % columns
          : (focused.year - decadeOf(focused.year)) % columns
    const pageMonths = PAGE_MONTHS[view] * (view === 'day' && event.shiftKey ? 12 : 1)
    const moves: Record<string, () => CalendarDate> = {
      ArrowLeft: () => shift(focused, view, -1),
      ArrowRight: () => shift(focused, view, 1),
      ArrowUp: () => shift(focused, view, -columns),
      ArrowDown: () => shift(focused, view, columns),
      Home: () => shift(focused, view, -column),
      End: () => shift(focused, view, columns - 1 - column),
      PageUp: () => shiftMonths(focused, -pageMonths),
      PageDown: () => shiftMonths(focused, pageMonths),
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      focus(move())
    }
  }

  const coarser = VIEWS[VIEWS.indexOf(view) + 1]
  const grids = gridsOf(first, focused)
  const focusedKey = toKey(focused, view)
  const ends = range ? [range.from, range.to] : [value]
  // A range longer than a day joins its days into a band, rounded where a row or month ends.
  const band =
    view === 'day' && range?.to && range.from < range.to ? { from: range.from, to: range.to } : null

  return (
    <div className={cn(grids.length > 1 && 'flex flex-col gap-4 sm:flex-row sm:gap-6')}>
      {grids.map((grid, gridIndex) => {
        const cells = cellsOf(grid, view)
        const rows = Array.from({ length: cells.length / COLUMNS[view] }, (_, index) =>
          cells.slice(index * COLUMNS[view], (index + 1) * COLUMNS[view]),
        )
        const gridTitleId = `${titleId}-${gridIndex}`
        return (
          <div key={toKey(grid, 'month')} className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              {gridIndex === 0 ? (
                <IconButton
                  size="lg"
                  aria-label={`Previous ${PAGE_UNIT[view]}`}
                  disabled={!canPage(grids, -1)}
                  onClick={() => page(-1)}
                >
                  <CaretLeftIcon />
                </IconButton>
              ) : (
                <span aria-hidden className="size-6 shrink-0" />
              )}
              {coarser ? (
                <button
                  type="button"
                  id={gridTitleId}
                  aria-live="polite"
                  onClick={() => setView(coarser)}
                  className="rounded px-2 py-1 text-xs font-semibold outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-info/60 dark:hover:bg-zinc-800"
                >
                  {titleOf(grid, view)}
                </button>
              ) : (
                <span
                  id={gridTitleId}
                  aria-live="polite"
                  className="px-2 py-1 text-xs font-semibold"
                >
                  {titleOf(grid, view)}
                </span>
              )}
              {gridIndex === grids.length - 1 ? (
                <IconButton
                  size="lg"
                  aria-label={`Next ${PAGE_UNIT[view]}`}
                  disabled={!canPage(grids, 1)}
                  onClick={() => page(1)}
                >
                  <CaretRightIcon />
                </IconButton>
              ) : (
                <span aria-hidden className="size-6 shrink-0" />
              )}
            </div>
            <table
              role="grid"
              aria-labelledby={gridTitleId}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full table-fixed border-separate',
                range && view === 'day'
                  ? 'border-spacing-x-0 border-spacing-y-0.5'
                  : 'border-spacing-0.5',
              )}
            >
              {view === 'day' ? (
                <thead>
                  <tr>
                    {WEEKDAYS.map((name) => (
                      <th
                        key={name}
                        scope="col"
                        abbr={name}
                        className="pb-1 text-center text-2xs font-normal text-gray-300 dark:text-zinc-400"
                      >
                        {name.charAt(0)}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, column) => {
                      if (!cell) {
                        return <td key={`empty-${column}`} />
                      }
                      const selected = ends.some((end) => !!end && compare(cell.key, end) === 0)
                      const inBand = !!band && cell.key > band.from && cell.key < band.to
                      const lastDay = daysInMonth(cell.date.year, cell.date.month)
                      const joinsLeft =
                        !!band && cell.key > band.from && cell.key <= band.to && column > 0
                      const joinsRight =
                        !!band && cell.key >= band.from && cell.key < band.to && column < 6
                      const disabled = !inRange(cell.key)
                      const isFocused = cell.key === focusedKey
                      return (
                        <td key={cell.key} aria-selected={selected || inBand}>
                          <button
                            ref={isFocused ? focusRef : undefined}
                            type="button"
                            tabIndex={isFocused ? 0 : -1}
                            aria-label={cell.name}
                            aria-disabled={disabled || undefined}
                            data-selected={selected || undefined}
                            data-in-range={inBand || undefined}
                            data-disabled={disabled || undefined}
                            onClick={() => choose(cell)}
                            className={cn(cellClass, view === 'day' ? 'h-7' : 'h-9', {
                              'bg-info/10': inBand,
                              'rounded-l-none': joinsLeft && cell.date.day > 1,
                              'rounded-r-none': joinsRight && cell.date.day < lastDay,
                            })}
                          >
                            {cell.label}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
