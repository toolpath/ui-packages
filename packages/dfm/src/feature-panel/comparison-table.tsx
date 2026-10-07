import { useMemo, type FC, type ReactElement, type ReactNode } from 'react'
import { cn } from '@toolpath/ui'
import type { BrokenRule } from '../model/broken-rules.js'
import type { Measurement } from '../model/feature-details.js'
import { featureTypeLabel } from '../model/geometry.js'
import { directionLabel } from '../rule-list/direction-label.js'
import { Swatch } from '../rule-list/swatch.js'
import { FaceLetter } from './candidate-list.js'
import { FeatureName } from './feature-name.js'
import { FoldSection } from './fold-section.js'
import type { FoldStore } from './fold-store.js'
import { resolveLook, secondaryText, type FeaturePanelLook } from './look.js'
import type { FeatureIdentity } from './types.js'

/** One compared face: the feature it is read as, and what that feature is and measures. */
export interface ComparedFace {
  /** Null for a face no feature owns. */
  readonly feature: FeatureIdentity | null
  /** Its machining direction's colour, as the part shows it. */
  readonly directionColor: string
  /** Whether it is required. Left out on every face, the Required row goes. */
  readonly required?: boolean
  readonly rules: readonly BrokenRule[]
  readonly measurements: readonly Measurement[]
}

export interface ComparisonTableProps {
  faces: readonly ComparedFace[]
  /** The face being read, whose column head is marked. */
  active: number
  /** A column head chosen: that face's feature, to read. */
  onSelect: (tag: string, face: number) => void
  onHover?: (tag: string | null) => void
  look?: FeaturePanelLook
  folds?: FoldStore
}

/** A row of the comparison: what it is, each face's reading, and whether the readings disagree. */
interface ComparedRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly ReactNode[]
  readonly differs: boolean
}

const DASH = '—'

/**
 * What each compared face was read as, side by side: a column per face, its
 * feature at the head, and a row for each thing any of them has — its type,
 * the way it is machined from, whether it is required, the rules it breaks,
 * then every measurement. Rows where the readings disagree stand out; the rest
 * are greyed.
 */
export const ComparisonTable: FC<ComparisonTableProps> = ({
  faces,
  active,
  onSelect,
  onHover,
  look: lookOption,
  folds,
}): ReactElement => {
  const look = resolveLook(lookOption)
  const rows = useMemo((): ComparedRow[] => {
    const row = (
      key: string,
      label: string,
      read: (face: ComparedFace, feature: FeatureIdentity) => { text: string; node?: ReactNode },
    ): ComparedRow => {
      const values = faces.map((face) => (face.feature ? read(face, face.feature) : null))
      const texts = values.map((value) => value?.text ?? DASH)
      return {
        key,
        label,
        cells: values.map((value) => value?.node ?? value?.text ?? DASH),
        differs: new Set(texts).size > 1,
      }
    }
    const fixed = [
      row('type', 'Type', (_, feature) => ({ text: featureTypeLabel(feature.featureType) })),
      row('direction', 'Machined from', (face, feature) => {
        const text = directionLabel(feature.machiningDirection)
        return {
          text,
          node: (
            <span className="inline-flex items-center gap-1">
              <Swatch color={face.directionColor} className="size-2.5" />
              {text}
            </span>
          ),
        }
      }),
      ...(faces.some((face) => face.required !== undefined)
        ? [row('required', 'Required', (face) => ({ text: face.required ? 'Yes' : 'No' }))]
        : []),
      row('rules', 'Rules broken', (face) => ({
        text: face.rules.map((rule) => rule.key).join(',') || 'None',
        node:
          face.rules.length > 0 ? (
            <span
              className="inline-flex items-center gap-0.5"
              title={face.rules.map((rule) => rule.text).join('\n')}
            >
              {face.rules.map((rule) => (
                <Swatch key={rule.key} color={rule.color} className="size-2.5" />
              ))}
              <span className="ml-0.5">{face.rules.length}</span>
            </span>
          ) : (
            'None'
          ),
      })),
    ]
    // Every measurement any face has, in the order the faces first give them.
    const labels = new Map<string, string>()
    for (const face of faces)
      for (const each of face.measurements) labels.set(each.key, labels.get(each.key) ?? each.label)
    const measured = [...labels].map(([key, label]): ComparedRow => {
      const values = faces.map((face) => face.measurements.find((each) => each.key === key))
      return {
        key,
        label,
        cells: values.map((value) => (value ? <span title={value.alt}>{value.value}</span> : DASH)),
        differs: new Set(values.map((value) => value?.value ?? DASH)).size > 1,
      }
    })
    return [...fixed, ...measured]
  }, [faces])

  return (
    <div className="border-b border-gray-100 p-4 dark:border-zinc-800">
      <FoldSection id="comparison" title="Comparison" folds={folds}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-separate border-spacing-x-1 border-spacing-y-0.5 text-sm">
            <thead>
              <tr>
                <th className="w-0" />
                {faces.map(({ feature }, index) => (
                  <th key={index} className="text-left align-bottom font-normal">
                    <button
                      type="button"
                      disabled={!feature}
                      onClick={() => feature && onSelect(feature.tag, index)}
                      onPointerEnter={onHover ? () => onHover(feature?.tag ?? null) : undefined}
                      onPointerLeave={onHover ? () => onHover(null) : undefined}
                      className={cn(
                        'flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-left text-xs',
                        'outline-none focus-visible:ring-2 focus-visible:ring-info/75',
                        'text-gray-600 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
                        index === active && 'bg-gray-100 font-semibold dark:bg-zinc-800',
                      )}
                    >
                      <FaceLetter index={index} active={index === active} />
                      <span className="min-w-0 truncate">
                        {feature ? <FeatureName feature={feature} look={look} /> : 'No feature'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} data-differs={row.differs || undefined}>
                  <th
                    scope="row"
                    className={cn(
                      'pr-2 text-left align-top font-normal whitespace-nowrap',
                      secondaryText(look),
                    )}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={index}
                      className={cn(
                        'px-1 align-top tabular-nums whitespace-nowrap',
                        row.differs
                          ? 'text-gray-600 dark:text-zinc-100'
                          : 'text-gray-400 dark:text-zinc-500',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FoldSection>
    </div>
  )
}
