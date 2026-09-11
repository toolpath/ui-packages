import React, { useRef } from 'react'
import { cn } from '../common'
import { StarIcon } from '@phosphor-icons/react'

export interface StarChangeEvent {
  shiftKey: boolean
}

export type StarProps = {
  checked: boolean
  onChange: (checked: boolean, event: StarChangeEvent) => void
  name: string
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  tabIndex?: number
}

export const Star = ({
  checked,
  onChange,
  name,
  className,
  disabled = false,
  size = 'md',
  tabIndex = 0,
}: StarProps) => {
  const shiftKeyRef = useRef(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) {
      return
    }
    shiftKeyRef.current = e.shiftKey
    onChange(!checked, { shiftKey: shiftKeyRef.current })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) {
      return
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      shiftKeyRef.current = e.shiftKey
      onChange(!checked, { shiftKey: shiftKeyRef.current })
    }
  }

  const sizeClasses = {
    sm: 'size-3',
    md: 'size-4',
    lg: 'size-5',
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      name={name}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group grid cursor-pointer outline-none',
        'focus-visible:ring-2 ring-info/75 ring-offset-1 rounded-sm',
        'transition-colors duration-150',
        {
          'cursor-not-allowed opacity-50': disabled,
        },
        className,
      )}
    >
      <StarIcon
        weight="fill"
        className={cn(
          sizeClasses[size],
          'col-start-1 row-start-1 transition-opacity duration-150 pointer-event-none',
          {
            'text-warning': checked,
            'text-transparent': !checked,
            'group-hover:text-warning': !disabled && !checked,
          },
        )}
      />
      <StarIcon
        weight="regular"
        className={cn(sizeClasses[size], 'col-start-1 row-start-1 pointer-event-none', {
          'text-[#F0D360]': checked,
          'text-gray-200 group-hover:text-gray-200 dark:text-zinc-500 group-hover:dark:text-warning-darken/75':
            !checked && !disabled,
          'text-gray-200 dark:text-zinc-800': !checked && disabled,
        })}
      />
    </button>
  )
}
