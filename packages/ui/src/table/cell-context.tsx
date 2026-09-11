import React, { FC, ReactElement, createContext, useCallback, useContext, useMemo } from 'react'
import { useRow } from './row-context'
import { useTable } from './table-context'

interface CellContextInterface {
  index: number
  isEditing: boolean
  toggleIsEditing: () => void
  isHovered: boolean
}

const CellContext = createContext<CellContextInterface>({} as CellContextInterface)

interface ProviderProps {
  index: number
  isHovered: boolean
  children: ReactElement
}

const CellProvider: FC<ProviderProps> = ({ index, isHovered, children }) => {
  const { select, editingCell, setEditingCell } = useTable()
  const { item, index: rowIndex } = useRow()
  const isEditing =
    editingCell !== null &&
    editingCell[0] === rowIndex &&
    editingCell[1] === item.id &&
    editingCell[2] === index

  const toggleIsEditing = useCallback(() => {
    setEditingCell((prev) => (prev ? null : [rowIndex, item.id, index]))
  }, [setEditingCell, rowIndex, item?.id, index])

  const value = useMemo(
    () => ({
      index,
      isEditing: select ? isEditing : false,
      isHovered,
      toggleIsEditing,
    }),
    [index, select, isEditing, isHovered, toggleIsEditing],
  )

  return <CellContext.Provider value={value}>{children}</CellContext.Provider>
}

const useCell = () => useContext(CellContext)
const CellConsumer = CellContext.Consumer
export { useCell, CellProvider, CellConsumer }
