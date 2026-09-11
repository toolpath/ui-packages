import React from 'react'
import { Menu as BaseMenu, ContextMenu, MenuPopupProps, MenuPositionerProps } from '@base-ui/react'
import { cn } from '../common'
import { useMenu } from './menu-context'

export type MenuPopoverProps = MenuPopupProps & Omit<MenuPositionerProps, 'children'>

export const Popover = ({
  className,
  anchor,
  positionMethod,
  side,
  sideOffset,
  align,
  alignOffset,
  collisionBoundary,
  collisionPadding,
  sticky,
  arrowPadding,
  disableAnchorTracking,
  collisionAvoidance,
  children,
  ...props
}: MenuPopoverProps) => {
  const { context, submenu } = useMenu()

  const positionerProps = {
    className: 'outline-none z-50',
    side: side || (context || submenu ? 'right' : 'bottom'),
    align: align || (context || submenu ? 'start' : 'end'),
    anchor,
    positionMethod,
    sideOffset,
    alignOffset,
    collisionBoundary,
    collisionPadding,
    sticky,
    arrowPadding,
    disableAnchorTracking,
    collisionAvoidance,
  } as const

  const popupClassName = cn(
    'outline-none border border-gray-100 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 overflow-hidden font-body',
    className,
  )

  if (context) {
    return (
      <ContextMenu.Portal>
        <ContextMenu.Positioner {...positionerProps}>
          <ContextMenu.Popup className={popupClassName} {...props}>
            {children}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    )
  }

  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner {...positionerProps}>
        <BaseMenu.Popup className={popupClassName} {...props}>
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}
