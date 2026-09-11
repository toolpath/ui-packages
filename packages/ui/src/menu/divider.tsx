import React from 'react'
import { Menu as BaseMenu, ContextMenu, SeparatorProps } from '@base-ui/react'
import { cn } from '../common'
import { useMenu } from './menu-context'

export type MenuDividerProps = SeparatorProps

export const Divider = ({ className, ...props }: MenuDividerProps) => {
  const { context } = useMenu()
  const dividerClass = cn('mx-1 border-t border-gray-100 dark:border-zinc-800', className)

  if (context) {
    return <ContextMenu.Separator className={dividerClass} {...props} />
  }

  return <BaseMenu.Separator className={dividerClass} {...props} />
}
