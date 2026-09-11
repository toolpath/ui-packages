import React, { createContext, ReactNode, useContext } from 'react'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl'

type BreadcrumbsContextValue = {
  breakpoint: Breakpoint
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue>({
  breakpoint: 'md',
})

export const useBreadcrumbs = () => {
  return useContext(BreadcrumbsContext)
}

export type BreadcrumbsProviderProps = {
  children: ReactNode
  breakpoint?: Breakpoint
}

export const BreadcrumbsProvider = ({ children, breakpoint = 'md' }: BreadcrumbsProviderProps) => {
  return (
    <BreadcrumbsContext.Provider value={{ breakpoint }}>{children}</BreadcrumbsContext.Provider>
  )
}
