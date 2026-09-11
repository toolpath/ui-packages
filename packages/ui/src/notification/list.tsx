import React from 'react'
import { Toast, ToastObject } from '@base-ui/react'
import { cn } from '../common'
import { IconButton } from '../icon-button'
import { XIcon } from '@phosphor-icons/react'
import { useNotificationToastManager } from './provider'

export type NotificationVariant = 'info' | 'warning' | 'danger' | 'success'

interface NotificationData {
  type: 'notification'
  variant?: NotificationVariant
}

export const List = () => {
  // Use the separate notification context - all toasts here are notifications
  const { toasts: notifications } = useNotificationToastManager()

  const getVariant = (toast: ToastObject<any>): NotificationVariant => {
    const data = toast.data as NotificationData | undefined
    return data?.variant ?? 'info'
  }

  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          'font-body text-base font-medium tracking-normal fixed left-1/2 top-5 z-[1100] -translate-x-1/2 transform',
          {
            'flex w-full flex-col px-4 pb-8 sm:w-[512px] sm:px-0': notifications.length,
            'pointer-events-none': !notifications.length,
          },
        )}
      >
        {notifications.map((toast) => {
          const variant = getVariant(toast)

          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection={['up', 'left', 'right']}
              tabIndex={-1}
              className={cn(
                // Base styles
                'hide-scrollbar outline-none relative flex max-h-[140px] w-full max-w-lg items-start gap-2 self-center overflow-y-scroll rounded-lg p-2 pl-3 shadow-md',
                // Animation: transition properties
                'transition-all duration-300 ease-out',
                // Stacking: absolute positioning to overlap
                'absolute top-0 left-0 right-0',
                // Stacking: z-index based on --toast-index (lower index = front, above dialog z-[1001])
                '[z-index:calc(1100-var(--toast-index))]',
                // Stacking: scale down and offset each toast behind the front one
                '[transform:scale(calc(1-0.05*var(--toast-index)))_translateY(calc(var(--toast-index)*12px))_translateX(var(--toast-swipe-movement-x,0px))]',
                // Stacking: reduce brightness for toasts behind
                '[filter:brightness(calc(1-0.08*var(--toast-index)))]',
                // Expanded state: spread out when hovering the viewport (with 8px gap between each)
                'data-[expanded]:[transform:translateY(calc(var(--toast-offset-y)+var(--toast-index)*8px))_translateX(var(--toast-swipe-movement-x,0px))]',
                'data-[expanded]:[filter:brightness(1)]',
                // Entry animation (starting style)
                'data-[starting-style]:[transform:scale(calc(1-0.05*var(--toast-index)))_translateY(-150%)]',
                'data-[starting-style]:opacity-0',
                // Exit animation (ending style)
                'data-[ending-style]:opacity-0',
                'data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y,0px)-150%))]',
                'data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y,0px)+150%))]',
                'data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x,0px)-150%))]',
                'data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x,0px)+150%))]',
                // Variant colors
                {
                  'bg-gray-500 text-white dark:bg-zinc-900 dark:text-zinc-100 dark:ring-1 dark:ring-zinc-800':
                    variant === 'info',
                  'bg-warning text-gray dark:text-zinc-950': variant === 'warning',
                  'bg-danger text-white dark:text-zinc-50': variant === 'danger',
                  'bg-success text-white dark:text-zinc-50': variant === 'success',
                },
              )}
            >
              <Toast.Content className="mr-8 flex flex-1 flex-col whitespace-pre-line break-words overflow-hidden transition-opacity duration-300 data-[behind]:opacity-0 data-[expanded]:opacity-100">
                <Toast.Description />
                <Toast.Action
                  className={cn(
                    'mt-1 inline-block w-fit rounded-md px-0 py-0 text-sm font-semibold underline underline-offset-2 transition-all duration-200 text-left',
                    'hover:no-underline focus-visible:no-underline outline-none',
                    {
                      'text-gray hover:text-black focus-visible:text-black dark:text-zinc-950 dark:hover:text-black dark:focus-visible:text-black':
                        variant === 'warning',
                      'text-white/80 hover:text-white focus-visible:text-white dark:text-zinc-50/80 dark:hover:text-zinc-50 dark:focus-visible:text-zinc-50':
                        variant === 'danger' || variant === 'success' || variant === 'info',
                    },
                  )}
                />
              </Toast.Content>
              <Toast.Close
                aria-label="Close"
                nativeButton={true}
                render={(renderProps) => {
                  return (
                    <div className="absolute right-2 top-2">
                      <IconButton
                        size="lg"
                        className="[&_svg]:size-5 rounded active:bg-black/10 hover:bg-black/10 focus-visible:bg-black/10 focus-visible:ring-0 dark:active:bg-black/20 dark:hover:bg-black/20 dark:focus-visible:bg-black/20"
                        {...renderProps}
                      >
                        <XIcon
                          weight="regular"
                          className={cn({
                            'text-gray dark:text-zinc-950': variant === 'warning',
                            'text-white dark:text-zinc-50':
                              variant === 'danger' || variant === 'success' || variant === 'info',
                          })}
                        />
                      </IconButton>
                    </div>
                  )
                }}
              />
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
