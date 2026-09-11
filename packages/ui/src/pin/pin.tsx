import React, { useRef } from 'react'
import { cn } from '../common'
import { PushPinIcon } from '@phosphor-icons/react'

export interface PinChangeEvent {
  shiftKey: boolean
}

export type PinProps = {
  checked: boolean
  onChange: (checked: boolean, event: PinChangeEvent) => void
  name: string
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  tabIndex?: number
}

export const Pin = ({
  checked,
  onChange,
  name,
  className,
  disabled = false,
  size = 'md',
  tabIndex = 0,
}: PinProps) => {
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
      <PushPinIcon
        weight="fill"
        className={cn(
          sizeClasses[size],
          'col-start-1 row-start-1 transition-opacity duration-150 pointer-event-none',
          {
            'text-gray-200 dark:text-zinc-100': checked,
            'text-transparent': !checked,
            'group-hover:text-gray-200 dark:group-hover:text-zinc-400': !disabled && !checked,
          },
        )}
      />
      <PushPinIcon
        weight="regular"
        className={cn(sizeClasses[size], 'col-start-1 row-start-1 pointer-event-none', {
          'text-gray-200 dark:text-zinc-100': checked,
          'text-gray-200 group-hover:text-gray-200 dark:text-zinc-400 group-hover:dark:text-zinc-400':
            !checked && !disabled,
          'text-gray-200 dark:text-zinc-400': !checked && disabled,
        })}
      />
    </button>
  )
}
