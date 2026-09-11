import React, { HTMLAttributes } from 'react'
import { cn } from '../common'

export type AttributionProps = HTMLAttributes<HTMLDivElement>

export const Attribution = ({ className, children, ...props }: AttributionProps) => (
  <div
    className={cn(
      'truncate break-words text-xs leading-4 font-semibold tracking-normal text-gray-300 dark:text-zinc-400 md:line-clamp-2 md:whitespace-normal',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)
