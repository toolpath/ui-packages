import { useEffect, useRef, useState } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { FOCUS_RING } from '../dfm-rule-list/styles'

/** A `0xrrggbb` colour as CSS. */
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

/** What every row of the two tabs looks like, a button across the list's width. */
export const ROW = cn(
  'flex w-full cursor-pointer items-center gap-2 rounded text-left',
  'hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:cursor-default',
  FOCUS_RING,
)

/** The caret that turns down where a row is open. */
export const Caret = ({
  open,
  size = 'size-3.5',
  className,
}: {
  open: boolean
  size?: string
  className?: string
}) => (
  <CaretRightIcon
    aria-hidden
    weight="bold"
    className={cn(
      size,
      'shrink-0 text-gray-300 transition-transform duration-150 dark:text-zinc-500',
      open && 'rotate-90',
      className,
    )}
  />
)

/** A body's colour, round, or a group's, square; outlined where there is no colour. */
export const Dot = ({
  color,
  square = false,
}: {
  color: number | null | undefined
  square?: boolean
}) => (
  <span
    aria-hidden
    className={cn(
      'inline-block size-2.5 shrink-0',
      square ? 'rounded-sm' : 'rounded-full',
      color == null && 'border border-gray-400',
    )}
    style={color == null ? undefined : { backgroundColor: hex(color) }}
  />
)

/** The keys of the rows that are open, and a way to open or close one. */
export const useOpenSet = (): [ReadonlySet<string>, (key: string) => void] => {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string): void =>
    setOpen((old) => {
      const next = new Set(old)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  return [open, toggle]
}

/** Runs the latest `cleanup` once, when the component unmounts. */
export const useOnUnmount = (cleanup: () => void): void => {
  const latest = useRef(cleanup)
  useEffect(() => {
    latest.current = cleanup
  })
  useEffect(
    () => () => {
      latest.current()
    },
    [],
  )
}
