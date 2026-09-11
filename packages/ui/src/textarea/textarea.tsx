import React, { ChangeEvent, TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '../common'

export type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
  name: string
  id: string
  size?: 'md' | 'lg' | 'xl'
  variant?: 'default' | 'secondary' | 'muted'
  invalid?: boolean
  onValueChange?: (value: string) => void
  textAreaClassName?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      name,
      id,
      value,
      rows = 3,
      className,
      textAreaClassName,
      disabled = false,
      variant = 'default',
      size = 'lg',
      invalid = false,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      onValueChange?.(event.target.value)
      props.onChange?.(event)
    }

    return (
      <div
        className={cn(
          'relative flex w-full rounded-md font-medium',
          {
            'focus-within:ring-2 ring-info/50 dark:ring-info/75': !invalid,
            'text-gray-400 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-within:border-info dark:focus-within:border-info':
              variant === 'secondary',
            'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-100': variant === 'default',
            'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-100':
              variant === 'muted' || disabled,
            'bg-gray-200 dark:bg-zinc-800': variant === 'muted' && disabled,
            'border border-[#FFD4E0] dark:border-danger/50 bg-[#FFD4E0]/25 dark:bg-danger/25 focus-within:border-[#FFD4E0] dark:focus-within:border-danger focus-within:ring-2 ring-[#FFD4E0] dark:ring-danger/50':
              invalid && !disabled,
          },
          className,
        )}
        data-disabled={disabled || undefined}
        data-invalid={invalid || undefined}
      >
        <textarea
          ref={ref}
          id={id}
          name={name}
          data-testid={id}
          data-textarea
          value={value}
          rows={rows}
          disabled={disabled}
          onChange={handleChange}
          className={cn(
            'w-full bg-transparent leading-normal outline-none',
            'resize-y',
            {
              'cursor-not-allowed select-none': disabled,
              'placeholder-gray-200 dark:placeholder-zinc-400': variant === 'secondary',
              'placeholder-gray-300 dark:placeholder-zinc-400':
                variant === 'default' || variant === 'muted',
              'px-1 py-1 text-xs': size === 'md',
              'px-2 py-1.5 text-sm': size === 'lg',
              'px-2 py-2 text-base': size === 'xl',
            },
            textAreaClassName,
          )}
          {...props}
        />
      </div>
    )
  },
)

TextArea.displayName = 'TextArea'
