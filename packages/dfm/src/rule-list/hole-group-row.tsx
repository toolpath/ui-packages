import { useRef, useState, type FC, type ReactElement } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '@toolpath/ui'
import { featureTypeLabel } from '../model/dfm-explain.js'
import { formatMeasured } from '../model/dfm-rules.js'
import type { FeatureRow } from '../model/hole-groups.js'
import {
  FEATURE_ROW,
  FeatureButton,
  HitFigure,
  ruleHit,
  type FeatureRowContext,
} from './feature-button.js'

interface HoleGroupRowProps extends FeatureRowContext {
  row: Extract<FeatureRow, { kind: 'holes' }>
  /** The way they are all machined from, which tells two groups of one size apart. */
  direction: string
}

/**
 * A set of identical holes as one row: its type, bore and how many. Choosing
 * it inspects them together; it opens to the holes one by one.
 */
export const HoleGroupRow: FC<HoleGroupRowProps> = ({
  row,
  direction,
  ...context
}): ReactElement => {
  const [open, setOpen] = useState(false)
  const groupRef = useRef<HTMLButtonElement>(null)
  const { rule, check, units, selectedGroup, featureOf, onInspect, onHover, onBack } = context
  const [first] = row.tags
  const chosen = selectedGroup?.[0] === first
  return (
    <li>
      <div className="flex items-center">
        <button
          type="button"
          aria-label={open ? 'Hide holes' : 'Show holes'}
          aria-expanded={open}
          tabIndex={-1}
          onClick={() => setOpen((was) => !was)}
          className="-ml-5 flex size-5 shrink-0 cursor-pointer items-center justify-center text-gray-300 dark:text-zinc-500"
        >
          <CaretRightIcon
            weight="bold"
            className={cn('size-3 transition-transform', open && 'rotate-90')}
          />
        </button>
        <button
          ref={groupRef}
          type="button"
          data-list-item="rules"
          data-follow
          data-feature-row
          aria-pressed={chosen}
          onClick={() => onInspect(first, row.tags)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' && !open) {
              event.preventDefault()
              setOpen(true)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              if (open) setOpen(false)
              else onBack()
            }
          }}
          onPointerEnter={() => onHover(row.tags)}
          onPointerLeave={() => onHover(null)}
          className={FEATURE_ROW}
        >
          <span className="min-w-0 flex-1 truncate">
            {featureTypeLabel(featureOf.get(first)?.featureType ?? 'hole')} ⌀
            {formatMeasured('length', row.diameter, units)}{' '}
            <span className="font-normal text-gray-400 dark:text-zinc-400">
              ×{row.tags.length} · from {direction}
            </span>
          </span>
          <HitFigure hit={ruleHit(check, rule, first)} units={units} />
        </button>
      </div>
      {open ? (
        <ul className="pl-4">
          {row.tags.map((tag) => (
            <li key={tag}>
              <FeatureButton {...context} tag={tag} onBack={() => groupRef.current?.focus()} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
