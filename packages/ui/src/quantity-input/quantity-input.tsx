import React, { ChangeEvent, MouseEvent, Ref } from 'react'
import { cn } from '../common'
import { MinusIcon, PlusIcon } from '@phosphor-icons/react'

export type QuantityInputProps = {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'muted'
  disabled?: boolean
  className?: string
  id?: string
  ref?: Ref<HTMLInputElement>
}

export const QuantityInput = ({
  value,
  onValueChange,
  min = 0,
  max = Infinity,
  step = 1,
  size = 'md',
  variant = 'default',
  disabled = false,
  className,
  id,
  ref,
}: QuantityInputProps) => {
  const handleDecrement = (e: MouseEvent) => {
    e.preventDefault()
    const next = value - step
    if (next >= min) {
      onValueChange(next)
    }
  }

  const handleIncrement = (e: MouseEvent) => {
    e.preventDefault()
    const next = value + step
    if (next <= max) {
      onValueChange(next)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      return
    }
    const parsed = Number(raw)
    if (!isNaN(parsed)) {
      onValueChange(Math.min(max, Math.max(min, parsed)))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = value + step
      if (next <= max) {
        onValueChange(next)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = value - step
      if (next >= min) {
        onValueChange(next)
      }
    }
  }

  const handleBlur = () => {
    onValueChange(Math.min(max, Math.max(min, value)))
  }

  const atMin = value <= min
  const atMax = value >= max

  return (
    <div
      className={cn(
        'inline-flex items-stretch overflow-hidden font-medium',
        'focus-within:ring-2 ring-info/50 dark:ring-info/75',
        {
          'border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-within:border-info dark:focus-within:border-info':
            variant === 'default',
          'bg-gray-50 dark:bg-zinc-800': variant === 'muted',
          'h-5 rounded text-xs': size === 'sm',
          'h-6 rounded text-xs': size === 'md',
          'h-7 rounded text-sm': size === 'lg',
          'h-9 rounded-md text-lg': size === 'xl',
          'opacity-50 pointer-events-none': disabled,
        },
        className,
      )}
      data-disabled={disabled || undefined}
    >
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || atMin}
        onClick={handleDecrement}
        className={cn(
          'flex shrink-0 items-center justify-center bg-gray-200 dark:bg-zinc-800 transition-colors cursor-pointer',
          'hover:bg-gray-300 dark:hover:bg-zinc-900 active:bg-gray-400 dark:active:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none',
          {
            'w-5': size === 'sm',
            'w-6': size === 'md',
            'w-7': size === 'lg',
            'w-9': size === 'xl',
          },
        )}
      >
        <MinusIcon weight="bold" className="size-3.5 text-white dark:text-zinc-100" />
      </button>
      <input
        ref={ref}
        id={id}
        data-testid={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-center text-gray-500 dark:text-zinc-100 outline-none',
          {
            'px-1': size === 'sm' || size === 'md',
            'px-2': size === 'lg' || size === 'xl',
          },
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || atMax}
        onClick={handleIncrement}
        className={cn(
          'flex shrink-0 items-center justify-center bg-gray-200 dark:bg-zinc-800 transition-colors cursor-pointer',
          'hover:bg-gray-300 dark:hover:bg-zinc-900 active:bg-gray-400 dark:active:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none',
          {
            'w-5': size === 'sm',
            'w-6': size === 'md',
            'w-7': size === 'lg',
            'w-9': size === 'xl',
          },
        )}
      >
        <PlusIcon weight="bold" className="size-3.5 text-white dark:text-zinc-100" />
      </button>
    </div>
  )
}
