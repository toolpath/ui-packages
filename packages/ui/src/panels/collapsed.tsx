import React, { FC, KeyboardEvent } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react'
import { useOrientation } from './orientation-context'

export interface CollapsedProps {
  onExpand: () => void
}

export const Collapsed: FC<CollapsedProps> = ({ onExpand }) => {
  const orientation = useOrientation()
  const isVertical = orientation === 'vertical'

  return (
    <button
      type="button"
      data-handle
      onMouseDown={onExpand}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === ' ') {
          e.preventDefault()
          onExpand()
        }
      }}
      className={`flex h-full relative w-full items-center justify-center group outline-none focus-visible:ring-2 ring-info/75 ring-inset ${isVertical ? 'cursor-row-resize' : 'cursor-col-resize'}`}
    >
      <DotsSixVerticalIcon
        weight="bold"
        data-handle-icon
        className={`size-4 text-gray-200 dark:text-zinc-500 group-hover:text-gray-300 dark:group-hover:text-zinc-400 ${isVertical ? 'rotate-90' : ''}`}
      />
    </button>
  )
}
