import React, { ReactNode } from 'react'
import { cn } from '../common'
import { CaretRightIcon } from '@phosphor-icons/react'
import { Link } from '../link'
import { useBreadcrumbs } from './breadcrumbs-context'

export type BreadcrumbsItemProps = {
  to: string
  children: ReactNode
  current?: boolean
  previous?: boolean
  className?: string
}

export const Item = ({
  to,
  children,
  current = false,
  previous = false,
  className,
}: BreadcrumbsItemProps) => {
  const { breakpoint } = useBreadcrumbs()

  return (
    <li
      className={cn(
        'hidden items-center',
        {
          'sm:flex': breakpoint === 'sm',
          'md:flex': breakpoint === 'md',
          'lg:flex': breakpoint === 'lg',
          'xl:flex': breakpoint === 'xl',
          flex: previous,
          hidden: !previous,
        },
        className,
      )}
    >
      {current ? (
        <span data-content className="flex truncate pl-2 text-gray-300 dark:text-zinc-500">
          {children}
        </span>
      ) : (
        <>
          <Link
            href={to}
            data-content
            className={cn(
              'no-underline hover:no-underline',
              'flex items-center rounded px-2 text-gray-300 dark:text-zinc-500',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-info/75',
            )}
          >
            <>
              {previous && (
                <CaretRightIcon
                  weight="regular"
                  data-previous
                  className={cn(
                    'flex size-4 rotate-180 truncate text-gray-300 dark:text-zinc-500',
                    {
                      'sm:hidden': breakpoint === 'sm',
                      'md:hidden': breakpoint === 'md',
                      'lg:hidden': breakpoint === 'lg',
                      'xl:hidden': breakpoint === 'xl',
                    },
                  )}
                />
              )}
              {children}
            </>
          </Link>
          <CaretRightIcon
            weight="regular"
            data-separator
            className={cn('hidden size-4 text-gray-300 dark:text-zinc-500', {
              'sm:flex': breakpoint === 'sm',
              'md:flex': breakpoint === 'md',
              'lg:flex': breakpoint === 'lg',
              'xl:flex': breakpoint === 'xl',
            })}
          />
        </>
      )}
    </li>
  )
}
