import React, {
  Dispatch,
  FC,
  ReactElement,
  SetStateAction,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useTable } from './table-context'

interface RowContextInterface {
  item: any
  index: number
  groupIndex?: number
  isSelected: boolean
  isOnlySelected: boolean
  isDirectlySelected: boolean
  isHovered: boolean
  setIsHovered: Dispatch<SetStateAction<boolean>>
}

const RowContext = createContext<RowContextInterface>({} as RowContextInterface)

interface ProviderProps {
  children: ReactElement
  item: any
  index: number
  groupIndex?: number
}

const RowProvider: FC<ProviderProps> = ({ item, index, groupIndex, children }) => {
  const { selectedRows, select, cursor } = useTable()
  // isOnlySelected means this row is selected AND it's the only one selected
  // (id matches and ids array is empty)
  const isOnlySelected = Boolean(selectedRows?.id === item.id) && !selectedRows?.ids?.length
  const isSelected = isOnlySelected || Boolean(selectedRows?.ids?.includes(item.id))
  const isDirectlySelected = isOnlySelected && index === cursor
  const [isHovered, setIsHovered] = useState(false)

  const value = useMemo(
    () => ({
      item,
      index,
      groupIndex,
      isOnlySelected,
      isDirectlySelected,
      isSelected,
      isHovered: select ? isHovered : false,
      setIsHovered,
    }),
    [item, index, groupIndex, isOnlySelected, isDirectlySelected, isSelected, select, isHovered],
  )

  return <RowContext.Provider value={value}>{children}</RowContext.Provider>
}

const useRow = () => useContext(RowContext)
const RowConsumer = RowContext.Consumer
export { useRow, RowProvider, RowConsumer }
