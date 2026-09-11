import React, { FC, ReactNode, createContext, useContext, useMemo } from 'react'

interface ComboboxContextInterface {
  size: 'xl' | 'lg' | 'md' | 'sm'
  variant: 'default' | 'secondary' | 'muted' | 'ghost'
  disabled: boolean
  invalid: boolean
  itemToStringLabel?: (item: any) => string
}

const ComboboxContext = createContext<Partial<ComboboxContextInterface>>(
  {} as ComboboxContextInterface,
)

interface ProviderProps {
  size: 'xl' | 'lg' | 'md' | 'sm'
  variant: 'default' | 'secondary' | 'muted' | 'ghost'
  disabled: boolean
  invalid: boolean
  itemToStringLabel?: (item: any) => string
  children: ReactNode
}

const ComboboxProvider: FC<ProviderProps> = ({
  size = 'md',
  variant = 'default',
  disabled = false,
  invalid = false,
  itemToStringLabel,
  children,
}) => {
  const value = useMemo(
    () => ({ size, variant, disabled, invalid, itemToStringLabel }),
    [size, variant, disabled, invalid, itemToStringLabel],
  )

  return <ComboboxContext.Provider value={value}>{children}</ComboboxContext.Provider>
}

const useCombobox = () => useContext(ComboboxContext)
export { useCombobox, ComboboxProvider }
