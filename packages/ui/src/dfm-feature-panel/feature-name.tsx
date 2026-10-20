import type { FC, ReactElement, ReactNode } from 'react'
import { cn } from '../common'
import { MILLING_RULES, type RuleVocabulary } from '@toolpath/dfm'
import { faintText, type ResolvedLook } from './look'
import type { FeatureIdentity } from './types'

/**
 * A feature's short name: its type, or the app's label for it, and the way it
 * is machined from, which tells two readings of one face apart. Not the
 * report's order: the Engine orders features afresh on every analysis.
 */
export const FeatureName: FC<{
  feature: FeatureIdentity
  label?: ReactNode
  look: ResolvedLook
  /** How the feature is named: milling where left out. */
  vocabulary?: RuleVocabulary
}> = ({ feature, label, look, vocabulary = MILLING_RULES }): ReactElement => {
  const { name, detail } = vocabulary.featureLabel(feature)
  return (
    <>
      {label ?? name}
      {detail ? (
        <>
          {' '}
          <span className={cn('font-normal', faintText(look))}>{detail}</span>
        </>
      ) : null}
    </>
  )
}

/** A feature the plan cannot do without: it owns a face no other feature does. */
export const RequiredBadge: FC = (): ReactElement => (
  <span className="rounded-full bg-gray-100 px-1.5 text-2xs font-semibold text-gray-500 uppercase dark:bg-zinc-800 dark:text-zinc-300">
    Required
  </span>
)
