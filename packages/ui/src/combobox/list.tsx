import React from 'react'
import {
  Combobox as BaseCombobox,
  ComboboxListProps as BaseComboboxListProps,
} from '@base-ui/react'
import { cn } from '../common'

export type ComboboxListProps = BaseComboboxListProps

export const List = ({ className, children, ...props }: ComboboxListProps) => {
  return (
    <BaseCombobox.List
      className={cn('hide-scrollbar max-h-32 overflow-auto outline-none', className)}
      {...props}
    >
      {children}
    </BaseCombobox.List>
  )
}
