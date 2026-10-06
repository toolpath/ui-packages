import { useMemo, type FC, type ReactElement } from 'react'
import type { FeatureSheets } from '../model/feature-sheet.js'
import type { DfmFeature } from '../model/geometry.js'
import { featureRows, type FeatureRow } from '../model/hole-groups.js'
import { directionLabel } from './direction-label.js'
import { FeatureButton, type FeatureRowContext } from './feature-button.js'
import { HoleGroupRow } from './hole-group-row.js'

interface FeatureRowsProps extends Omit<FeatureRowContext, 'featureOf'> {
  tags: readonly string[]
  /** Readings that break the rule but are not required: shown after the required ones, dimmed. */
  otherTags: readonly string[]
  features: readonly DfmFeature[]
  sheets: FeatureSheets
}

/**
 * The features that break a rule, identical holes as one row that opens to
 * them: the required ones first, then, under a line saying so, the readings
 * some other feature could stand in for. Those are not counted or painted,
 * but a reader opening a rule should see everything it caught.
 */
export const FeatureRows: FC<FeatureRowsProps> = ({
  tags,
  otherTags,
  features,
  sheets,
  ...rest
}): ReactElement => {
  // Grouping the holes walks every feature: done once per check, not on every render, which a
  // hover in the app can cause.
  const featureOf = useMemo(
    () => new Map(features.map((feature) => [feature.tag, feature])),
    [features],
  )
  const required = useMemo(() => featureRows(tags, features, sheets), [tags, features, sheets])
  const others = useMemo(
    () => featureRows(otherTags, features, sheets),
    [otherTags, features, sheets],
  )
  const context: FeatureRowContext = { ...rest, featureOf }
  const list = (rows: readonly FeatureRow[]): ReactElement[] =>
    rows.map((row) =>
      row.kind === 'holes' ? (
        <HoleGroupRow
          key={row.key}
          row={row}
          direction={directionOf(featureOf.get(row.key))}
          {...context}
        />
      ) : (
        <li key={row.tag}>
          <FeatureButton tag={row.tag} {...context} />
        </li>
      ),
    )
  return (
    <ul className="pb-1 pl-12">
      {list(required)}
      {otherTags.length > 0 ? (
        <>
          <li
            className="pt-1 pb-0.5 text-2xs font-semibold text-gray-400 uppercase dark:text-zinc-500"
            title="Readings of faces another feature also cuts: not counted or painted, since a plan may never cut them this way"
          >
            Other readings, not required
          </li>
          <div className="opacity-70">{list(others)}</div>
        </>
      ) : null}
    </ul>
  )
}

const directionOf = (feature: DfmFeature | undefined): string =>
  feature ? directionLabel(feature.machiningDirection) : ''
