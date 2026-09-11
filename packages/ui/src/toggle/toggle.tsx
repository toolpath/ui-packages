import React, { Children, ReactElement, ReactNode, isValidElement } from 'react'
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react'
import { cn } from '../common'
import { Indicator } from './indicator'
import { Item, ToggleItemProps } from './item'
import { ToggleConsumer, ToggleProvider } from './toggle-context'

export type ToggleProps = {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
}

export const Toggle = ({
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  className,
  children,
}: ToggleProps) => {
  // Count the number of Toggle.Item children
  const itemCount = Children.toArray(children).filter(
    (child) => isValidElement(child) && child.type === Item,
  ).length

  // Collect item values for binary toggle keyboard handling
  const itemValues = Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === Item)
    .map((child) => (child as ReactElement<ToggleItemProps>).props.value)

  const isBinaryToggle = itemCount === 2

  return (
    <ToggleProvider
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      size={size}
      isBinaryToggle={isBinaryToggle}
    >
      <ToggleConsumer>
        {(context) => {
          if (!context) {
            return null
          }

          const { containerRef } = context

          const handleValueChange = (newValues: string[]) => {
            // For binary toggles, clicking either item toggles to the other value
            if (isBinaryToggle) {
              const otherValue = itemValues.find((v) => v !== value)
              if (otherValue) {
                onValueChange(otherValue)
              }
              return
            }

            // For multi-item toggles, only change if clicking a different item
            if (newValues.length > 0 && newValues[0] !== value) {
              onValueChange(newValues[0])
            }
          }

          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (disabled || !isBinaryToggle) {
              return
            }
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              const otherValue = itemValues.find((v) => v !== value)
              if (otherValue) {
                onValueChange(otherValue)
              }
            }
          }

          // Build props conditionally based on toggle type
          const accessibilityProps = isBinaryToggle
            ? {
                tabIndex: disabled ? undefined : 0,
                onKeyDown: handleKeyDown,
                role: 'switch' as const,
                'aria-checked': value === itemValues[1],
              }
            : {
                role: 'group' as const,
              }

          return (
            <BaseToggleGroup
              ref={containerRef}
              value={[value]}
              onValueChange={handleValueChange}
              disabled={disabled}
              {...accessibilityProps}
              className={cn(
                'relative inline-flex items-center bg-gray-100 dark:bg-zinc-900 px-0.5',
                'outline outline-0.5 outline-offset-0 outline-gray-200 dark:outline-zinc-800',
                {
                  'h-5 rounded': size === 'sm',
                  'h-6 rounded-md': size === 'md',
                  'h-8 rounded-lg': size === 'lg',
                  'focus-visible:ring-2 focus-visible:ring-info/75 focus-visible:outline-none':
                    isBinaryToggle,
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info/75': !isBinaryToggle,
                  'cursor-not-allowed opacity-60': disabled,
                },
                className,
              )}
            >
              <Indicator />
              {children}
            </BaseToggleGroup>
          )
        }}
      </ToggleConsumer>
    </ToggleProvider>
  )
}
