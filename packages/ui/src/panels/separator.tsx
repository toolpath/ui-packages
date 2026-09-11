import React, { useCallback } from 'react'
import {
  Separator as BaseSeparator,
  type SeparatorProps as BaseSeparatorProps,
} from 'react-resizable-panels'
import { cn } from '../common'
import { useOrientation } from './orientation-context'

type SeparatorProps = Omit<BaseSeparatorProps, 'elementRef'> & {
  elementRef?: BaseSeparatorProps['elementRef']
}

export const Separator = ({ elementRef, className, ...props }: SeparatorProps) => {
  const orientation = useOrientation()

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        el.tabIndex = -1
      }
      if (typeof elementRef === 'function') {
        elementRef(el)
      } else if (elementRef) {
        elementRef.current = el
      }
    },
    [elementRef],
  )

  return (
    <BaseSeparator
      elementRef={ref}
      className={cn(
        'border-gray-100 dark:border-zinc-800 outline-none',
        {
          'border-r': orientation === 'horizontal',
          'border-t': orientation === 'vertical',
        },
        className,
      )}
      {...props}
    />
  )
}
