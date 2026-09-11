import React from 'react'
import {
  Combobox as BaseCombobox,
  ComboboxPopupProps,
  ComboboxPositionerProps,
} from '@base-ui/react'
import { cn } from '../common'

export type ComboboxPopoverProps = ComboboxPopupProps & Omit<ComboboxPositionerProps, 'children'>

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
}: ComboboxPopoverProps) => {
  const positionerProps = {
    className: 'outline-none z-50',
    side: side || 'bottom',
    align: align || 'start',
    sideOffset: sideOffset ?? -1,
    anchor,
    positionMethod,
    alignOffset,
    collisionBoundary,
    collisionPadding,
    sticky,
    arrowPadding,
    disableAnchorTracking,
    collisionAvoidance,
  } as const

  const popupClassName = cn(
    'w-[var(--anchor-width)] font-body divide-gray-100 dark:divide-zinc-800 rounded-b border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1',
    'transition duration-300 ease-in-out',
    'focus:outline-none',
    'data-[side=bottom]:rounded-t-none data-[side=bottom]:rounded-b',
    'data-[side=top]:rounded-b-none data-[side=top]:rounded-t',
    className,
  )

  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner {...positionerProps}>
        <BaseCombobox.Popup className={popupClassName} {...props}>
          {children}
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}
