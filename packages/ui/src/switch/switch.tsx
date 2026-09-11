import React from 'react'
import { Switch as BaseSwitch, SwitchRootProps } from '@base-ui/react'
import { cn } from '../common'

export type SwitchProps = SwitchRootProps

export const Switch = ({
  checked,
  onCheckedChange,
  disabled = false,
  className = '',
  ...props
}: SwitchProps) => {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-info/50 focus:ring-offset-1 ring-offset-white dark:ring-offset-zinc-800 dark:focus:ring-info/75',
        'data-[checked]:bg-info dark:data-[checked]:bg-info/75 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        data-thumb
        className="inline-block h-4 w-4 bg-white dark:bg-zinc-100 translate-x-1 rounded-full transition-transform data-[checked]:translate-x-6"
      />
    </BaseSwitch.Root>
  )
}
