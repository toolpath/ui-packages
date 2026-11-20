import React, { HTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../common'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** What is missing, as a heading: "No quotes". */
  title: ReactNode
  /** What to do about it, in a line under the title. Omit it where the page above already says. */
  description?: ReactNode
  /** A picture above the title. Decorative: hidden from assistive technology. */
  icon?: ReactNode
  /** The one thing to do, usually a `Button`. Leave it out rather than disable it. */
  action?: ReactNode
  /** The title's heading level, to fit the page's outline. Defaults to 2. */
  headingLevel?: 2 | 3 | 4
  /** `page` fills a page or a list; `compact` sits in a panel. Defaults to `page`. */
  size?: 'page' | 'compact'
  ref?: Ref<HTMLDivElement>
}

/**
 * What a list or panel shows when it has nothing in it: a heading naming what is missing, a line
 * saying what to do about it, and, where there is one thing to do, the control that does it, in
 * the space where the answer would be.
 */
export const EmptyState = ({
  title,
  description,
  icon,
  action,
  headingLevel = 2,
  size = 'page',
  className,
  ...props
}: EmptyStateProps) => {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const compact = size === 'compact'
  return (
    <div
      {...props}
      className={cn(
        'flex w-full flex-col items-center justify-center tracking-normal',
        compact ? 'gap-3 px-4 py-6' : 'gap-4 py-10 sm:py-20',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn(
            'flex text-gray-300 dark:text-zinc-500',
            compact ? '[&_svg]:size-6' : '[&_svg]:size-8',
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col items-center justify-center gap-1">
        <Heading
          className={cn(
            'text-center text-gray-500 dark:text-zinc-100',
            compact ? 'text-sm font-semibold' : 'text-lg font-bold',
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p
            className={cn(
              'text-pretty px-4 text-center font-normal text-gray-500 dark:text-zinc-300',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
