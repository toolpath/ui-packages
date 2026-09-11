import type { ReactNode } from 'react'
import { cn } from '../common'

export interface CardProps {
  children: ReactNode
  className?: string
}

/** A standard Toolpath application surface. */
export const Card = ({ children, className }: CardProps) => (
  <div
    className={cn(
      'rounded-xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900',
      className,
    )}
  >
    {children}
  </div>
)
