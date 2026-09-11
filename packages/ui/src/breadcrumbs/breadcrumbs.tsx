import React, { ReactNode } from 'react'
import { cn } from '../common'
import { BreadcrumbsProvider } from './breadcrumbs-context'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl'

export type BreadcrumbsProps = {
  children: ReactNode
  breakpoint?: Breakpoint
  className?: string
}

export const BreadcrumbsRoot = ({ children, breakpoint = 'md', className }: BreadcrumbsProps) => (
  <BreadcrumbsProvider breakpoint={breakpoint}>
    <ul
      className={cn(
        'flex whitespace-nowrap text-sm font-medium text-gray-300 dark:text-zinc-500',
        className,
      )}
    >
      {children}
    </ul>
  </BreadcrumbsProvider>
)
