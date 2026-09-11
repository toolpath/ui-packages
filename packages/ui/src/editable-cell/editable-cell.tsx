import React, {
  FC,
  ReactNode,
  SVGProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import { cn } from '../common'
import { ArrowElbowDownLeftIcon } from '@phosphor-icons/react'
import { Input } from '../input'

const ReturnIcon = (props: SVGProps<SVGSVGElement>) => (
  <ArrowElbowDownLeftIcon weight="bold" {...props} />
)

export interface EditingCell {
  rowId: string | number
  field: string
}

export type NavigateDirection = 'next' | 'prev' | 'up' | 'down'

export interface EditableCellProps {
  rowId: string | number
  field: string
  value: number | string | null | undefined
  type?: 'text' | 'number'
  editingCell: EditingCell | null
  additionalCells?: Array<EditingCell>
  modifierHeld?: boolean
  onStartEdit?: (rowId: string | number, field: string) => void
  onToggleAdditional?: (rowId: string | number, field: string) => void
  onSelectThrough?: (rowId: string | number, field: string) => void
  onExtendSelection?: (direction: 'up' | 'down') => void
  onCommit: (rowId: string | number, field: string, rawValue: string, dirty?: boolean) => void
  onNavigate?: (
    rowId: string | number,
    field: string,
    rawValue: string,
    direction: NavigateDirection,
    dirty?: boolean,
  ) => void
  onCancel: () => void
  children: ReactNode
}

/**
 * Module-level store that survives full component remounts caused by
 * react-table-library's Virtualized component recreating its
 * innerElementType on every render, which unmounts/remounts all rows.
 */
const liveEdit: {
  key: string | null
  value: string
  selectionStart: number
  selectionEnd: number
  dirty: boolean
} = {
  key: null,
  value: '',
  selectionStart: 0,
  selectionEnd: 0,
  dirty: false,
}

const cellKey = (rowId: string | number, field: string) => `${rowId}::${field}`

export const EditableCell: FC<EditableCellProps> = ({
  rowId,
  field,
  value,
  type = 'number',
  editingCell,
  additionalCells,
  modifierHeld = false,
  onStartEdit,
  onToggleAdditional,
  onSelectThrough,
  onExtendSelection,
  onCommit,
  onNavigate,
  onCancel,
  children,
}) => {
  const isEditing = editingCell?.rowId === rowId && editingCell?.field === field
  const isAdditional = additionalCells?.some((c) => c.rowId === rowId && c.field === field) ?? false
  const hasActiveEdit = editingCell !== null
  const isSameColumn = editingCell?.field === field
  const isCrossColumn = hasActiveEdit && !isSameColumn
  const showBlocked = isCrossColumn && modifierHeld
  const inputRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)
  const navigatingRef = useRef(false)
  const unmountingRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const callbacksRef = useRef({
    onCommit,
    onNavigate,
    onCancel,
    onExtendSelection,
  })
  callbacksRef.current = { onCommit, onNavigate, onCancel, onExtendSelection }

  useLayoutEffect(() => {
    unmountingRef.current = false
    return () => {
      unmountingRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!isEditing || !inputRef.current) {
      return
    }
    const key = cellKey(rowId, field)
    if (liveEdit.key === key) {
      inputRef.current.value = liveEdit.value
      dirtyRef.current = liveEdit.dirty
      inputRef.current.focus()
      inputRef.current.setSelectionRange(
        Math.min(liveEdit.selectionStart, inputRef.current.value.length),
        Math.min(liveEdit.selectionEnd, inputRef.current.value.length),
      )
    } else {
      const v = valueRef.current
      inputRef.current.value = v != null ? String(v) : ''
      liveEdit.key = key
      liveEdit.value = inputRef.current.value
      liveEdit.selectionStart = 0
      liveEdit.selectionEnd = inputRef.current.value.length
      liveEdit.dirty = false
      dirtyRef.current = false
      inputRef.current.focus()
      inputRef.current.select()
    }
    navigatingRef.current = false
  }, [isEditing, rowId, field])

  const getValue = useCallback(() => inputRef.current?.value ?? '', [])

  const syncLive = useCallback(() => {
    if (inputRef.current) {
      dirtyRef.current = true
      liveEdit.dirty = true
      liveEdit.value = inputRef.current.value
      liveEdit.selectionStart = inputRef.current.selectionStart ?? 0
      liveEdit.selectionEnd = inputRef.current.selectionEnd ?? liveEdit.selectionStart
    }
  }, [])

  const syncSelection = useCallback(() => {
    if (inputRef.current) {
      liveEdit.selectionStart = inputRef.current.selectionStart ?? 0
      liveEdit.selectionEnd = inputRef.current.selectionEnd ?? liveEdit.selectionStart
    }
  }, [])

  const clearLive = useCallback(() => {
    liveEdit.key = null
    liveEdit.value = ''
    liveEdit.selectionStart = 0
    liveEdit.selectionEnd = 0
    liveEdit.dirty = false
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { onCommit, onNavigate, onCancel, onExtendSelection } = callbacksRef.current
      const dirty = dirtyRef.current
      if (e.key === 'Enter') {
        e.preventDefault()
        clearLive()
        onCommit(rowId, field, getValue(), dirty)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        clearLive()
        onCancel()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        navigatingRef.current = true
        clearLive()
        onNavigate?.(rowId, field, getValue(), e.shiftKey ? 'prev' : 'next', dirty)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (e.shiftKey && onExtendSelection) {
          onExtendSelection('down')
        } else {
          navigatingRef.current = true
          clearLive()
          onNavigate?.(rowId, field, getValue(), 'down', dirty)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.shiftKey && onExtendSelection) {
          onExtendSelection('up')
        } else {
          navigatingRef.current = true
          clearLive()
          onNavigate?.(rowId, field, getValue(), 'up', dirty)
        }
      }
    },
    [rowId, field, getValue, clearLive],
  )

  const handleBlur = useCallback(() => {
    if (navigatingRef.current || unmountingRef.current) {
      return
    }
    clearLive()
    callbacksRef.current.onCommit(rowId, field, getValue(), dirtyRef.current)
  }, [rowId, field, getValue, clearLive])

  const isMultiSelectKey = (e: React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey

  const handleDisplayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMultiSelectKey(e) && hasActiveEdit && isSameColumn) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (hasActiveEdit && !isMultiSelectKey(e)) {
        window.setTimeout(() => {
          onStartEdit?.(rowId, field)
        }, 0)
      }
    },
    [field, hasActiveEdit, isSameColumn, onStartEdit, rowId],
  )

  const handleDisplayClick = useCallback(
    (e: React.MouseEvent) => {
      if (!hasActiveEdit || isCrossColumn) {
        onStartEdit?.(rowId, field)
        return
      }
      if (e.shiftKey && onSelectThrough) {
        e.stopPropagation()
        onSelectThrough(rowId, field)
        return
      }
      if ((e.metaKey || e.ctrlKey) && onToggleAdditional) {
        e.stopPropagation()
        onToggleAdditional(rowId, field)
        return
      }
      onStartEdit?.(rowId, field)
    },
    [rowId, field, hasActiveEdit, isCrossColumn, onStartEdit, onToggleAdditional, onSelectThrough],
  )

  if (isEditing) {
    return (
      <div
        className="m-0 p-0 -mx-1"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          name={`editable-${field}-${rowId}`}
          id={`editable-${field}-${rowId}`}
          size="md"
          icon={ReturnIcon}
          iconPosition="right"
          inputMode={type === 'number' ? 'numeric' : undefined}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onInput={syncLive}
          onSelect={syncSelection}
          className="px-0.5 focus-within:ring-1 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
    )
  }

  if (isAdditional) {
    return (
      <div
        className="rounded -mx-1 -my-0.5 px-1.5 py-1 h-6 bg-info/10 cursor-text dark:bg-info/20"
        onClick={handleDisplayClick}
        onMouseDown={handleDisplayMouseDown}
      >
        <div className="opacity-50">{children}</div>
      </div>
    )
  }

  if (!onStartEdit) {
    return <div className="mx-0.5">{children}</div>
  }

  return (
    <div
      className={cn(
        '-mx-1.5 h-8 flex items-center flex flex-row flex-1',
        showBlocked ? 'cursor-not-allowed pointer-events-none' : 'cursor-text',
      )}
      onClick={handleDisplayClick}
      onMouseDown={handleDisplayMouseDown}
    >
      <div
        className={cn(
          'rounded mx-0.5 -my-0.5 px-1.5 py-1 h-6 w-full',
          showBlocked
            ? 'cursor-not-allowed pointer-events-none'
            : 'cursor-text hover:bg-gray-50 dark:hover:bg-zinc-800',
        )}
      >
        {children}
      </div>
    </div>
  )
}
