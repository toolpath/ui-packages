import React, { HTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../common'
import { Link } from '../link'
import { useTabs } from './tabs-context'

export type TabProps = HTMLAttributes<HTMLButtonElement | HTMLAnchorElement> & {
  value: string
  className?: string
  children: ReactNode
  asLink?: boolean
  href?: string
  type?: 'button' | 'submit' | 'reset'
  ref?: Ref<HTMLButtonElement | HTMLAnchorElement>
}

export const Tab = ({
  value,
  className,
  children,
  onClick,
  asLink = false,
  href,
  type = 'button',
  ref,
  ...restProps
}: TabProps) => {
  const { value: selectedValue, onValueChange, size } = useTabs()
  const isActive = value === selectedValue

  const scrollToCenter = (el: HTMLElement) => {
    el.scrollIntoView?.({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    onValueChange(value)
    scrollToCenter(e.currentTarget)
    onClick?.(e as React.MouseEvent<HTMLButtonElement & HTMLAnchorElement>)
  }

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (e.currentTarget.matches(':focus-visible')) {
      scrollToCenter(e.currentTarget)
    }
  }

  const sharedProps = {
    role: 'tab' as const,
    tabIndex: isActive ? -1 : 0,
    'aria-selected': isActive,
    onClick: handleClick,
    onFocus: handleFocus,
    ...restProps,
  }

  if (size === 'md') {
    const tabClassName = cn(
      'whitespace-nowrap text-xs text-gray-300 dark:text-zinc-400 font-medium select-none',
      'rounded p-1 px-2 hover:text-gray-700 hover:bg-gray-50 dark:hover:text-zinc-100 dark:hover:bg-zinc-800',
      'outline-none focus-visible:ring-2 ring-info/75',
      {
        'text-gray-700 bg-gray-50 dark:text-zinc-100 dark:bg-zinc-800': isActive,
      },
      className,
    )

    if (asLink) {
      return (
        <Link
          ref={ref as Ref<HTMLAnchorElement>}
          href={href}
          className={cn('text-inherit no-underline hover:no-underline', tabClassName)}
          {...sharedProps}
        >
          {children}
        </Link>
      )
    }

    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type={type}
        className={tabClassName}
        {...sharedProps}
      >
        {children}
      </button>
    )
  }

  const wrapperClassName = cn(
    '-mb-px rounded py-2 px-0 text-sm font-bold text-gray-300 dark:text-zinc-400 text-center',
    'whitespace-nowrap',
    {
      'rounded-b-none border-b-4 border-info text-gray-500 dark:text-zinc-100': isActive,
    },
  )

  const innerClassName = cn(
    'rounded-xl px-3 py-1 outline-none',
    'focus-visible:ring-2 focus-visible:ring-info/75',
    'transition-all duration-200 ease-in-out',
    {
      'hover:text-gray-500 hover:bg-gray-100/50 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/50':
        !isActive,
    },
    className,
  )

  if (asLink) {
    return (
      <div data-wrapper className={wrapperClassName}>
        <Link
          ref={ref as Ref<HTMLAnchorElement>}
          href={href}
          className={cn('text-inherit no-underline hover:no-underline', innerClassName)}
          {...sharedProps}
        >
          {children}
        </Link>
      </div>
    )
  }

  return (
    <div data-wrapper className={wrapperClassName}>
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type={type}
        className={innerClassName}
        {...sharedProps}
      >
        {children}
      </button>
    </div>
  )
}
