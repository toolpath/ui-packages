import type { FC, KeyboardEvent, ReactElement, Ref } from 'react'
import { cn } from '@toolpath/ui'
import { RULE_COLORS } from '../model/dfm-rules.js'
import { listKeys } from './list-keys.js'
import { FOCUS_RING } from './styles.js'

const swatchKeys = listKeys('swatches', 'horizontal')

export interface SwatchProps {
  color: string
  label?: string
  onClick?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  /** The list the swatch is a row of, for the arrow keys (see `list-keys.ts`). */
  listItem?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/** A rule's colour, as a dot, one that can be clicked where it can be changed. */
export const Swatch: FC<SwatchProps> = ({
  color,
  label,
  onClick,
  onKeyDown,
  listItem,
  className,
  ref,
}): ReactElement => {
  const dot = cn('size-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15', className)
  return onClick ? (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-list-item={listItem}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        dot,
        'cursor-pointer hover:ring-2 hover:ring-gray-300 dark:hover:ring-zinc-500',
        FOCUS_RING,
      )}
      style={{ backgroundColor: color }}
    />
  ) : (
    <span aria-hidden className={dot} style={{ backgroundColor: color }} />
  )
}

/** The palette's colours, to choose one. */
export const ColorPicker: FC<{ value: string; onChange: (color: string) => void }> = ({
  value,
  onChange,
}): ReactElement => (
  <div className="flex flex-wrap items-center gap-1.5 py-1" onKeyDown={swatchKeys}>
    {RULE_COLORS.map((each) => (
      <button
        key={each.value}
        type="button"
        data-list-item="swatches"
        aria-label={each.name}
        aria-pressed={value === each.value}
        title={each.name}
        autoFocus={value === each.value}
        onClick={() => onChange(each.value)}
        className={cn(
          'size-5 cursor-pointer rounded-full ring-1 ring-black/10 outline-none focus-visible:ring-2 focus-visible:ring-info dark:ring-white/15',
          value === each.value &&
            'ring-2 ring-gray-600 ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-900',
        )}
        style={{ backgroundColor: each.value }}
      />
    ))}
  </div>
)
