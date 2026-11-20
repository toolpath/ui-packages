import React, { HTMLAttributes, ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { QuestionIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { PopupArrow, popupMotion, popupSurface } from '../common/popup'
import { IconButton, IconButtonProps } from '../icon-button'

/** Attributes for the popup, `data-*` ones included: an app's own markers. */
export type HelpPopoverPopupProps = HTMLAttributes<HTMLDivElement> & {
  [attribute: `data-${string}`]: string | number | boolean | undefined
}

export interface HelpPopoverProps {
  /** The button's accessible name, and the popup's unless it has a `title`: "About revisions". */
  label: string
  /** What it explains. A sentence or two; it is the popup's description. */
  children: ReactNode
  /** A heading above the text, which then names the popup. */
  title?: ReactNode
  /** Open while the button is hovered, after `delay`, and close `closeDelay` after it leaves. On by default. */
  openOnHover?: boolean
  delay?: number
  closeDelay?: number
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** The `?` button's size. Defaults to `lg`, a mark big enough to see beside a label. */
  size?: IconButtonProps['size']
  /** Classes for the `?` button. */
  className?: string
  /** Spread onto the popup, for an app's own attributes. */
  popupProps?: HelpPopoverPopupProps
}

/**
 * A `?` button beside a control or label that opens a short explanation of it. It opens as the
 * pointer rests on it, and on click, Enter or Space, so it is there for keyboard and touch as well
 * as the mouse. Escape or a press elsewhere closes it, and focus goes back to the button.
 *
 * Use it where a tooltip would be too long or would have to be found by hovering. The popup is
 * marked `data-tip`, so a page's own keyboard handling can tell help apart from its dialogs.
 */
export const HelpPopover = ({
  label,
  children,
  title,
  openOnHover = true,
  delay = 150,
  closeDelay = 150,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  size = 'lg',
  className,
  popupProps,
}: HelpPopoverProps) => (
  <Popover.Root>
    <Popover.Trigger
      aria-label={label}
      openOnHover={openOnHover}
      delay={delay}
      closeDelay={closeDelay}
      render={(props) => (
        <IconButton {...props} size={size} className={className}>
          <QuestionIcon weight="bold" aria-hidden />
        </IconButton>
      )}
    />
    <Popover.Portal>
      <Popover.Positioner
        className="z-50 outline-none"
        side={side}
        align={align}
        sideOffset={sideOffset}
      >
        <Popover.Popup
          {...popupProps}
          // Its name and marker are the component's contract: popupProps cannot replace them.
          aria-label={title ? undefined : label}
          data-tip=""
          className={cn(
            ...popupSurface,
            'px-3 py-2.5 max-w-72 outline-none',
            ...popupMotion,
            'motion-reduce:transition-none',
            popupProps?.className,
          )}
        >
          <PopupArrow />
          {title ? (
            <Popover.Title className="mb-1 font-semibold text-gray-700 dark:text-zinc-50">
              {title}
            </Popover.Title>
          ) : null}
          <Popover.Description render={<div />}>{children}</Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
)
