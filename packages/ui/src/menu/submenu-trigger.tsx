import React, { RefAttributes } from 'react'
import {
  Menu as BaseMenu,
  MenuSubmenuTriggerProps as BaseMenuSubmenuTriggerProps,
  ContextMenu,
} from '@base-ui/react'
import { cn } from '../common'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useMenu } from './menu-context'

export type MenuSubmenuTriggerProps = BaseMenuSubmenuTriggerProps & RefAttributes<HTMLElement>

export const SubmenuTrigger = ({ className, children, ...props }: MenuSubmenuTriggerProps) => {
  const { context } = useMenu()
  const submenuTriggerClass = cn(
    'group flex w-full items-center p-2 py-1 text-left whitespace-nowrap',
    'text-xs font-medium outline-none text-gray dark:text-zinc-200 data-[highlighted]:bg-gray-50 dark:data-[highlighted]:bg-zinc-800',
    'font-body',
    className,
  )

  if (context) {
    return (
      <ContextMenu.SubmenuTrigger
        className={submenuTriggerClass}
        {...(props as MenuSubmenuTriggerProps)}
      >
        <div className="flex-1">{children}</div>
        <CaretRightIcon weight="regular" className="size-3" />
      </ContextMenu.SubmenuTrigger>
    )
  }

  return (
    <BaseMenu.SubmenuTrigger
      nativeButton={false}
      render={(renderProps) => (
        <div {...renderProps} tabIndex={-1} className={submenuTriggerClass}>
          <div className="flex-1">{renderProps.children}</div>
          <CaretRightIcon weight="regular" className="size-3" />
        </div>
      )}
      {...(props as MenuSubmenuTriggerProps)}
    >
      {children}
    </BaseMenu.SubmenuTrigger>
  )
}
