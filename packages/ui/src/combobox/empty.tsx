import React, { HTMLAttributes, ReactNode } from 'react'
import { Combobox as BaseCombobox } from '@base-ui/react'
import { cn } from '../common'

export type ComboboxEmptyProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode
}

export const Empty = ({ className, children = 'No matches', ...props }: ComboboxEmptyProps) => {
  return (
    <BaseCombobox.Empty
      className={cn(
        'w-full [[data-empty]_&]:py-4 text-center text-gray-300 text-xs dark:text-zinc-400',
        className,
      )}
      {...props}
    >
      {children}
    </BaseCombobox.Empty>
  )
}
