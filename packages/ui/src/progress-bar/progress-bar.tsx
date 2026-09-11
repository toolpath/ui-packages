import React from 'react'
import { cn } from '../common'

export type ProgressBarSize = 'xs' | 'sm' | 'md' | 'lg'

export type ProgressBarProps = {
  progress: number
  size?: ProgressBarSize
  className?: string
}

export const ProgressBar = ({ progress, size = 'lg', className }: ProgressBarProps) => {
  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress)}
      aria-valuetext={`${Math.round(progress)}%`}
      role="progressbar"
      className={cn('relative', className)}
    >
      <div
        data-track
        data-complete={progress >= 100}
        className={cn(
          'flex overflow-hidden rounded-full',
          'border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900',
          {
            'h-1': size === 'xs',
            'h-1.5': size === 'sm',
            'h-2': size === 'md',
            'h-4': size === 'lg',
          },
        )}
      >
        <div
          data-indicator
          data-complete={progress >= 100}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          className={cn(
            'rounded-r-full transition-[width] duration-300 ease-out',
            'bg-white dark:bg-zinc-600',
          )}
        />
      </div>
    </div>
  )
}
