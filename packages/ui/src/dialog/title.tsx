import React, { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../common'

export interface DialogTitleProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const Title = ({ children, className, ...props }: DialogTitleProps) => {
  return (
    <div
      className={cn(
        'border-b border-gray-100 dark:border-zinc-800 px-3 py-2 text-base font-bold text-gray dark:text-zinc-100',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
