'use client'

import React, { ReactNode, RefObject, createContext, useCallback, useContext, useRef } from 'react'

interface ToggleContextValue {
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  size: 'sm' | 'md' | 'lg'
  isBinaryToggle: boolean
  registerItem: (value: string, el: HTMLButtonElement | null) => void
  containerRef: RefObject<HTMLDivElement | null>
  itemRefs: RefObject<Map<string, HTMLButtonElement>>
}

const ToggleContext = createContext<ToggleContextValue | null>(null)

export const ToggleConsumer = ToggleContext.Consumer

export const useToggle = () => {
  const context = useContext(ToggleContext)
  if (!context) {
    throw new Error('Toggle.Item must be used within a Toggle component')
  }
  return context
}

interface ToggleProviderProps {
  children: ReactNode
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  size: 'sm' | 'md' | 'lg'
  isBinaryToggle: boolean
}

export const ToggleProvider = ({
  children,
  value,
  onValueChange,
  disabled,
  size,
  isBinaryToggle,
}: ToggleProviderProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const registerItem = useCallback((itemValue: string, el: HTMLButtonElement | null) => {
    if (el) {
      itemRefs.current.set(itemValue, el)
    } else {
      itemRefs.current.delete(itemValue)
    }
  }, [])

  const contextValue: ToggleContextValue = {
    value,
    onValueChange,
    disabled,
    size,
    isBinaryToggle,
    registerItem,
    containerRef,
    itemRefs,
  }

  return <ToggleContext.Provider value={contextValue}>{children}</ToggleContext.Provider>
}
