import { debounce } from 'lodash-es'
import React, { useEffect, useMemo } from 'react'
import {
  Slider as BaseSlider,
  SliderRoot,
  SliderRootProps,
  SliderThumbProps,
} from '@base-ui/react/slider'
import { cn } from '../common'

export type SliderProps = Omit<SliderRootProps, 'onValueChange'> & {
  variant?: 'default'
  onFocus?: SliderThumbProps['onFocus'] | undefined
  onBlur?: SliderThumbProps['onBlur'] | undefined
  onValueChange?: (value: number, eventDetails: SliderRoot.ChangeEventDetails) => void
}

export const Slider = ({
  variant = 'default',
  onFocus,
  onBlur,
  onValueChange,
  className = '',
  ...props
}: SliderProps) => {
  const debouncedOnValueChange = useMemo(
    () =>
      debounce((value, eventDetails) => {
        if (typeof onValueChange === 'function') {
          onValueChange(Array.isArray(value) ? value[0] : value, eventDetails)
        }
      }, 10),
    [onValueChange],
  )

  useEffect(() => {
    return () => debouncedOnValueChange.cancel()
  }, [debouncedOnValueChange])

  return (
    <BaseSlider.Root
      thumbAlignment="edge"
      className={cn('w-full data-[dragging]:cursor-ew-resize hover:cursor-ew-resize', className)}
      onValueChange={debouncedOnValueChange}
      {...props}
    >
      <BaseSlider.Control
        data-control
        className="flex w-full touch-none items-center select-none outline-none"
      >
        <BaseSlider.Track className="h-2 w-full rounded-full bg-gray-100 dark:bg-zinc-700 select-none hover:cursor-ew-resize">
          <BaseSlider.Indicator
            data-indicator
            className={cn('rounded-full bg-gray-600 dark:bg-zinc-400 select-none', {
              'bg-gray-200 dark:bg-zinc-700': props.disabled && variant === 'default',
            })}
          />
          <BaseSlider.Thumb
            data-thumb
            onBlur={onBlur}
            onFocus={onFocus}
            className={cn(
              'size-4 appearance-none rounded-full bg-white dark:bg-zinc-200 shadow-lg ring-1 ring-gray-200 dark:ring-zinc-800 outline-none',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info/60 dark:has-[:focus-visible]:ring-info',
              {
                'cursor-ew-resize hover:ring-offset-2 transition ease-in-out': !props.disabled,
              },
              { 'cursor-not-allowed bg-gray-100': props.disabled },
            )}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
