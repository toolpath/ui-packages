import React from 'react'
import { TableNode } from '@table-library/react-table-library/types/table'
import { cn } from '../common'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useRow } from './row-context'
import { useTable } from './table-context'

// Reusable connector components
const LConnector = ({ itemId, index }: { itemId: string | number; index: number }) => (
  <div
    key={`${itemId}-${index}`}
    className="w-2 h-3 border-l border-b border-gray-100 dark:border-zinc-800"
    style={{ marginLeft: '9px' }}
  />
)

const VerticalLine = ({ itemId, index }: { itemId: string | number; index: number }) => (
  <div
    key={`${itemId}-${index}`}
    className="w-1.5 mr-2 ml-1 h-full border-r border-gray-100 dark:border-zinc-800"
  />
)

const TConnector = ({ itemId, index }: { itemId: string | number; index: number }) => (
  <div key={`${itemId}-${index}`} className="flex flex-col items-start">
    <div
      className="w-2 h-3 border-l border-b border-gray-100 dark:border-zinc-800"
      style={{ marginLeft: '9px' }}
    />
    <div
      className="w-2 h-3 border-l border-gray-100 dark:border-zinc-800"
      style={{ marginLeft: '9px' }}
    />
  </div>
)

const VerticalSegment = ({ itemId, index }: { itemId: string | number; index: number }) => (
  <div key={`${itemId}-${index}`} className="flex flex-col items-start">
    <div
      className="w-2 h-3 border-l border-gray-100 dark:border-zinc-800"
      style={{ marginLeft: '9px' }}
    />
    <div
      className="w-2 h-3 border-l border-gray-100 dark:border-zinc-800"
      style={{ marginLeft: '9px' }}
    />
  </div>
)

const EmptySpace = ({ itemId, index }: { itemId: string | number; index: number }) => (
  <div key={`${itemId}-${index}`} className="w-5" />
)

// Walk up the tree to check if each ancestor is last in its parent
const getAncestorLastFlags = (item: TableNode): boolean[] => {
  const flags: boolean[] = []
  let current: TableNode | undefined = item

  while (current?.parentNode) {
    const parent = current.parentNode as TableNode
    const isLast = parent.nodes ? parent.nodes[parent.nodes.length - 1].id === current.id : false
    flags.unshift(isLast)
    current = parent
  }

  return flags
}

interface IndentationProps {
  item: TableNode
  isExpanded?: boolean
}

const Indentation = ({ item, isExpanded = false }: IndentationProps) => {
  const ancestorLastFlags = getAncestorLastFlags(item)
  const treeXLevel = item?.treeXLevel || 0
  const parentNode = item.parentNode as TableNode | undefined
  const isLastInParent = parentNode?.nodes
    ? parentNode.nodes[parentNode.nodes.length - 1].id === item.id
    : false
  const hasChildren = Boolean(item.nodes?.length)
  const showLConnector = isLastInParent && (!isExpanded || !hasChildren)

  return (
    <div className={`flex flex-row h-6 ${showLConnector ? 'items-start' : 'items-center'}`}>
      {Array.from({ length: treeXLevel }).map((_, index) => {
        const isLastLevel = index === treeXLevel - 1
        const ancestorIsLast = ancestorLastFlags[index] ?? false
        const key = `${item.id}-${index}`

        // Final level: connector to this item
        if (isLastLevel) {
          if (!hasChildren) {
            return isLastInParent ? (
              <LConnector key={key} itemId={item.id} index={index} />
            ) : (
              <VerticalLine key={key} itemId={item.id} index={index} />
            )
          }
          return showLConnector ? (
            <LConnector key={key} itemId={item.id} index={index} />
          ) : (
            <TConnector key={key} itemId={item.id} index={index} />
          )
        }

        // Earlier levels: vertical lines for ancestors
        if (ancestorIsLast) {
          return <EmptySpace key={key} itemId={item.id} index={index} />
        }
        return hasChildren ? (
          <VerticalSegment key={key} itemId={item.id} index={index} />
        ) : (
          <VerticalLine key={key} itemId={item.id} index={index} />
        )
      })}
    </div>
  )
}

interface TreeIconProps {
  item: TableNode
  type?: 'IconDefault' | 'IconRight' | 'IconDown'
}

export const TreeIcon = ({ item, type = 'IconDefault' }: TreeIconProps) => {
  const { isHovered, isSelected } = useRow()
  const { density } = useTable()
  const isExpanded = type === 'IconDown'

  return (
    <div
      className={cn('flex flex-row items-center', density === 'roomy' ? 'h-11' : 'h-8', {
        'bg-gray-50 dark:bg-zinc-800': isHovered || isSelected,
      })}
    >
      <Indentation item={item} isExpanded={isExpanded} />
      {type === 'IconDefault' && <div className="w-5" />}
      {type === 'IconRight' && (
        <CaretRightIcon weight="bold" className="size-5 text-gray-300 dark:text-zinc-100" />
      )}
      {type === 'IconDown' && (
        <CaretRightIcon
          weight="bold"
          className="size-5 text-gray-300 dark:text-zinc-100 rotate-90"
        />
      )}
    </div>
  )
}
