import React from 'react'
import {
  Combobox as BaseCombobox,
  ComboboxGroupLabelProps as BaseComboboxGroupLabelProps,
} from '@base-ui/react'
import { cn } from '../common'

export type ComboboxGroupLabelProps = BaseComboboxGroupLabelProps

export const GroupLabel = ({ className, children, ...props }: ComboboxGroupLabelProps) => (
  <BaseCombobox.GroupLabel
    className={cn(
      'px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-300 font-body dark:text-zinc-500',
      className,
    )}
    {...props}
  >
    {children}
  </BaseCombobox.GroupLabel>
)
