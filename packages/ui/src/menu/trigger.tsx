import React, { RefAttributes } from 'react'
import {
  Menu as BaseMenu,
  MenuTriggerProps as BaseMenuTriggerProps,
  ContextMenu,
  ContextMenuTriggerProps,
} from '@base-ui/react'
import { cn } from '../common'
import { useMenu } from './menu-context'

export type MenuTriggerProps =
  | (BaseMenuTriggerProps & RefAttributes<HTMLElement>)
  | (ContextMenuTriggerProps & RefAttributes<HTMLDivElement>)

export const Trigger = ({ className, children, ...props }: MenuTriggerProps) => {
  const { context } = useMenu()

  if (context) {
    return (
      <ContextMenu.Trigger
        className={cn('inline-block outline-none', className)}
        {...(props as ContextMenuTriggerProps)}
      >
        {children}
      </ContextMenu.Trigger>
    )
  }

  return (
    <BaseMenu.Trigger
      nativeButton={false}
      onClick={(e) => e.stopPropagation()}
      render={(renderProps) => (
        <div {...renderProps} tabIndex={-1} className={cn('inline-block outline-none', className)}>
          {renderProps.children}
        </div>
      )}
      {...(props as BaseMenuTriggerProps)}
    >
      {children}
    </BaseMenu.Trigger>
  )
}
