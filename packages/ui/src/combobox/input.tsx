import React, { useCallback, useRef } from 'react'
import {
  Combobox as BaseCombobox,
  ComboboxInputProps as BaseComboboxInputProps,
} from '@base-ui/react'
import { cn } from '../common'
import { useCombobox } from './combobox-context'

export type ComboboxInputProps = BaseComboboxInputProps

export const Input = ({ className, ...props }: ComboboxInputProps) => {
  const { size } = useCombobox()
  const observerRef = useRef<MutationObserver | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  const inputRefCallback = useCallback((node: HTMLInputElement | null) => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    if (!node) {
      return
    }

    // Focus immediately if already open
    if (node.hasAttribute('data-popup-open')) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
      node.focus()
    }

    // Watch for attribute changes to detect when popup opens/closes
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-popup-open') {
          if (node.hasAttribute('data-popup-open')) {
            // Popup opened - store current focus and focus input
            previouslyFocusedRef.current = document.activeElement as HTMLElement
            node.focus()
          } else {
            // Popup closed - restore focus to previous element
            previouslyFocusedRef.current?.focus()
            previouslyFocusedRef.current = null
          }
        }
      }
    })

    observerRef.current.observe(node, { attributes: true })
  }, [])

  return (
    <BaseCombobox.Input
      ref={inputRefCallback}
      data-input
      className={cn(
        'w-full rounded border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-body font-medium text-gray-400 dark:text-zinc-100 outline-none',
        'placeholder:text-gray-200 dark:placeholder:text-zinc-300 px-1.5',
        'focus-visible:border-info focus-visible:ring-2 focus-visible:ring-info/60',
        'hidden data-[popup-open]:block',
        'data-[popup-open]:ring-0 data-[popup-open]:border-gray-200 dark:data-[popup-open]:border-zinc-500',
        'data-[popup-open]:data-[popup-side="top"]:rounded-t-none',
        'data-[popup-open]:data-[popup-side="bottom"]:rounded-b-none',
        'disabled:bg-gray-50 disabled:text-gray-200 dark:disabled:bg-zinc-950 dark:disabled:text-zinc-400',
        {
          'h-5 text-2xs': size === 'sm',
          'h-6 text-xs': size === 'md',
          'h-7 text-xs': size === 'lg',
          'h-9 text-base': size === 'xl',
        },
        className,
      )}
      {...props}
    />
  )
}
