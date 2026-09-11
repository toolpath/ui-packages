import React, { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../common'

export interface DialogActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const Actions = ({ children, className, ...props }: DialogActionsProps) => {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end p-2 pt-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}
