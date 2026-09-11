import React, { ReactElement, memo, useCallback, useMemo, useState } from 'react'
import {
  Tooltip as BaseTooltip,
  TooltipPositionerProps,
  TooltipProviderProps,
  TooltipRootChangeEventDetails,
  TooltipRootProps,
} from '@base-ui/react'
import { cn } from '../common'

export type TooltipProps = TooltipProviderProps &
  TooltipRootProps &
  Omit<TooltipPositionerProps, 'className'> & {
    children: ReactElement
    tip: ReactElement | string | null
    disableFocusTrigger?: boolean
    hoverable?: boolean
    className?: string
  }

// Memoized trigger span to avoid recreating on every render
const TriggerSpan = <span />

export const Tooltip = memo(
  ({
    children,
    tip,
    delay = 0,
    closeDelay,
    timeout,
    defaultOpen,
    open: controlledOpen,
    onOpenChange,
    onOpenChangeComplete,
    trackCursorAxis,
    disableFocusTrigger = false,
    hoverable = false,
    disabled,
    sideOffset = 8,
    className,
    ...positionerProps
  }: TooltipProps) => {
    const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false)
    const open = controlledOpen ?? internalOpen

    const providerProps = useMemo<TooltipProviderProps>(
      () => ({ delay, closeDelay, timeout }),
      [delay, closeDelay, timeout],
    )

    const rootProps = useMemo<
      Pick<
        TooltipRootProps,
        'defaultOpen' | 'trackCursorAxis' | 'onOpenChangeComplete' | 'disabled'
      >
    >(
      () => ({
        defaultOpen,
        trackCursorAxis,
        onOpenChangeComplete,
        disabled,
      }),
      [defaultOpen, trackCursorAxis, onOpenChangeComplete, disabled],
    )

    const handleOpenChange = useCallback(
      (nextOpen: boolean, eventDetails: TooltipRootChangeEventDetails) => {
        if (disableFocusTrigger && eventDetails.reason === 'trigger-focus') {
          return
        }
        setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen, eventDetails)
      },
      [disableFocusTrigger, onOpenChange],
    )

    const positionerClassName = useMemo(
      () => cn('z-50', { 'pointer-events-none': !hoverable }, className),
      [hoverable, className],
    )

    if (!tip) {
      return <span>{children}</span>
    }

    return (
      <BaseTooltip.Provider {...providerProps}>
        <BaseTooltip.Root open={open} onOpenChange={handleOpenChange} {...rootProps}>
          <BaseTooltip.Trigger
            data-trigger
            delay={delay}
            closeDelay={closeDelay}
            render={TriggerSpan}
          >
            {children}
          </BaseTooltip.Trigger>
          <BaseTooltip.Portal>
            <BaseTooltip.Positioner
              className={positionerClassName}
              sideOffset={sideOffset}
              {...(positionerProps as TooltipPositionerProps)}
            >
              <BaseTooltip.Popup
                className={cn(
                  'bg-gray-800/90 text-white dark:bg-black/50 dark:backdrop-blur-sm dark:text-zinc-100 text-xs rounded-md break-words font-body font-medium',
                  'dark:border dark:border-zinc-900',
                  'px-3 py-1 transition duration-300 ease-in-out max-w-72',
                  'data-[side=top]:origin-bottom data-[side=top]:-mb-1',
                  'data-[side=bottom]:origin-top data-[side=bottom]:-mt-1',
                  'data-[side=left]:origin-right',
                  'data-[side=right]:origin-left',
                )}
              >
                {tip}
              </BaseTooltip.Popup>
            </BaseTooltip.Positioner>
          </BaseTooltip.Portal>
        </BaseTooltip.Root>
      </BaseTooltip.Provider>
    )
  },
)
