import React, { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../common'

export interface DialogMessageProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const Message = ({ children, className, ...props }: DialogMessageProps) => {
  return (
    <div
      className={cn(
        'p-2 pt-4 font-body text-sm font-medium text-gray-400 dark:text-zinc-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
