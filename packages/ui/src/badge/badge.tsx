import React, { ReactNode } from 'react'
import { cn } from '../common'

export type BadgeProps = {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'secondary' | 'success' | 'primary' | 'info' | 'danger'
  className?: string
}

export const Badge = ({ children, size = 'md', variant = 'default', className }: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap border font-semibold tracking-wide',
        {
          'h-3 px-1 text-3xs rounded-sm': size === 'sm',
          'h-4 px-1.5 text-2xs rounded': size === 'md',
          'h-6 px-2 text-xs rounded': size === 'lg',
        },
        {
          'border-gray bg-gray/25 text-gray dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-100':
            variant === 'default',
          'border-gray-300 bg-gray-300/25 text-gray-400 dark:border-zinc-700 dark:bg-zinc-700/25 dark:text-zinc-200':
            variant === 'secondary',
          'border-success bg-success/25 text-success dark:text-success': variant === 'success',
          'border-primary bg-primary/25 text-primary dark:text-primary': variant === 'primary',
          'border-info bg-info/25 text-info dark:text-info': variant === 'info',
          'border-danger bg-danger/25 text-danger dark:text-danger': variant === 'danger',
        },
        'data-[content]:leading-none',
        className,
      )}
    >
      <span data-content>{children}</span>
    </span>
  )
}
