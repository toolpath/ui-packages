import type { FC, ReactElement, ReactNode } from 'react'
import { cn } from '@toolpath/ui'
import { featureTypeLabel } from '../model/geometry.js'
import { directionLabel } from '../rule-list/direction-label.js'
import { faintText, type ResolvedLook } from './look.js'
import type { FeatureIdentity } from './types.js'

/**
 * A feature's short name: its type, or the app's label for it, and the way it
 * is machined from, which tells two readings of one face apart. Not the
 * report's order: the Engine orders features afresh on every analysis.
 */
export const FeatureName: FC<{
  feature: FeatureIdentity
  label?: ReactNode
  look: ResolvedLook
}> = ({ feature, label, look }): ReactElement => (
  <>
    {label ?? featureTypeLabel(feature.featureType)}{' '}
    <span className={cn('font-normal', faintText(look))}>
      from {directionLabel(feature.machiningDirection)}
    </span>
  </>
)

/** A feature the plan cannot do without: it owns a face no other feature does. */
export const RequiredBadge: FC = (): ReactElement => (
  <span className="rounded-full bg-gray-100 px-1.5 text-2xs font-semibold text-gray-500 uppercase dark:bg-zinc-800 dark:text-zinc-300">
    Required
  </span>
)
