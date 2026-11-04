import { Popover } from '@base-ui/react/popover'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { cn } from '../common/cn'
import type { InputProps } from '../input'
import { inputFrameClassName } from '../input/field-classes'
import { addDays, Calendar } from './calendar'

export interface DateRange {
  /** First day, `YYYY-MM-DD`. */
  from: string
  /** Last day, `YYYY-MM-DD`, included in the range. */
  to: string
}

export interface DateRangePickerProps {
  value: DateRange | null
  /** Called once both ends are chosen. */
  onValueChange: (value: DateRange) => void
  label: string
  min?: string
  max?: string
  /** The longest range, in days, counting both ends. */
  maxDays?: number
  placeholder?: string
  disabled?: boolean
  /** Trigger height, as for `Input`. */
  size?: InputProps['size']
  /** Trigger surface, as for `Input`. */
  variant?: InputProps['variant']
  /** Classes of your own, after the trigger's: a later class wins over one it replaces. */
  className?: string
}

// The calendar's month and weekday names are English, so its summary is too.
const rangeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const utc = (date: string) => new Date(`${date}T00:00:00Z`)
const laterOf = (bound: string | undefined, date: string) => (bound && bound > date ? bound : date)
const earlierOf = (bound: string | undefined, date: string) =>
  bound && bound < date ? bound : date

/** Two months side by side; two choices in either order make the range. */
export const DateRangePicker = ({
  value,
  onValueChange,
  label,
  min,
  max,
  maxDays,
  placeholder = 'Pick a date range',
  disabled,
  size = 'lg',
  variant = 'default',
  className,
}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<{ from: string; to: string | null } | null>(value)
  const portalContainer = useRef<HTMLElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const focusCell = useRef<HTMLButtonElement | null>(null)
  // An outside press leaves focus where it landed; every other close returns it to the trigger.
  const closedByOutsidePress = useRef(false)
  const changeOpen = (next: boolean, reason?: string) => {
    closedByOutsidePress.current = reason === 'outside-press'
    // Each opening starts from the chosen range, so closing discards an unfinished one.
    setDraft(value)
    setOpen(next)
  }
  const choose = (date: string) => {
    if (!draft || draft.to) {
      setDraft({ from: date, to: null })
      return
    }
    onValueChange(
      date < draft.from ? { from: date, to: draft.from } : { from: draft.from, to: date },
    )
    changeOpen(false)
  }
  // While the other end is chosen, the longest range reaches either way from the first.
  const anchor = draft && !draft.to ? draft.from : null
  const earliest = anchor && maxDays ? laterOf(min, addDays(anchor, 1 - maxDays)) : min
  const latest = anchor && maxDays ? earlierOf(max, addDays(anchor, maxDays - 1)) : max
  const text = value ? rangeFormat.formatRange(utc(value.from), utc(value.to)) : ''

  return (
    <Popover.Root
      open={open && !disabled}
      onOpenChange={(next, details) => changeOpen(next, details.reason)}
    >
      <Popover.Trigger
        ref={(node: HTMLButtonElement | null) => {
          trigger.current = node
          // Keep the popup inside a containing modal's focus boundary.
          portalContainer.current =
            node?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null
        }}
        disabled={disabled}
        aria-label={text ? `${label}, ${text}` : label}
        className={cn(
          inputFrameClassName({ variant, size, disabled }),
          'items-center gap-1.5 text-left outline-none',
          {
            'px-1': size === 'md' && variant !== 'ghost',
            'px-2': size !== 'md' && variant !== 'ghost',
            'cursor-not-allowed': disabled,
          },
          className,
        )}
      >
        <span
          className={cn('min-w-0 flex-1 truncate', !text && 'text-gray-300 dark:text-zinc-400')}
        >
          {text || placeholder}
        </span>
        {/* At the end, where a Combobox has its caret and a DatePicker its calendar button. */}
        <CalendarBlankIcon
          aria-hidden
          className={cn(
            'shrink-0 text-gray-300 dark:text-zinc-400',
            size === 'xl' ? 'size-4' : 'size-3.5',
          )}
        />
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-[1100] outline-none"
        >
          <Popover.Popup
            initialFocus={focusCell}
            finalFocus={() => !closedByOutsidePress.current && trigger.current}
            aria-label={`${label} calendar`}
            className="w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-100 bg-white p-3 text-gray shadow-xl outline-none sm:w-[32rem] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <Calendar
              precision="day"
              months={2}
              value={draft?.from ?? null}
              range={draft}
              min={earliest}
              max={latest}
              focusRef={focusCell}
              onSelect={choose}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
