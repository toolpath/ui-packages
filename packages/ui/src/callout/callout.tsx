import React, {
  ReactNode,
  SyntheticEvent,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'
import { Popover, type PopoverRootChangeEventDetails } from '@base-ui/react/popover'
import { cn } from '../common'
import { PopupArrow, popupMotion, popupSurface } from '../common/popup'
import { XIcon } from '@phosphor-icons/react'
import { useDismissedCallouts } from './use-dismissed-callouts'

type CalloutContextValue = {
  open: boolean
  show: boolean
  dismissed: boolean
  side: 'top' | 'bottom' | 'left' | 'right'
  sideOffset: number
  align: 'start' | 'center' | 'end'
  highlight: boolean
}

const CalloutContext = createContext<CalloutContextValue | null>(null)

const useCalloutContext = () => {
  const ctx = useContext(CalloutContext)
  if (!ctx) {
    throw new Error('Callout sub-components must be used inside <Callout>')
  }
  return ctx
}

export type CalloutProps = {
  id: string
  children: ReactNode
  show?: boolean
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
  highlight?: boolean
  /** When false, dismiss state is local only and not persisted to localStorage. Defaults to true. */
  rememberDismissed?: boolean
}

export const Callout = ({
  id,
  children,
  show = true,
  highlight = false,
  side = 'bottom',
  sideOffset = 8,
  align = 'center',
  rememberDismissed = true,
}: CalloutProps) => {
  const { isDismissed, dismiss } = useDismissedCallouts()
  const persistedDismissed = rememberDismissed && isDismissed(id)
  const [open, setOpen] = useState(!persistedDismissed)

  const dismissed = rememberDismissed ? persistedDismissed : !open

  const handleOpenChange = useCallback(
    (nextOpen: boolean, event: PopoverRootChangeEventDetails) => {
      if (nextOpen) {
        setOpen(true)
        return
      }
      const intentional =
        event.reason === 'close-press' ||
        event.reason === 'escape-key' ||
        event.reason === 'trigger-press'
      if (!intentional) {
        return
      }
      if (rememberDismissed) {
        dismiss(id)
      }
      setOpen(false)
    },
    [dismiss, id, rememberDismissed],
  )

  return (
    <CalloutContext.Provider value={{ open, show, dismissed, side, sideOffset, align, highlight }}>
      <Popover.Root open={show && open && !dismissed} onOpenChange={handleOpenChange}>
        {children}
      </Popover.Root>
    </CalloutContext.Provider>
  )
}

type CalloutTriggerProps = {
  children: ReactNode
  className?: string
  /** Set to -1 to remove the trigger from the tab order and suppress focus styling. */
  tabIndex?: number
}

const CalloutTrigger = ({ children, className, tabIndex }: CalloutTriggerProps) => {
  const { highlight, show, open, dismissed } = useCalloutContext()

  return (
    <Popover.Trigger
      render={<span />}
      nativeButton={false}
      tabIndex={tabIndex}
      className={cn(
        'rounded outline-none focus-visible:ring-2 focus-visible:ring-info/75',
        highlight &&
          show &&
          open &&
          !dismissed &&
          'bg-info-lighten/50 dark:bg-info/5 rounded-sm shadow-[0_0_2px_2px_theme(colors.info/0.3)] dark: ring-1 dark:ring-info/40',
        className,
      )}
    >
      {children}
    </Popover.Trigger>
  )
}

type CalloutContentProps = {
  children: ReactNode
  className?: string
  /** The accessible name of its close button, which shows only an ×. Defaults to "Close". */
  closeLabel?: string
}

const stopCalloutPointerBubbling = (e: SyntheticEvent) => {
  e.stopPropagation()
}

const CalloutContent = ({ children, className, closeLabel = 'Close' }: CalloutContentProps) => {
  const { side, sideOffset, align } = useCalloutContext()

  return (
    <Popover.Portal>
      <Popover.Positioner
        className={cn(
          'z-50 outline-none',
          // Base UI + Floating UI `hide` middleware sets `data-anchor-hidden` when the
          // trigger is clipped or scrolled out of view; hide the portaled popup to match.
          'data-[anchor-hidden]:invisible data-[anchor-hidden]:pointer-events-none',
        )}
        side={side}
        sideOffset={sideOffset}
        align={align}
      >
        <Popover.Popup
          initialFocus={false}
          onClick={stopCalloutPointerBubbling}
          onPointerDown={stopCalloutPointerBubbling}
          className={cn(...popupSurface, 'px-3 py-2.5 pr-8 max-w-72', ...popupMotion, className)}
        >
          <PopupArrow />
          <Popover.Close
            aria-label={closeLabel}
            className={cn(
              'absolute top-1.5 right-1.5 p-0.5 rounded',
              'text-gray-400 dark:text-zinc-400',
              'hover:text-gray-600 dark:hover:text-zinc-100',
              'hover:bg-gray-100 dark:hover:bg-zinc-800',
              'transition-colors cursor-pointer',
            )}
          >
            <XIcon weight="bold" className="size-3.5" />
          </Popover.Close>
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}

Callout.Trigger = CalloutTrigger
Callout.Content = CalloutContent
