import React, { ReactNode, useCallback } from 'react'
import { Toggle as BaseToggle } from '@base-ui/react'
import { cn } from '../common'
import { useToggle } from './toggle-context'

export type ToggleItemProps = {
  value: string
  className?: string
  children: ReactNode
}

export const Item = ({ value, className, children }: ToggleItemProps) => {
  const { value: selectedValue, disabled, size, isBinaryToggle, registerItem } = useToggle()

  const isSelected = value === selectedValue

  const refCallback = useCallback(
    (el: HTMLButtonElement | null) => {
      registerItem(value, el)
    },
    [registerItem, value],
  )

  // For binary toggles, all items are not focusable (container handles focus)
  // For multi-item toggles, selected item is not focusable
  const tabIndex = isBinaryToggle || isSelected ? -1 : undefined

  return (
    <BaseToggle
      ref={refCallback}
      value={value}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-label={typeof children === 'string' ? children : undefined}
      data-selected={isSelected || undefined}
      data-unselected={!isSelected || undefined}
      className={cn(
        'relative z-10 inline-flex items-center justify-center font-semibold',
        'outline-none transition-colors duration-150 whitespace-nowrap',
        'text-gray-400 dark:text-zinc-400 data-[pressed]:text-gray-600 dark:data-[pressed]:text-zinc-100 dark:hover:text-zinc-100',
        {
          'h-5 px-2 text-3xs rounded-sm': size === 'sm',
          'h-6 px-3 text-2xs rounded': size === 'md',
          'h-8 px-4 text-xs rounded-md': size === 'lg',
          'focus-visible:text-gray-600 dark:focus-visible:text-zinc-400': !isBinaryToggle,
          'cursor-not-allowed': disabled,
        },
        className,
      )}
    >
      {children}
    </BaseToggle>
  )
}
