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
}

const stopCalloutPointerBubbling = (e: SyntheticEvent) => {
  e.stopPropagation()
}

const CalloutContent = ({ children, className }: CalloutContentProps) => {
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
          className={cn(
            'bg-white dark:bg-zinc-900 ring-1 ring-gray-200 dark:ring-zinc-800 rounded-lg shadow-lg',
            'font-normal font-body text-xs tracking-normal text-gray-700 dark:text-zinc-100',
            'px-3 py-2.5 pr-8 max-w-72',
            'transition duration-200 ease-in-out',
            'data-[side=top]:origin-bottom',
            'data-[side=bottom]:origin-top',
            'data-[side=left]:origin-right',
            'data-[side=right]:origin-left',
            className,
          )}
        >
          <Popover.Arrow className="flex data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180 data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90">
            <ArrowSvg />
          </Popover.Arrow>
          <Popover.Close
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

const ArrowSvg = (props: React.ComponentProps<'svg'>) => (
  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
    <path
      d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
      className="fill-white dark:fill-zinc-900"
    />
    <path
      d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
      className="fill-gray-200 dark:fill-zinc-800"
    />
    <path
      d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
      className="fill-none"
    />
  </svg>
)
