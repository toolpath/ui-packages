import React, { ReactNode } from 'react'
import { cn } from '../common'
import { TabsProvider, TabsSize } from './tabs-context'

export type TabsProps = {
  value: string
  onValueChange: (value: string) => void
  size?: TabsSize
  className?: string
  children: ReactNode
}

export const Tabs = ({ value, onValueChange, size = 'lg', className, children }: TabsProps) => (
  <TabsProvider value={value} onValueChange={onValueChange} size={size}>
    <div
      className={cn(
        'border-b border-gray-100 dark:border-zinc-800',
        {
          'overflow-x-auto overflow-y-hidden hide-scrollbar': size === 'lg',
        },
        className,
      )}
    >
      {children}
    </div>
  </TabsProvider>
)
