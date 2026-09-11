import React from 'react'
import { cn } from '../common'
import { useToggle } from './toggle-context'
import { useIndicator } from './use-indicator'

export const Indicator = () => {
  const { size } = useToggle()
  const { width, left, animationsEnabled } = useIndicator()

  if (width === null || left === null) {
    return null
  }

  return (
    <span
      aria-hidden="true"
      data-indicator
      className={cn('absolute top-0.5 z-0 bg-white dark:bg-zinc-700 shadow-sm', {
        'h-[calc(100%-4px)] rounded-sm': size === 'sm',
        'h-[calc(100%-4px)] rounded': size === 'md',
        'h-[calc(100%-4px)] rounded-md': size === 'lg',
        'transition-[left,width] duration-200 ease-out': animationsEnabled,
      })}
      style={{ width, left }}
    />
  )
}
