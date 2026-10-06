import type { FC, ReactElement } from 'react'
import { cn } from '@toolpath/ui'
import { featureTypeLabel, hitFigure } from '../model/dfm-explain.js'
import type { DfmCheck, DfmHit } from '../model/dfm-flags.js'
import type { DfmRule } from '../model/dfm-rules.js'
import type { DfmFeature } from '../model/geometry.js'
import type { Units } from '../model/units.js'
import { directionLabel } from './direction-label.js'
import { FOCUS_RING } from './styles.js'
import type { Hovered } from './types.js'

/** What every feature row needs: the rule, the check, and how to inspect, point at and leave a feature. */
export interface FeatureRowContext {
  rule: DfmRule
  check: DfmCheck
  units: Units
  selected: string | null
  selectedGroup: readonly string[] | null
  onInspect: (tag: string, group?: readonly string[]) => void
  onHover: (hovered: Hovered) => void
  /** Left from the top level: back up to the rule. */
  onBack: () => void
  featureOf: ReadonlyMap<string, DfmFeature>
}

export const FEATURE_ROW = cn(
  'flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-left text-xs',
  'text-gray-500 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
  'aria-pressed:bg-gray-100 aria-pressed:font-semibold aria-pressed:text-gray-700',
  'dark:aria-pressed:bg-zinc-800 dark:aria-pressed:text-zinc-100',
  FOCUS_RING,
)

/** The reading of a feature that broke the rule, if it did. */
export const ruleHit = (check: DfmCheck, rule: DfmRule, tag: string): DfmHit | undefined =>
  check.hitsByTag.get(tag.toLowerCase())?.find((each) => each.rule.id === rule.id)

/** The figure that broke the rule, at the end of a feature row. */
export const HitFigure: FC<{ hit: DfmHit | undefined; units: Units }> = ({
  hit,
  units,
}): ReactElement | null =>
  hit ? (
    <span className="shrink-0 text-gray-400 tabular-nums dark:text-zinc-400">
      {hitFigure(hit, units)}
    </span>
  ) : null

/** One feature that breaks the rule, with the figure that broke it. */
export const FeatureButton: FC<FeatureRowContext & { tag: string }> = ({
  tag,
  featureOf,
  rule,
  check,
  units,
  selected,
  selectedGroup,
  onInspect,
  onHover,
  onBack,
}): ReactElement => {
  const feature = featureOf.get(tag)
  return (
    <button
      type="button"
      data-list-item="rules"
      data-follow
      data-feature-row
      aria-pressed={selected === tag && !selectedGroup}
      onClick={() => onInspect(tag)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft') return
        event.preventDefault()
        onBack()
      }}
      onPointerEnter={() => onHover(tag)}
      onPointerLeave={() => onHover(null)}
      className={FEATURE_ROW}
    >
      <span className="min-w-0 flex-1 truncate">
        {featureTypeLabel(feature?.featureType ?? 'feature')}{' '}
        <span className="font-normal text-gray-300 dark:text-zinc-500">
          {feature ? `from ${directionLabel(feature.machiningDirection)}` : ''}
        </span>
      </span>
      <HitFigure hit={ruleHit(check, rule, tag)} units={units} />
    </button>
  )
}
