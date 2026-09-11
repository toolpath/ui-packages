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
import { IdState } from '@table-library/react-table-library/types/common'

export type EditingCell = [number, number | string, number]
export type TableDensity = 'dense' | 'roomy'

interface TableContextInterface {
  columns: number
  density: TableDensity
  select: boolean
  multiselect: boolean
  keyboardNavigation: boolean
  isEmpty: boolean
  cursor: number | null
  setCursor: Dispatch<SetStateAction<number | null>>
  selectedRows: IdState
  setSelectedRows: Dispatch<SetStateAction<IdState>>
  editingCell: EditingCell | null
  setEditingCell: Dispatch<SetStateAction<EditingCell | null>>
  collapsedGroups: Array<number>
  setCollapsedGroups: Dispatch<SetStateAction<Array<number>>>
  /**
   * Called before selection changes (on row click). Return false to cancel
   * both cursor and selection updates. Useful for dirty state confirmation.
   */
  onBeforeSelectionChange?: (item: any, index: number | null) => boolean
}

const TableContext = createContext<TableContextInterface>({} as TableContextInterface)

interface ProviderProps {
  children: ReactElement
  density?: TableDensity
  select?: boolean
  multiselect?: boolean
  keyboardNavigation?: boolean
  selectedRows?: IdState
  setSelectedRows?: Dispatch<SetStateAction<IdState>>
  editingCell?: EditingCell
  setEditingCell?: Dispatch<SetStateAction<EditingCell | null>>
  defaultCollapsedGroups?: Array<number>
  columns: number
  isEmpty: boolean
  onBeforeSelectionChange?: (item: any, index: number | null) => boolean
}

const TableProvider: FC<ProviderProps> = ({
  children,
  density = 'dense',
  select = false,
  multiselect = false,
  keyboardNavigation = true,
  selectedRows: controlledSelectedRows,
  setSelectedRows: setControlledSelectedRows,
  editingCell: controlledEditingCell,
  setEditingCell: setControlledEditingCell,
  defaultCollapsedGroups = [],
  columns,
  isEmpty,
  onBeforeSelectionChange,
}) => {
  const [selectedRows, setSelectedRows] = useState({} as IdState)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Array<number>>(
    () => defaultCollapsedGroups,
  )

  const resolvedSelectedRows = setControlledSelectedRows ? controlledSelectedRows : selectedRows
  const resolvedSetSelectedRows = setControlledSelectedRows
    ? setControlledSelectedRows
    : setSelectedRows
  const resolvedEditingCell = setControlledEditingCell ? controlledEditingCell : editingCell
  const resolvedSetEditingCell = setControlledEditingCell
    ? setControlledEditingCell
    : setEditingCell

  const value = useMemo(
    () => ({
      select,
      multiselect,
      keyboardNavigation,
      density,
      columns,
      isEmpty,
      cursor,
      setCursor,
      selectedRows: resolvedSelectedRows ?? ({} as IdState),
      setSelectedRows: resolvedSetSelectedRows,
      editingCell: resolvedEditingCell ?? null,
      setEditingCell: resolvedSetEditingCell,
      collapsedGroups,
      setCollapsedGroups,
      onBeforeSelectionChange,
    }),
    [
      select,
      multiselect,
      keyboardNavigation,
      density,
      columns,
      isEmpty,
      cursor,
      resolvedSelectedRows,
      resolvedSetSelectedRows,
      resolvedEditingCell,
      resolvedSetEditingCell,
      collapsedGroups,
      onBeforeSelectionChange,
    ],
  )

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>
}

const useTable = () => useContext(TableContext)
export { useTable, TableProvider }
