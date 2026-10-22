import { useMemo, type FC, type ReactElement, type ReactNode } from 'react'
import { cn } from '../common'
import { type ComparedFace, comparisonRows, type FoldStore } from '@toolpath/dfm'
import { Swatch } from '../dfm-rule-list/swatch'
import { FaceLetter } from './candidate-list'
import { FeatureName } from './feature-name'
import { FoldSection } from './fold-section'
import { resolveLook, secondaryText, type FeaturePanelLook } from './look'

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
  const rows = useMemo(() => comparisonRows(faces), [faces])

  /** A cell as the rows read it, with what only this table draws: swatches and the other unit. */
  const cell = (key: string, text: string, index: number): ReactNode => {
    const face = faces[index]
    if (!face?.feature) return text
    if (key === 'direction') {
      return (
        <span className="inline-flex items-center gap-1">
          <Swatch color={face.directionColor} className="size-2.5" />
          {text}
        </span>
      )
    }
    if (key === 'rules' && face.rules.length > 0) {
      return (
        <span
          className="inline-flex items-center gap-0.5"
          title={face.rules.map((rule) => rule.text).join('\n')}
        >
          {face.rules.map((rule) => (
            <Swatch key={rule.key} color={rule.color} className="size-2.5" />
          ))}
          <span className="ml-0.5">{text}</span>
        </span>
      )
    }
    const measured = face.measurements.find((each) => each.key === key)
    return measured ? <span title={measured.alt}>{text}</span> : text
  }

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
                  {row.texts.map((text, index) => (
                    <td
                      key={index}
                      className={cn(
                        'px-1 align-top tabular-nums whitespace-nowrap',
                        row.differs
                          ? 'text-gray-600 dark:text-zinc-100'
                          : 'text-gray-400 dark:text-zinc-500',
                      )}
                    >
                      {cell(row.key, text, index)}
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
