import React, { HTMLAttributes, useMemo } from 'react'
import { cn } from '../common'
import { Tooltip } from '../tooltip/tooltip'
import { formatFullDate, formatRelativeTime } from './format-time'

export type AttributionAtProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  date: string | Date
  hideTime?: boolean
}

export const At = ({ date, hideTime = false, className, ...props }: AttributionAtProps) => {
  const parsed = useMemo(() => new Date(date), [date])

  const formattedTime = useMemo(() => formatRelativeTime(parsed, hideTime), [parsed, hideTime])

  const fullDate = useMemo(() => formatFullDate(parsed), [parsed])

  return (
    <>
      {' '}
      <Tooltip tip={fullDate}>
        <span className={cn('inline-block', className)} {...props}>
          {formattedTime}
        </span>
      </Tooltip>
    </>
  )
}
