import React, { ReactNode } from 'react'
import { cn } from '../common'
import { useTabs } from './tabs-context'

export type TabsListProps = {
  className?: string
  children: ReactNode
}

export const List = ({ className, children }: TabsListProps) => {
  const { size } = useTabs()

  return (
    <div
      role="tablist"
      className={cn(
        'flex flex-nowrap',
        {
          'items-start gap-6': size === 'lg',
          'h-10 items-center gap-0.5 shrink-0 px-1.5 overflow-x-scroll hide-scrollbar':
            size === 'md',
        },
        className,
      )}
    >
      {children}
    </div>
  )
}
