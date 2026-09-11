import React, { FC } from 'react'
import { cn } from '../common'
import { CaretRightIcon } from '@phosphor-icons/react'

export type PaginationMetadata = {
  totalPages: number
  perPage: number
}

export type PaginationProps = {
  pagination: PaginationMetadata
  page: number
  onClick: (page: number) => void
  className?: string
}

export const Pagination: FC<PaginationProps> = ({ pagination, page, onClick, className }) => {
  const isDisabled = pagination.totalPages <= 1

  const paginationLink = (linkedPage: number, ellipses: boolean = false) => (
    <li
      key={ellipses ? `ellipsis-${linkedPage}` : linkedPage}
      className="inline-block text-xs tracking-tight text-gray-300 dark:text-zinc-400"
    >
      <button
        disabled={page === linkedPage || isDisabled}
        className={cn(
          'select-none rounded-sm',
          'hover:bg-gray-50 hover:text-gray dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/75',
          'font-bold transition-colors duration-200',
          {
            'bg-gray-300 text-white hover:bg-gray-300 hover:text-white dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-50':
              page === linkedPage && !isDisabled,
            'hidden sm:block': page !== linkedPage,
            'bg-gray-100 text-white hover:bg-gray-100 hover:text-white dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-500':
              isDisabled,
          },
        )}
        onClick={() => onClick(linkedPage)}
      >
        <div className="min-w-4 px-1 py-px">{ellipses ? '…' : linkedPage}</div>
      </button>
    </li>
  )

  return (
    <div className={cn('flex whitespace-nowrap', className)}>
      <button
        disabled={page === 1}
        className={cn(
          'mt-px flex items-center rounded-sm font-semibold',
          'text-gray-300 hover:bg-gray-50',
          'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/75',
          {
            'cursor-not-allowed text-gray-100 hover:bg-transparent dark:text-zinc-600 dark:hover:bg-transparent':
              page === 1,
          },
        )}
        onClick={() => onClick(page - 1)}
      >
        <CaretRightIcon weight="bold" className="size-4 rotate-180" />
        <span className="sr-only">Previous</span>
      </button>
      <nav className="text-sm text-gray-400 dark:text-zinc-300">
        <ul>
          {paginationLink(1)}
          {pagination.totalPages >= 2 &&
            (pagination.totalPages <= 5 || page < 4) &&
            paginationLink(2)}
          {pagination.totalPages >= 3 &&
            (pagination.totalPages <= 5 || page < 4) &&
            paginationLink(3)}
          {pagination.totalPages === 5 && paginationLink(4)}
          {page > 3 &&
            pagination.totalPages > 5 &&
            paginationLink(
              page >= pagination.totalPages - 2 ? pagination.totalPages - 3 : page - 2,
              true,
            )}
          {pagination.totalPages > 6 &&
            page >= 4 &&
            page < pagination.totalPages - 2 &&
            paginationLink(page - 1)}
          {pagination.totalPages > 6 &&
            page >= 4 &&
            page < pagination.totalPages - 2 &&
            paginationLink(page)}
          {pagination.totalPages > 6 &&
            page >= 4 &&
            page < pagination.totalPages - 2 &&
            paginationLink(page + 1)}

          {pagination.totalPages > 5 &&
            page < pagination.totalPages - 2 &&
            paginationLink(
              page < 3
                ? 4
                : page === 3
                  ? page + 1
                  : page <= pagination.totalPages - 3
                    ? page + 2
                    : pagination.totalPages - 4,
              true,
            )}

          {pagination.totalPages > 5 &&
            page >= pagination.totalPages - 2 &&
            paginationLink(pagination.totalPages - 2)}
          {pagination.totalPages > 5 &&
            page >= pagination.totalPages - 2 &&
            paginationLink(pagination.totalPages - 1)}
          {pagination.totalPages > 3 && paginationLink(pagination.totalPages)}
        </ul>
      </nav>
      <button
        disabled={page >= pagination.totalPages}
        className={cn(
          'mt-px flex items-center rounded-sm font-semibold',
          'text-gray-300 hover:bg-gray-50',
          'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/75',
          {
            'cursor-not-allowed text-gray-100 hover:bg-transparent dark:text-zinc-600 dark:hover:bg-transparent':
              page >= pagination.totalPages,
          },
        )}
        onClick={() => onClick(page + 1)}
      >
        <span className="sr-only">Next</span>
        <CaretRightIcon weight="bold" className="size-4" />
      </button>
    </div>
  )
}
