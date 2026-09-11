import React, { ReactNode, createContext, useContext, useMemo } from 'react'
import { Sort } from '@table-library/react-table-library/types/sort'
import { TableNode } from '@table-library/react-table-library/types/table'

interface TableSortValue {
  /** Column index the table is sorted by, or null while it is unsorted. */
  sortKey: number | null
  /** Whether that column is sorted descending. */
  reverse: boolean
  toggle: (columnIndex: number) => void
}

const SortContext = createContext<TableSortValue | null>(null)

/**
 * The sort state, published so a header cell can draw its own sort control.
 *
 * The table library's `HeaderCellSort` wraps the whole header cell in a
 * `<button>`, which makes any control the cell also carries — a filter funnel,
 * a menu — a button inside a button: invalid HTML, and a hydration error in
 * React 19. `HeaderCell` draws the control itself instead, and needs the state
 * the library keeps to itself: its own `useSortContext` is not exported.
 */
export const SortProvider = ({
  sort,
  children,
}: {
  sort: Sort<TableNode>
  children: ReactNode
}) => {
  const { state, fns } = sort

  const value = useMemo<TableSortValue>(
    () => ({
      sortKey: typeof state.sortKey === 'number' ? state.sortKey : null,
      reverse: Boolean(state.reverse),
      // A sort is keyed by column index, through a field the library types as
      // a string and its own header cell hands a number.
      toggle: (columnIndex) => fns.onToggleSort({ sortKey: columnIndex as unknown as string }),
    }),
    [state.sortKey, state.reverse, fns],
  )

  return <SortContext.Provider value={value}>{children}</SortContext.Provider>
}

export const useTableSort = () => useContext(SortContext)
