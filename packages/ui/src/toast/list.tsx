import React, { ReactNode } from 'react'
import { Toast } from '@base-ui/react'
import { Button } from '../button'
import { cn } from '../common'
import { IconButton } from '../icon-button'
import { CircleNotchIcon, XIcon } from '@phosphor-icons/react'
import { useToastManager } from './provider'

export interface CustomToastData {
  content: ReactNode
  /** When true, the toast cannot be dismissed by swiping. Only programmatic close is allowed. */
  persistent?: boolean
  /** Optional classes applied to the toast shell. */
  className?: string
}

export const List = () => {
  // Use the separate toast context - all toasts here are regular toasts
  const { toasts: regularToasts } = useToastManager()

  return (
    <Toast.Portal data-foo>
      <Toast.Viewport
        className={cn(
          'font-body text-base font-medium tracking-normal fixed bottom-6 right-6 z-[100]',
          {
            'flex w-full max-w-sm flex-col pt-8': regularToasts.length,
            'pointer-events-none': !regularToasts.length,
          },
        )}
      >
        {regularToasts.map((toast) => {
          const isLoading = toast?.type === 'loading'
          const customData = toast.data as CustomToastData | undefined
          const customContent = customData?.content
          const persistent = customData?.persistent
          const customClassName = customData?.className

          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              tabIndex={-1}
              swipeDirection={persistent ? [] : ['down', 'left', 'right']}
              onKeyDown={
                persistent
                  ? (e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                      }
                    }
                  : undefined
              }
              className={cn(
                // Base styles - white background with border like frontend notification
                'relative flex w-full flex-col rounded-lg border bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-md outline-none',
                // Animation: transition properties
                'transition-all duration-300 ease-out',
                // Stacking: absolute positioning to overlap (bottom-aligned for upward stacking)
                'absolute bottom-0 left-0 right-0',
                // Stacking: z-index based on --toast-index (lower index = front)
                '[z-index:calc(1000-var(--toast-index))]',
                // Stacking: scale down and offset each toast behind the front one (upward)
                '[transform:scale(calc(1-0.05*var(--toast-index)))_translateY(calc(var(--toast-index)*-12px))_translateX(var(--toast-swipe-movement-x,0px))]',
                // Stacking: reduce brightness for toasts behind
                '[filter:brightness(calc(1-0.08*var(--toast-index)))]',
                // Expanded state: spread out when hovering the viewport (with 8px gap between each, going upward)
                'data-[expanded]:[transform:translateY(calc(-1*var(--toast-offset-y)-var(--toast-index)*8px))_translateX(var(--toast-swipe-movement-x,0px))]',
                'data-[expanded]:[filter:brightness(1)]',
                // Entry animation (starting style) - slide up from bottom
                'data-[starting-style]:[transform:scale(calc(1-0.05*var(--toast-index)))_translateY(150%)]',
                'data-[starting-style]:opacity-0',
                // Exit animation (ending style)
                'data-[ending-style]:opacity-0',
                'data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y,0px)+150%))]',
                'data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x,0px)-150%))]',
                'data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x,0px)+150%))]',
                customClassName,
              )}
            >
              {customContent ? (
                customContent
              ) : (
                <>
                  <div className="flex w-full flex-col gap-1 rounded-lg px-2 py-3">
                    {/* Title row with optional spinner */}
                    <div className="flex items-center gap-2 px-2">
                      {isLoading && (
                        <CircleNotchIcon
                          weight="bold"
                          className="size-4 shrink-0 animate-spin text-gray-300 dark:text-zinc-200"
                        />
                      )}
                      <Toast.Title className="flex-1 whitespace-pre-line break-words text-sm font-bold text-gray-500 dark:text-zinc-200" />
                    </div>

                    {/* Description/message */}
                    <Toast.Content className="flex flex-col px-2 transition-opacity duration-300 data-[behind]:opacity-0 data-[expanded]:opacity-100">
                      <Toast.Description className="flex-1 whitespace-pre-line break-words text-sm font-medium text-gray-500 dark:text-zinc-200" />
                    </Toast.Content>

                    {/* Action button area */}
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-2 px-1">
                      <Toast.Action
                        nativeButton={true}
                        render={(renderProps) => (
                          <Button className="rounded-lg py-2" variant="success" {...renderProps}>
                            {renderProps.children}
                          </Button>
                        )}
                      />
                    </div>
                  </div>

                  <Toast.Close
                    aria-label="Close"
                    nativeButton={true}
                    render={(renderProps) => {
                      return (
                        <div className="absolute right-2 top-2">
                          <IconButton size="lg" {...renderProps}>
                            <XIcon weight="bold" className="text-gray-300 dark:text-zinc-400" />
                          </IconButton>
                        </div>
                      )
                    }}
                  />
                </>
              )}
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
