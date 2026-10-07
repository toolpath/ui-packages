import { useState, type FC, type ReactElement, type ReactNode } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '@toolpath/ui'
import type { FoldStore } from './fold-store.js'

interface FoldSectionProps {
  /** Which section this is, for the fold store: see {@link FoldStore}. */
  id: string
  title: ReactNode
  /** Beside the title, outside the button that folds it: a copy or pop-out button. */
  action?: ReactNode
  defaultOpen?: boolean
  folds?: FoldStore
  className?: string
  children: ReactNode
}

/**
 * A section of the feature panel that folds away under its heading. Whether it
 * is open is kept by section, not by feature, so a section put away stays away
 * as the reader moves from one feature to the next — in the app's fold store
 * where it gives one, else for as long as the section is mounted.
 */
export const FoldSection: FC<FoldSectionProps> = ({
  id,
  title,
  action,
  defaultOpen = true,
  folds,
  className,
  children,
}): ReactElement => {
  const [open, setOpen] = useState(() => folds?.read(id) ?? defaultOpen)
  return (
    <section className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
            folds?.write(id, !open)
          }}
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded text-left text-2xs font-semibold text-gray-400 uppercase',
            'hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300',
            'outline-none focus-visible:ring-2 focus-visible:ring-info/75',
          )}
        >
          <CaretRightIcon
            weight="bold"
            className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
          />
          <span className="truncate">{title}</span>
        </button>
        {action}
      </div>
      {open ? children : null}
    </section>
  )
}
