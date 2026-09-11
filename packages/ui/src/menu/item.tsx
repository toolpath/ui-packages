import React, { Ref, useCallback, useEffect, useRef } from 'react'
import { Menu as BaseMenu, MenuItemProps as BaseMenuItemProps, ContextMenu } from '@base-ui/react'
import { cn } from '../common'
import { useMenu } from './menu-context'

type BaseUIEvent<E extends React.SyntheticEvent> = E & {
  preventBaseUIHandler: () => void
  readonly baseUIHandlerPrevented?: boolean
}

export type MenuItemProps = BaseMenuItemProps & {
  variant?: 'default' | 'danger'
  ref?: Ref<HTMLElement>
}

export const Item = ({
  children,
  className,
  disabled,
  variant = 'default',
  ref,
  onClick,
  ...props
}: MenuItemProps) => {
  const { context } = useMenu()

  // Wrap onClick to stop propagation, preventing parent click handlers from firing
  const handleClick = (event: BaseUIEvent<React.MouseEvent<HTMLDivElement>>) => {
    event.stopPropagation()
    onClick?.(event)
  }
  const internalRef = useRef<HTMLElement>(null)
  // Track if we should block the next click (due to right-click mouseup)
  const blockNextClickRef = useRef(false)

  // Merge passed ref with internal ref (only needed for context menus)
  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      internalRef.current = element
      if (typeof ref === 'function') {
        ref(element)
      } else if (ref && 'current' in ref) {
        ref.current = element
      }
    },
    [ref],
  )

  // Attach native DOM event listeners during capture phase to intercept
  // right-click mouseup before @base-ui/react's handlers can trigger selection.
  // The library calls element.click() directly on mouseup for right-clicks,
  // so we need to block both the mouseup and the resulting synthetic click.
  // Only needed for context menus since they're opened via right-click.
  useEffect(() => {
    if (!context) {
      return
    }

    const element = internalRef.current
    if (!element) {
      return
    }

    let resetTimeoutId: ReturnType<typeof setTimeout> | undefined

    const handleMouseUpCapture = (event: MouseEvent) => {
      // Block right-click (button === 2) mouseup events
      if (event.button === 2) {
        // Use stopImmediatePropagation to prevent ALL other listeners on this
        // element from firing, not just listeners on parent elements
        event.stopImmediatePropagation()
        event.preventDefault()
        // Mark that we should also block the next click event
        // (which @base-ui/react triggers via element.click())
        blockNextClickRef.current = true
        // Reset the flag after a short delay in case click doesn't fire
        resetTimeoutId = setTimeout(() => {
          blockNextClickRef.current = false
        }, 100)
      }
    }

    const handleClickCapture = (event: MouseEvent) => {
      // Block clicks that were triggered by right-click mouseup
      if (blockNextClickRef.current) {
        event.stopImmediatePropagation()
        event.preventDefault()
        blockNextClickRef.current = false
        if (resetTimeoutId) {
          clearTimeout(resetTimeoutId)
          resetTimeoutId = undefined
        }
      }
    }

    // Use capture phase to intercept before @base-ui/react's handlers
    element.addEventListener('mouseup', handleMouseUpCapture, true)
    element.addEventListener('click', handleClickCapture, true)

    return () => {
      element.removeEventListener('mouseup', handleMouseUpCapture, true)
      element.removeEventListener('click', handleClickCapture, true)
      if (resetTimeoutId) {
        clearTimeout(resetTimeoutId)
      }
    }
  }, [context])

  const itemClassName = cn(
    'group flex w-full items-center p-2 py-1 text-left whitespace-nowrap',
    'text-xs font-medium outline-none cursor-pointer',
    {
      'cursor-not-allowed border-gray-200 dark:border-zinc-800 text-gray-100 dark:text-zinc-500':
        disabled,
      'text-gray data-[highlighted]:bg-gray-50 text-gray-500 dark:text-zinc-100 dark:data-[highlighted]:bg-zinc-800':
        !disabled && variant === 'default',
      'text-danger dark:text-red-300 data-[highlighted]:bg-red-100 dark:data-[highlighted]:bg-danger-darken dark:data-[highlighted]:text-red-100':
        !disabled && variant === 'danger',
    },
    'font-body',
    className,
  )

  if (context) {
    return (
      <ContextMenu.Item
        {...props}
        onClick={handleClick}
        disabled={disabled}
        ref={setRefs}
        className={itemClassName}
      >
        {children}
      </ContextMenu.Item>
    )
  }

  return (
    <BaseMenu.Item
      {...props}
      onClick={handleClick}
      disabled={disabled}
      ref={ref}
      className={itemClassName}
    >
      {children}
    </BaseMenu.Item>
  )
}
