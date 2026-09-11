import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { ScrollArea as BaseScrollArea } from '@base-ui/react'
import { cn } from '../common'

export interface ScrollAreaState {
  hasOverflow: boolean
}

export type ScrollAreaSize = 'sm' | 'md'

export interface ScrollAreaProps {
  children: ReactNode | ((state: ScrollAreaState) => ReactNode)
  className?: string
  size?: ScrollAreaSize
}

export const ScrollArea = ({ children, className, size = 'md' }: ScrollAreaProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const checkOverflow = () => {
      setHasOverflow(viewport.scrollHeight > viewport.clientHeight)
    }

    checkOverflow()

    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(viewport)

    const mutationObserver = new MutationObserver(checkOverflow)
    mutationObserver.observe(viewport, { childList: true, subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  const state: ScrollAreaState = { hasOverflow }

  return (
    <BaseScrollArea.Root className={cn('flex-1 min-h-0 w-full', className)}>
      <BaseScrollArea.Viewport
        ref={viewportRef}
        tabIndex={-1}
        data-viewport
        className="h-full w-full overscroll-contain outline-none"
      >
        {typeof children === 'function' ? children(state) : children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        data-scrollbar
        className={cn(
          'relative flex rounded bg-gray-100 dark:bg-zinc-700 opacity-0 pointer-events-none transition-opacity',
          "before:absolute before:content-['']",
          'data-[orientation=vertical]:m-2 data-[orientation=vertical]:before:h-full data-[orientation=vertical]:before:w-5 data-[orientation=vertical]:before:left-1/2 data-[orientation=vertical]:before:-translate-x-1/2',
          'data-[orientation=horizontal]:m-2 data-[orientation=horizontal]:before:h-5 data-[orientation=horizontal]:before:w-full data-[orientation=horizontal]:before:left-0 data-[orientation=horizontal]:before:right-0 data-[orientation=horizontal]:before:-bottom-2',
          // Reveal each scrollbar only when its orientation has overflow.
          'data-[orientation=vertical]:data-[has-overflow-y]:opacity-100',
          'data-[orientation=horizontal]:data-[has-overflow-x]:opacity-100',
          'data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[hovering]:delay-0',
          'data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0',
          {
            'data-[orientation=vertical]:w-1 data-[orientation=horizontal]:h-1': size === 'sm',
            'data-[orientation=vertical]:w-2 data-[orientation=horizontal]:h-2': size === 'md',
          },
        )}
      >
        <BaseScrollArea.Thumb
          data-thumb
          className="w-full rounded bg-gray-500/50 dark:bg-zinc-400/50"
        />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  )
}
