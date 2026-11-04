import { Popover } from '@base-ui/react/popover'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import { useId, useRef, useState } from 'react'
import { Button } from '../button'
import { cn } from '../common/cn'
import { IconButton } from '../icon-button'
import type { InputProps } from '../input'
import { inputFrameClassName, inputTextClassName } from '../input/field-classes'
import { Calendar, isCalendarValue } from './calendar'
import { TimeColumn } from './time-column'

export type DatePickerPrecision = 'year' | 'month' | 'day'

interface PickerProps {
  /** Canonical calendar value. Date-times are local wall-clock values without an offset. */
  value: string | null
  onValueChange: (value: string | null) => void
  label: string
  min?: string
  max?: string
  name?: string
  id?: string
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  invalid?: boolean
  'aria-describedby'?: string
  /** Field height, as for `Input`. */
  size?: InputProps['size']
  /** Field surface, as for `Input`. */
  variant?: InputProps['variant']
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface DatePickerProps extends PickerProps {
  precision?: DatePickerPrecision
}

export interface DateTimePickerProps extends PickerProps {
  hourCycle?: 12 | 24
  /** Time to use when a date is chosen without a time, in HH:mm. */
  defaultTime?: string
}

const TRIGGER_SIZE = { md: 'sm', lg: 'md', xl: 'lg' } as const

const pad = (value: number) => String(value).padStart(2, '0')

const canonicalDate = (text: string, precision: DatePickerPrecision): string | null =>
  isCalendarValue(text, precision) ? text : null

const canonicalTime = (text: string, hourCycle: 12 | 24): string | null => {
  const match =
    hourCycle === 24
      ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text)
      : /^(0[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/i.exec(text)
  if (!match) {
    return null
  }
  const hour = Number(match[1])
  return `${pad(hourCycle === 24 ? hour : (hour % 12) + (match[3]?.toUpperCase() === 'PM' ? 12 : 0))}:${match[2]}`
}

const displayValue = (value: string | null, hourCycle: 12 | 24) => {
  if (!value) {
    return ''
  }
  const [date, time] = value.split('T')
  if (!time) {
    return date!
  }
  const hour = Number(time.slice(0, 2))
  return `${date} ${hourCycle === 24 ? time : `${pad(hour % 12 || 12)}:${time.slice(3)} ${hour < 12 ? 'AM' : 'PM'}`}`
}

/** Calendar and clock selection share one field and one popup. */
const Picker = ({
  value,
  onValueChange,
  label,
  min,
  max,
  name,
  id,
  disabled,
  required,
  readOnly,
  invalid,
  'aria-describedby': describedBy,
  size = 'lg',
  variant = 'default',
  className,
  open: controlledOpen,
  onOpenChange,
  precision = 'day',
  withTime = false,
  hourCycle = 24,
  defaultTime,
}: PickerProps & {
  precision?: DatePickerPrecision
  withTime?: boolean
  hourCycle?: 12 | 24
  defaultTime?: string
}) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-format`
  const [editing, setEditing] = useState({ value, hourCycle, text: displayValue(value, hourCycle) })
  if (editing.value !== value || editing.hourCycle !== hourCycle) {
    setEditing({ value, hourCycle, text: displayValue(value, hourCycle) })
  }
  const text = editing.text
  const [dateText = '', ...timeParts] = text.split(' ')
  const timeText = timeParts.join(' ')
  const selectedDate = canonicalDate(withTime ? dateText : text, precision)
  const selectedTime = canonicalTime(timeText, hourCycle)
  const candidate =
    selectedDate && (!withTime || selectedTime)
      ? `${selectedDate}${withTime ? `T${selectedTime}` : ''}`
      : null
  const inBounds = !!candidate && (!min || candidate >= min) && (!max || candidate <= max)
  const selectedValue = inBounds ? candidate : null
  const isInvalid = !!invalid || (!!text && !selectedValue)
  const format = withTime
    ? `YYYY-MM-DD ${hourCycle === 24 ? 'HH:mm' : 'hh:mm AM/PM'}`
    : precision === 'year'
      ? 'YYYY'
      : precision === 'month'
        ? 'YYYY-MM'
        : 'YYYY-MM-DD'
  const [internalOpen, setInternalOpen] = useState(false)
  const open = !disabled && !readOnly && (controlledOpen ?? internalOpen)
  // An outside press leaves focus where it landed; every other close returns it to the field.
  const closedByOutsidePress = useRef(false)
  const setOpen = (next: boolean, reason?: string) => {
    closedByOutsidePress.current = reason === 'outside-press'
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  const portalContainer = useRef<HTMLElement | null>(null)
  const frame = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const focusCell = useRef<HTMLButtonElement | null>(null)
  const touched = useRef(false)
  const publish = (nextText: string) => {
    const [date = '', ...rest] = nextText.split(' ')
    const nextDate = canonicalDate(withTime ? date : nextText, precision)
    const nextTime = canonicalTime(rest.join(' '), hourCycle)
    const next =
      nextDate && (!withTime || nextTime) ? `${nextDate}${withTime ? `T${nextTime}` : ''}` : null
    const valid = next && (!min || next >= min) && (!max || next <= max) ? next : null
    touched.current = true
    setEditing({ value: valid, hourCycle, text: nextText })
    onValueChange(valid)
  }
  const defaultTimeText =
    defaultTime && canonicalTime(defaultTime, 24)
      ? displayValue(`2000-01-01T${defaultTime}`, hourCycle).split(' ').slice(1).join(' ')
      : ''
  const timeTokens = /^(\d{2}|--):(\d{2}|--)(?: (AM|PM))?$/.exec(timeText)
  const hour = timeTokens?.[1] ?? '--'
  const minute = timeTokens?.[2] ?? '--'
  const period = timeTokens?.[3] ?? 'AM'
  const chooseTime = (nextHour: string, nextMinute: string, nextPeriod = period) =>
    publish(`${dateText} ${nextHour}:${nextMinute}${hourCycle === 12 ? ` ${nextPeriod}` : ''}`)
  const showInvalid = isInvalid && (!!invalid || touched.current)

  return (
    <div
      ref={(node) => {
        // Keep the popup inside a containing modal's focus boundary.
        portalContainer.current =
          node?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null
      }}
      className={cn('min-w-0', className)}
    >
      {name ? (
        <input type="hidden" name={name} value={selectedValue ?? ''} disabled={disabled} />
      ) : null}
      <Popover.Root open={open} onOpenChange={(next, details) => setOpen(next, details.reason)}>
        <div
          ref={frame}
          className={inputFrameClassName({ variant, size, disabled, invalid: showInvalid })}
          data-disabled={disabled || undefined}
          data-invalid={showInvalid || undefined}
        >
          <input
            ref={(node) => {
              inputRef.current = node
              node?.setCustomValidity(
                isInvalid
                  ? `Enter a valid ${format}${min || max ? ' within the allowed range' : ''}.`
                  : '',
              )
            }}
            id={inputId}
            type="text"
            autoComplete="off"
            aria-label={label}
            aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
            aria-invalid={showInvalid || undefined}
            placeholder={format}
            value={text}
            disabled={disabled}
            required={required}
            readOnly={readOnly}
            onChange={(event) => publish(event.currentTarget.value)}
            onBlur={() => {
              touched.current = true
              if (withTime && defaultTimeText && canonicalDate(text, 'day')) {
                publish(`${text} ${defaultTimeText}`)
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                withTime &&
                defaultTimeText &&
                canonicalDate(text, 'day')
              ) {
                publish(`${text} ${defaultTimeText}`)
              }
              if (event.key === 'ArrowDown' && !disabled && !readOnly) {
                event.preventDefault()
                setOpen(true)
              }
            }}
            className={inputTextClassName({ variant, size, disabled })}
          />
          <Popover.Trigger
            disabled={disabled || readOnly}
            aria-label={`Open ${label.toLowerCase()} calendar`}
            render={
              <IconButton
                size={TRIGGER_SIZE[size]}
                variant="muted"
                className={cn('self-center', variant !== 'ghost' && 'mr-1')}
              >
                <CalendarBlankIcon />
              </IconButton>
            }
          />
        </div>
        <span id={hintId} className="sr-only">
          {format}. Use the down arrow to open the calendar.
        </span>
        <Popover.Portal container={portalContainer}>
          <Popover.Positioner
            anchor={frame}
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-[1100] outline-none"
          >
            <Popover.Popup
              initialFocus={focusCell}
              finalFocus={() => !closedByOutsidePress.current && inputRef.current}
              aria-label={`${label} calendar`}
              className={cn(
                'max-w-[calc(100vw-2rem)] rounded-lg border border-gray-100 bg-white p-3 text-gray shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                withTime ? (hourCycle === 12 ? 'w-[28rem]' : 'w-96') : 'w-64',
              )}
            >
              <div className={cn(withTime && 'flex flex-col gap-3 sm:flex-row')}>
                <div className="min-w-0 flex-1">
                  <Calendar
                    precision={precision}
                    value={selectedDate}
                    min={min?.split('T')[0]}
                    max={max?.split('T')[0]}
                    focusRef={focusCell}
                    onSelect={(date) => {
                      if (withTime) {
                        publish(
                          `${date} ${timeText || defaultTimeText || `--:--${hourCycle === 12 ? ' AM' : ''}`}`,
                        )
                        return
                      }
                      publish(date)
                      setOpen(false)
                    }}
                  />
                </div>
                {withTime ? (
                  <div className="flex shrink-0 gap-2 border-t border-gray-100 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3 dark:border-zinc-700">
                    <TimeColumn
                      label="Hour"
                      values={Array.from({ length: hourCycle }, (_, index) =>
                        pad(hourCycle === 12 ? index + 1 : index),
                      )}
                      value={hour}
                      onChange={(next) => chooseTime(next, minute)}
                    />
                    <TimeColumn
                      label="Minute"
                      values={Array.from({ length: 60 }, (_, index) => pad(index))}
                      value={minute}
                      onChange={(next) => chooseTime(hour, next)}
                    />
                    {hourCycle === 12 ? (
                      <TimeColumn
                        label="Period"
                        values={['AM', 'PM']}
                        value={period}
                        onChange={(next) => chooseTime(hour, minute, next)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              {withTime ? (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-2 dark:border-zinc-700">
                  <span aria-live="polite" className="text-xs text-gray-300 dark:text-zinc-400">
                    {text || 'Select a date and time'}
                  </span>
                  <Button
                    variant="info"
                    size="sm"
                    disabled={!selectedValue}
                    onClick={() => setOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              ) : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

export const DatePicker = (props: DatePickerProps) => <Picker {...props} />

/** Minute-precision local date-time. The caller applies a time zone explicitly. */
export const DateTimePicker = ({ hourCycle, ...props }: DateTimePickerProps) => (
  <Picker
    {...props}
    withTime
    hourCycle={
      hourCycle ??
      (new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ? 12 : 24)
    }
  />
)
