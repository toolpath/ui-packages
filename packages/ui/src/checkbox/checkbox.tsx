import React, { useRef } from 'react'
import { Checkbox as BaseCheckbox, CheckboxRootProps } from '@base-ui/react'
import { cn } from '../common'
import { CheckIcon, MinusIcon } from '@phosphor-icons/react'

export interface CheckboxChangeEvent {
  shiftKey: boolean
}

export type CheckboxProps = CheckboxRootProps & {
  checked: boolean
  onChange: (checked: boolean, event: CheckboxChangeEvent) => void
  name: string
  className?: string
  disabled?: boolean
  indeterminate?: boolean
  tabIndex?: number
  variant?: 'default' | 'muted'
  size?: 'md' | 'sm'
}

export const Checkbox = ({
  checked,
  onChange,
  name,
  className,
  disabled = false,
  indeterminate = false,
  variant = 'default',
  size = 'md',
  ...props
}: CheckboxProps) => {
  if (checked && indeterminate) {
    throw new Error('Checkbox cannot be both checked & indeterminate.')
  }

  const isActive = checked || indeterminate
  const shiftKeyRef = useRef(false)

  return (
    <BaseCheckbox.Root
      name={name}
      checked={checked}
      indeterminate={indeterminate}
      onClick={(e) => {
        shiftKeyRef.current = e.shiftKey
      }}
      onCheckedChange={(newChecked) => {
        onChange(newChecked, { shiftKey: shiftKeyRef.current })
      }}
      disabled={disabled}
      className={cn(
        'flex cursor-pointer items-center justify-center bg-white outline-none focus-visible:ring-2 ring-info/75 ring-offset-1 dark:bg-zinc-900 dark:ring-offset-zinc-950',
        'border dark:border-zinc-500',
        {
          'size-4 rounded': size === 'md',
          'size-3 rounded-sm': size === 'sm',
          'bg-gray-300 dark:bg-zinc-800': variant === 'muted' && isActive,
          'bg-info': variant === 'default' && isActive,
          'bg-transparent': !isActive,
          'border-none text-white': isActive,
          'cursor-not-allowed saturate-50': disabled,
          'bg-gray-50 dark:bg-zinc-950': !isActive && disabled,
          'text-white/65': isActive && disabled,
        },
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex items-center justify-center text-white" keepMounted>
        {checked && <CheckIcon weight="bold" className="w-full h-full" />}
        {indeterminate && <MinusIcon weight="bold" className="w-full h-full" />}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
