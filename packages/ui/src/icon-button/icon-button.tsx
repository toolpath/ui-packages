import React, { ButtonHTMLAttributes, createContext, ReactNode, Ref, useContext } from 'react'
import { cn } from '../common'

type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl'

const IconButtonContext = createContext<{ size: IconButtonSize }>({
  size: 'md',
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'muted' | 'secondary'
  size?: IconButtonSize
  children: ReactNode
  toggled?: boolean
  invalid?: boolean
  deemphasize?: boolean
  ref?: Ref<HTMLButtonElement>
}

export interface IconButtonIndicatorProps {
  variant?: 'info' | 'success' | 'primary' | 'danger' | 'warning'
  children?: ReactNode
}

const IconButtonIndicator = ({ variant = 'info', children }: IconButtonIndicatorProps) => {
  const { size } = useContext(IconButtonContext)
  const hasText = children !== undefined && children !== null && size !== 'sm'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute flex items-center justify-center rounded-full font-bold text-white select-none',
        {
          'bg-info': variant === 'info',
          'bg-success': variant === 'success',
          'bg-primary': variant === 'primary',
          'bg-danger': variant === 'danger',
          'bg-warning': variant === 'warning',
        },
        hasText
          ? {
              '-right-2 -top-2 h-4 min-w-4 px-1 text-2xs': size === 'xl',
              '-right-1.5 -top-1.5 h-3.5 min-w-3.5 px-0.5 text-3xs': size === 'lg',
              '-right-1 -top-1 h-3 min-w-3 px-0.5 text-3xs': size === 'md',
            }
          : {
              '-right-0.5 -top-0.5 size-2.5': size === 'xl',
              '-right-0.5 -top-0.5 size-2': size === 'lg',
              '-right-0.5 -top-0.5 size-1.5': size === 'md',
              '-right-px -top-px size-1': size === 'sm',
            },
      )}
    >
      {hasText && children}
    </span>
  )
}

const IconButtonRoot = ({
  variant = 'default',
  size = 'md',
  disabled = false,
  children,
  className,
  toggled = false,
  invalid = false,
  deemphasize = false,
  ref,
  ...props
}: IconButtonProps) => {
  return (
    <IconButtonContext.Provider value={{ size }}>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        data-disabled={disabled}
        data-toggled={toggled || undefined}
        data-invalid={invalid || undefined}
        {...props}
        className={cn(
          'flex justify-center items-center rounded-sm shrink-0',
          'transition-transform duraiton-150 ease-in-out',
          'outline-none focus-visible:ring-2 ring-info/75',
          {
            'bg-[#FFD4E0]/50 border border-[#FFD4E0]': invalid && !disabled,
            '!bg-info-lighten text-gray-500 dark:!bg-info/20 dark:ring-1 dark:ring-info/40 dark:text-zinc-50':
              toggled && !invalid,
            'hover:bg-gray-100 dark:hover:bg-zinc-900 active:bg-gray-100 dark:active:bg-zinc-900 active:scale-95':
              !toggled && !disabled && !invalid && variant !== 'secondary',
            'border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900':
              variant === 'secondary' && !invalid,
            'text-gray-400 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-50 dark:active:bg-zinc-800 active:scale-95':
              variant === 'secondary' && !disabled && !toggled,
            'hover:!bg-info-lighten/80 dark:hover:!bg-info/25 active:!bg-info-lighten/90 dark:active:!bg-info/30 active:scale-95':
              toggled && !disabled && !invalid,
            'text-gray-500 active:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-100 dark:active:text-zinc-100':
              variant === 'default' && !deemphasize && !disabled && !toggled,
            'text-gray-300 hover:text-gray-400 active:text-gray-500 dark:text-zinc-400 dark:hover:text-zinc-100 dark:active:text-zinc-100':
              variant === 'default' && deemphasize && !disabled && !toggled,
            'text-gray-300 hover:text-gray-400 active:text-gray-400 dark:text-zinc-400 dark:hover:text-zinc-100 dark:active:text-zinc-100':
              variant === 'muted' && !deemphasize && !disabled && !toggled,
            'text-gray-200 hover:text-gray-300 active:text-gray-400 dark:text-zinc-400 dark:hover:text-zinc-100 dark:active:text-zinc-100':
              variant === 'muted' && deemphasize && !disabled && !toggled,
            'text-gray-200 hover:bg-transparent active:bg-transparent active:scale-100 active:text-gray-200 cursor-not-allowed dark:text-zinc-400 dark:hover:bg-transparent dark:active:bg-transparent dark:active:scale-100 dark:active:text-zinc-400':
              disabled,
            'hover:bg-white active:bg-white dark:hover:bg-zinc-900 dark:active:bg-zinc-900':
              variant === 'secondary' && disabled,
            'size-8 [&_svg]:size-6 rounded': size === 'xl',
            'size-6 [&_svg]:size-4': size === 'lg',
            'size-5 [&_svg]:size-3.5': size === 'md',
            'size-4 [&_svg]:size-2.5': size === 'sm',
          },
          className,
        )}
      >
        {children}
      </button>
    </IconButtonContext.Provider>
  )
}

export const IconButton = Object.assign(IconButtonRoot, {
  Indicator: IconButtonIndicator,
})
