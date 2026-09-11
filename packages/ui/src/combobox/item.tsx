import React, { useEffect, useRef, useState } from 'react'
import {
  Combobox as BaseCombobox,
  ComboboxItemProps as BaseComboboxItemProps,
} from '@base-ui/react'
import { useCombobox } from './combobox-context'
import { cn } from '../common'
import { ArrowElbowDownLeftIcon } from '@phosphor-icons/react'
import { Tooltip } from '../tooltip/tooltip'

export type ComboboxItemProps = BaseComboboxItemProps

export const Item = ({ className, children, value, ...props }: ComboboxItemProps) => {
  const { itemToStringLabel } = useCombobox()
  const ref = useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const check = () => {
      const nodes = [el, ...el.querySelectorAll<HTMLElement>('*')]
      setIsTruncated(nodes.some((node) => node.scrollWidth > node.clientWidth))
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])

  const label = typeof value === 'string' ? value : (itemToStringLabel?.(value) ?? null)
  const tip = isTruncated ? label : null

  return (
    <BaseCombobox.Item
      className={cn(
        'group flex w-full items-center px-2 py-1 text-left gap-1 text-xs',
        'font-body font-medium text-gray-400 dark:text-zinc-300 outline-none',
        'hover:bg-gray-50 hover:text-gray-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        'data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-500 dark:data-[highlighted]:bg-zinc-900 dark:data-[highlighted]:text-zinc-100',
        'data-[selected]:text-gray-500 dark:data-[selected]:text-zinc-500 dark:data-[selected]:text-white cursor-pointer',
        'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        className,
      )}
      value={value}
      {...props}
    >
      <div ref={ref} className="flex-1 truncate">
        <Tooltip tip={tip} side="right" sideOffset={12} delay={500}>
          <>{children}</>
        </Tooltip>
      </div>
      <ArrowElbowDownLeftIcon
        weight="bold"
        className="size-4 text-gray-300 dark:text-zinc-400 hidden group-data-[highlighted]:block group-hover:hidden group-data-[highlighted]:group-hover:hidden group-data-[selected]:hidden"
      />
    </BaseCombobox.Item>
  )
}
