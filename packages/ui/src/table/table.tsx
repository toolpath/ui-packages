import { isNull } from 'lodash-es'
import React, {
  Children,
  Dispatch,
  ReactElement,
  ReactNode,
  SetStateAction,
  cloneElement,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { SelectTypes, useRowSelect } from '@table-library/react-table-library/select'
import { SortToggleType, useSort } from '@table-library/react-table-library/sort'
import {
  Table as BaseTable,
  Data,
  Header,
  TableNode,
} from '@table-library/react-table-library/table'
import { TreeExpandClickTypes, useTree } from '@table-library/react-table-library/tree'
import { Action, IdState, State } from '@table-library/react-table-library/types/common'
import { VirtualizedProps } from '@table-library/react-table-library/types/virtualized'
import { Virtualized } from '@table-library/react-table-library/virtualized'
import { Body } from './body'
import { GroupEmptyState } from './group-empty-state'
import { GroupHeader } from './group-header'
import { HeaderRow } from './header-row'
import { isGroupEmptyState, isGroupEmptyStateSpacer } from './is-group-empty-state'
import { isGroupHeader } from './is-group-header'
import { RowConsumer, RowProvider } from './row-context'
import { EditingCell, TableDensity, TableProvider, useTable } from './table-context'
import { TableEmpty, TableEmptyProps } from './table-empty'
import { TreeIcon } from './tree-icon'
import { useColumnLayout } from './use-column-layout'
import { useGroups } from './use-groups'
import { useSortFunctions } from './use-sort-functions'

export type TableSelectedRows = IdState | undefined
export type TableSortDirection = 'asc' | 'desc'
export type TableSort = number | string | readonly [number | string, TableSortDirection]
export type TableSortState = {
  sortKey: number | null
  direction: TableSortDirection
  reverse: boolean
}
const ROW_HEIGHT = 33
const ROW_HEIGHT_ROOMY = 45

export const getRowHeight = (density: TableDensity = 'dense') =>
  density === 'roomy' ? ROW_HEIGHT_ROOMY : ROW_HEIGHT

export interface TableProps<T>
  extends Omit<VirtualizedProps<any>, 'tableList' | 'rowHeight' | 'header' | 'body'> {
  data: Array<T>
  id?: string
  density?: TableDensity
  header: ReactNode
  select?: boolean
  multiselect?: boolean
  empty?: ReactElement<TableEmptyProps>
  selectedRows?: any
  setSelectedRows?: Dispatch<SetStateAction<any>>
  editingCell?: EditingCell
  setEditingCell?: Dispatch<SetStateAction<EditingCell | null>>
  /**
   * Initial sort (column index, header key, or tuple with direction).
   * Accepts column index (number), header key (string), or
   * [key, 'asc' | 'desc'].
   */
  defaultSort?: TableSort
  onSortChange?: (sortState: TableSortState) => void
  children: (node: T, index: number) => ReactNode
  className?: string
  grouped?: {
    counts: Array<number>
    header: (index: number) => ReactNode
    emptyState?: (index: number) => ReactNode
  }
  defaultCollapsedGroups?: Array<number>
  tree?: boolean
  /** Enable vertical scroll with hidden scrollbar. Parent must have explicit height. */
  scrollable?: boolean
  /** Render every row instead of using virtualized rows. */
  virtualized?: boolean
  /** Disable the built-in keyboard navigation (arrow keys, escape). Default true. */
  keyboardNavigation?: boolean
  /**
   * Called before selection changes (on row click). Return false to cancel
   * both cursor and selection updates. Useful for dirty state confirmation.
   */
  onBeforeSelectionChange?: (item: T, index: number | null) => boolean
}

export const TableRoot = <T,>({
  data,
  density,
  selectedRows,
  setSelectedRows,
  editingCell,
  setEditingCell,
  defaultSort,
  onSortChange,
  keyboardNavigation,
  onBeforeSelectionChange,
  defaultCollapsedGroups,
  header,
  children,
  tree = false,
  scrollable = false,
  ...props
}: TableProps<T>) => {
  if (
    (props.select || props.multiselect) &&
    data.some((item) => item === null || typeof item !== 'object' || !('id' in item))
  ) {
    throw new Error(`One or more objects are missing an 'id' property`)
  }

  if (!isValidElement(header)) {
    throw new Error(`Invalid header element provided to Table component`)
  }

  if (tree && props.grouped) {
    throw new Error(`Tree and grouped modes cannot be used together`)
  }

  return (
    <TableProvider
      columns={
        Children.count((header.props as { children?: ReactNode }).children) +
        (props.select || props.multiselect ? 1 : 0)
      }
      density={density}
      select={props.select}
      multiselect={props.multiselect}
      keyboardNavigation={keyboardNavigation}
      selectedRows={selectedRows as IdState}
      setSelectedRows={setSelectedRows as Dispatch<SetStateAction<IdState>>}
      editingCell={editingCell}
      setEditingCell={setEditingCell}
      defaultCollapsedGroups={defaultCollapsedGroups}
      isEmpty={!props.grouped && !data?.length}
      onBeforeSelectionChange={onBeforeSelectionChange}
    >
      <Table
        data={data}
        header={header}
        tree={tree}
        defaultSort={defaultSort}
        onSortChange={onSortChange}
        scrollable={scrollable}
        {...props}
      >
        {children}
      </Table>
    </TableProvider>
  )
}

const Table = <T,>({
  data,
  select: selectable = false,
  multiselect = false,
  header,
  children,
  id,
  empty,
  grouped,
  tree: isTree = false,
  defaultSort,
  onSortChange,
  scrollable = false,
  virtualized = true,
  ...props
}: Omit<
  TableProps<T>,
  'selectedRows' | 'setSelectedRows' | 'isEditingCell' | 'setIsEditingCell'
>) => {
  if (!isValidElement(header)) {
    throw new Error(`Invalid header element provided to Table component`)
  }

  const tableRef = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const headerElement = header as Parameters<typeof useSortFunctions>[0]
  const sortFunctions = useSortFunctions(headerElement, Boolean(grouped))
  const { handleLayoutChange, columnLayout } = useColumnLayout(headerElement, id)
  const {
    data: groupedData,
    handleScroll,
    currentGroup,
    currentGroupIndex,
    getGroupIndex,
  } = useGroups(data, tableRef, grouped)

  const { selectedRows, setSelectedRows, isEmpty, density } = useTable()
  // Ref to prevent infinite loop when we modify state - the library may call
  // onChange again when it sees the modified state, so we skip processing if
  // we just set the state ourselves
  const isSettingStateRef = useRef(false)
  // Use ref to access selectedRows in callback without adding it as dependency
  const selectedRowsRef = useRef(selectedRows)
  selectedRowsRef.current = selectedRows

  const handleSelectChange = useCallback(
    (action: Action, state: State) => {
      // Skip if we just set state ourselves to prevent infinite loop
      if (isSettingStateRef.current) {
        isSettingStateRef.current = false
        return
      }

      const idState = state as IdState

      // For additive ctrl/cmd clicks the library reports ids derived from its
      // own internal state, which can desync from the controlled state when
      // updates are batched. Compute the new selection from the previous
      // controlled state plus the toggled id so previously-selected rows are
      // never dropped on a subsequent ctrl/cmd click.
      if (action?.type === 'ADD_BY_ID') {
        const newId = action.payload?.id
        const currentSelectedRows = selectedRowsRef.current
        const existingIds: Array<IdState['ids'][number]> = []
        if (currentSelectedRows?.id != null) {
          existingIds.push(currentSelectedRows.id)
        }
        if (currentSelectedRows?.ids?.length) {
          existingIds.push(...currentSelectedRows.ids)
        }
        if (newId != null) {
          existingIds.push(newId)
        }
        const uniqueIds = Array.from(new Set(existingIds))
        isSettingStateRef.current = true
        setSelectedRows({ id: null, ids: uniqueIds })
        return
      }

      if (idState?.ids && Array.isArray(idState.ids) && idState.ids.length > 0) {
        // Deduplicate ids array to prevent duplicates from shift-click selection
        const uniqueIds = Array.from(new Set(idState.ids))
        // When using ids for multi-select, id should be null (they're mutually exclusive)
        isSettingStateRef.current = true
        setSelectedRows({ id: null, ids: uniqueIds })
      } else {
        setSelectedRows(idState)
      }
    },
    [setSelectedRows],
  )

  const theme = useMemo(
    () => ({
      Table: `
      grid-auto-rows: max-content;
      --data-table-library_grid-template-columns: ${columnLayout};
      ${scrollable ? '' : 'overflow: clip;'}
    `,
      Row: `background-color: inherit !important;`,
      HeaderRow: `z-index: 1; background-color: white; .dark & { background-color: rgb(63 63 70); }`,
      Cell: `
      > div:first-of-type > div:first-of-type > div:first-of-type { flex: 1; }
      & button.prefix { margin-right: 0 !important; }
    `,
      HeaderCell: `
      > div:first-of-type > button:first-of-type > div:first-of-type {
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      & .resizer-area {
        cursor: col-resize !important;
        min-width: 8px;
      }
    `,
    }),
    [columnLayout, scrollable],
  )

  const layout = useMemo(
    () => ({
      onLayoutChange: handleLayoutChange,
      fixedHeader: true,
      isDiv: true,
      custom: true,
    }),
    [handleLayoutChange],
  )

  const tableNodes = useMemo(() => ({ nodes: groupedData }) as Data<TableNode>, [groupedData])

  // Map a consumer-friendly sort key (header key or sortKey prop) to the
  // numeric column index react-table-library expects, accounting for the
  // optional leading select column.
  const resolveSortColumnIndex = (
    sortKey: string,
    hasSelectColumn: boolean,
  ): number | undefined => {
    const children = Children.toArray((header.props as { children?: ReactNode }).children)

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (!isValidElement(child)) {
        continue
      }

      const childKey = child.key?.toString()
      const childSortKey = (child.props as { sortKey?: string }).sortKey

      if (childKey === sortKey || childSortKey === sortKey) {
        return hasSelectColumn ? i + 1 : i
      }
    }

    return undefined
  }

  // Normalize the default sort into the shape the underlying table library
  // consumes: numeric column index plus a boolean direction flag.
  const normalizeDefaultSort = (
    sort: TableSort | undefined,
    hasSelectColumn: boolean,
  ): { sortKey?: number; direction: TableSortDirection } => {
    if (sort == null) {
      return { direction: 'asc' }
    }

    const [rawKey, direction] = Array.isArray(sort) ? sort : [sort, 'asc' as TableSortDirection]

    const normalizedDirection: TableSortDirection = direction === 'desc' ? 'desc' : 'asc'

    const resolvedSortKey =
      typeof rawKey === 'number' ? rawKey : resolveSortColumnIndex(rawKey, hasSelectColumn)

    return { sortKey: resolvedSortKey, direction: normalizedDirection }
  }

  // Memoize tree config to prevent unnecessary re-renders
  const treeOnChange = useMemo(() => ({ onChange: () => {} }), [])
  const treeOptions = useMemo(
    () => ({
      clickType: TreeExpandClickTypes.ButtonClick,
      indentation: 0,
      treeIcon: {
        iconDefault: (item: TableNode) => <TreeIcon item={item} type="IconDefault" />,
        iconRight: (item: TableNode) => <TreeIcon item={item} type="IconRight" />,
        iconDown: (item: TableNode) => <TreeIcon item={item} type="IconDown" />,
      },
    }),
    [],
  )
  const tree = useTree(tableNodes, treeOnChange, treeOptions)

  // Use ref to access onSortChange without adding it as dependency
  const onSortChangeRef = useRef(onSortChange)
  onSortChangeRef.current = onSortChange

  const handleSortChange = useCallback((_action: Action, state: State) => {
    const sortState = state as { sortKey: number | null; reverse: boolean }
    const direction: TableSortDirection = sortState.reverse ? 'desc' : 'asc'
    onSortChangeRef.current?.({
      sortKey: sortState.sortKey ?? null,
      reverse: sortState.reverse ?? false,
      direction,
    })
  }, [])

  // Build initial sort state if defaults are provided
  const { sortKey: initialSortKey, direction: initialDirection } = normalizeDefaultSort(
    defaultSort,
    selectable,
  )

  const initialSortState = useMemo(
    () =>
      initialSortKey != null
        ? {
            sortKey: initialSortKey,
            reverse: initialDirection === 'desc',
          }
        : undefined,
    [initialSortKey, initialDirection],
  )

  const sortConfig = useMemo(
    () => ({ state: initialSortState, onChange: handleSortChange }),
    [initialSortState, handleSortChange],
  )
  const sortOptions = useMemo(
    () => ({
      sortFns: !isEmpty ? sortFunctions : [],
      sortToggleType: SortToggleType.AlternateWithReset,
    }),
    [isEmpty, sortFunctions],
  )
  const sort = useSort(tableNodes, sortConfig, sortOptions)

  const selectConfig = useMemo(
    () => ({ state: selectedRows, onChange: handleSelectChange }),
    [selectedRows, handleSelectChange],
  )
  const selectOptions = useMemo(
    () =>
      !multiselect
        ? {
            rowSelect: SelectTypes.SingleSelect,
            buttonSelect: SelectTypes.SingleSelect,
          }
        : {},
    [multiselect],
  )
  const select = useRowSelect(tableNodes, selectConfig, selectOptions)

  const handleContainerMouseDown = useCallback(() => {
    // Focus the container so keyboard navigation works
    containerRef.current?.focus()
  }, [])

  // Scrollable mode: enables internal vertical scroll with hidden scrollbar.
  // Parent must have explicit height (e.g., h-[300px]) for this to work.
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseDown={handleContainerMouseDown}
      className={`w-full h-full overflow-x-scroll ${scrollable ? 'overflow-y-auto' : ''} hide-scrollbar relative tracking-normal text-gray-500 dark:text-zinc-100 bg-white dark:bg-zinc-950 antialiased outline-none`}
    >
      <BaseTable
        data={tableNodes}
        theme={theme}
        sort={sort}
        layout={layout}
        tree={isTree ? tree : undefined}
        ref={tableRef}
        select={selectable || multiselect ? select : undefined}
        {...props}
      >
        {(tableList: Array<TableNode>) => {
          const indexes = tableList
            .map((item, index) =>
              isGroupHeader(item) || isGroupEmptyState(item) ? null : [index, item.id],
            )
            .filter((item) => !isNull(item)) as Array<[number, number | string]>

          if (isEmpty) {
            if (empty) {
              // If a custom empty component is provided, inject the header prop when possible.
              if (isValidElement(empty)) {
                return cloneElement(empty, { header })
              }

              throw new Error('Invalid empty component provided to Table component')
            }

            return <TableEmpty header={header} />
          }

          if (isTree || !virtualized) {
            return (
              <Body indexes={indexes} containerRef={containerRef} data={tableList}>
                <Header>
                  {header}
                  {Boolean(grouped) && (
                    <HeaderRow noOffset>
                      <GroupHeader inHeader groupIndex={currentGroupIndex ?? 0}>
                        {currentGroup}
                      </GroupHeader>
                    </HeaderRow>
                  )}
                </Header>
                {tableList.map((item, index) => (
                  <RowProvider
                    key={item.id}
                    item={item}
                    index={index}
                    groupIndex={grouped ? getGroupIndex(index) : undefined}
                  >
                    <RowConsumer>{({ item }) => children(item, index)}</RowConsumer>
                  </RowProvider>
                ))}
              </Body>
            )
          }

          return (
            <Body indexes={indexes} containerRef={containerRef} data={tableList}>
              <Virtualized
                key={density}
                tableList={sort.state.reverse && grouped ? [...tableList].reverse() : tableList}
                rowHeight={getRowHeight(density)}
                header={() => {
                  // Header rerenders once per scroll.
                  if (grouped) {
                    handleScroll()
                  }

                  return (
                    <Header>
                      {header}
                      {Boolean(grouped) && (
                        <HeaderRow noOffset>
                          <GroupHeader inHeader groupIndex={currentGroupIndex ?? 0}>
                            {currentGroup}
                          </GroupHeader>
                        </HeaderRow>
                      )}
                    </Header>
                  )
                }}
                body={(item, index) => {
                  if (isGroupEmptyState(item)) {
                    if (isGroupEmptyStateSpacer(item)) {
                      return null
                    }
                    const groupIdx = getGroupIndex(index)
                    return <GroupEmptyState>{grouped?.emptyState?.(groupIdx)}</GroupEmptyState>
                  }

                  if (isGroupHeader(item)) {
                    return (
                      <GroupHeader groupIndex={getGroupIndex(index)} rowIndex={index}>
                        {item as unknown as ReactNode}
                      </GroupHeader>
                    )
                  }

                  return (
                    <RowProvider
                      item={item}
                      index={index}
                      groupIndex={grouped ? getGroupIndex(index) : undefined}
                    >
                      <RowConsumer>{({ item }) => children(item, index)}</RowConsumer>
                    </RowProvider>
                  )
                }}
              />
            </Body>
          )
        }}
      </BaseTable>
    </div>
  )
}
