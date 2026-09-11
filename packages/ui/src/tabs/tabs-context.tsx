'use client'

import React, { createContext, ReactNode, useContext } from 'react'

export type TabsSize = 'md' | 'lg'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  size: TabsSize
}

const TabsContext = createContext<TabsContextValue | null>(null)

export const useTabs = () => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs.Tab must be used within a Tabs component')
  }
  return context
}

interface TabsProviderProps {
  children: ReactNode
  value: string
  onValueChange: (value: string) => void
  size: TabsSize
}

export const TabsProvider = ({ children, value, onValueChange, size }: TabsProviderProps) => {
  const contextValue: TabsContextValue = {
    value,
    onValueChange,
    size,
  }

  return <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>
}
