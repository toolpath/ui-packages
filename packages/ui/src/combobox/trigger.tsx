import React, { HTMLAttributes, RefAttributes } from 'react'
import {
  Combobox as BaseCombobox,
  ComboboxTriggerProps as BaseComboboxTriggerProps,
} from '@base-ui/react'
import { cn } from '../common'

export type ComboboxTriggerProps = BaseComboboxTriggerProps & RefAttributes<HTMLElement>

export const Trigger = ({
  className,
  children,
  nativeButton = false,
  render,
  ...props
}: ComboboxTriggerProps) => {
  const defaultRender = (renderProps: HTMLAttributes<HTMLElement>) => (
    <div {...renderProps} tabIndex={-1} className={cn('block outline-none w-full', className)}>
      {renderProps.children}
    </div>
  )

  return (
    <BaseCombobox.Trigger
      nativeButton={nativeButton}
      render={!nativeButton ? defaultRender : render}
      className={!nativeButton ? '' : className}
      {...(props as BaseComboboxTriggerProps)}
    >
      {children}
    </BaseCombobox.Trigger>
  )
}
