import React, { FC, ReactNode, SVGProps } from 'react'
import { cn } from '../common'
import { CaretUpDownIcon } from '@phosphor-icons/react'
import { useCombobox } from './combobox-context'
import { Icon } from './icon'
import { Trigger } from './trigger'
import { Value } from './value'

export type ComboboxButtonProps = {
  placeholder?: string
  icon?: FC<SVGProps<SVGSVGElement>>
  children?: ReactNode
}

export const Button = ({
  placeholder = 'Select Option',
  icon: IconComponent,
  children,
}: ComboboxButtonProps) => {
  const { size, variant, disabled, invalid } = useCombobox()

  return (
    <Trigger
      nativeButton={true}
      render={undefined}
      tabIndex={0}
      className={cn(
        'group [&:has(~[data-input])]:data-[popup-open]:hidden',
        'w-full rounded flex gap-1 items-center text-left',
        'outline-none font-medium',
        'data-[popup-open]:data-[popup-side="top"]:rounded-t-none',
        'data-[popup-open]:data-[popup-side="bottom"]:rounded-b-none',
        {
          'px-1': variant !== 'ghost',
          'focus-visible:ring-2 ring-info/75': !invalid,
          'border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-visible:ring-1 focus-visible:border-info':
            variant === 'secondary' && !invalid,
          'bg-gray-50 dark:bg-zinc-800':
            (variant === 'default' || (disabled && variant === 'secondary')) && !invalid,
          'bg-gray-100 dark:bg-zinc-800': variant === 'muted' && !invalid,
          'border border-[#FFD4E0] bg-[#FFD4E0]/25 focus-visible:border-[#FFD4E0] focus-visible:ring-2 ring-[#FFD4E0] dark:border-danger/50 dark:bg-danger/25 dark:ring-danger/50 dark:focus-visible:border-danger/50':
            invalid && !disabled,
          'h-9': size === 'xl' && variant !== 'ghost',
          'h-7': size === 'lg' && variant !== 'ghost',
          'h-6': size === 'md' && variant !== 'ghost',
          'h-5': size === 'sm' && variant !== 'ghost',
          'text-lg': size === 'xl',
          'text-sm': size === 'lg',
          'text-xs': size === 'md',
          'text-2xs': size === 'sm',
          'cursor-not-allowed': disabled,
        },
      )}
    >
      {IconComponent && (
        <IconComponent
          data-icon
          className={cn('text-gray-300 dark:text-zinc-400 shrink-0', {
            'group-hover:text-gray-400 dark:group-hover:text-zinc-100': !disabled,
            'text-gray-200 dark:text-zinc-500': disabled,
            'size-2.5': size === 'sm',
            'size-3.5': size === 'md' || size === 'lg',
            'size-4': size === 'xl',
          })}
        />
      )}
      <div
        className={cn('truncate dark:text-zinc-100', {
          'text-gray-400': variant === 'secondary',
          'text-gray-500': variant !== 'secondary' && variant !== 'ghost',
          'text-inherit': variant === 'ghost',
          'group-hover:text-gray-500 dark:group-hover:text-zinc-50': !disabled,
          'text-gray-200 dark:text-zinc-400': disabled,
          'pl-1': !IconComponent && variant !== 'ghost',
        })}
      >
        <Value
          placeholder={placeholder}
          className={cn('truncate dark:text-zinc-100', {
            'text-gray-400': variant === 'secondary',
            'text-gray-500': variant !== 'secondary' && variant !== 'ghost',
            'text-inherit': variant === 'ghost',
            'group-hover:text-gray-500 dark:group-hover:text-zinc-50': !disabled,
            'text-gray-200 dark:text-zinc-400': disabled,
          })}
        />
      </div>
      {Boolean(children) && children}
      <Icon
        className={cn('ml-auto', {
          'opacity-0 group-hover:opacity-100 group-data-[popup-open]:opacity-100':
            variant === 'ghost',
        })}
      >
        <CaretUpDownIcon weight="bold" className="size-3.5 text-gray-200 dark:text-zinc-400" />
      </Icon>
    </Trigger>
  )
}
