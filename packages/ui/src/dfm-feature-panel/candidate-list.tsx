import type { FC, ReactElement, ReactNode } from 'react'
import { XIcon } from '@phosphor-icons/react'
import { IconButton } from '../icon-button'
import { cn } from '../common'
import { listKeys } from '../dfm-rule-list/list-keys'
import { Swatch } from '../dfm-rule-list/swatch'
import { FeatureName, RequiredBadge } from './feature-name'
import { FoldSection } from './fold-section'
import { resolveLook, secondaryText, type FeaturePanelLook, type ResolvedLook } from './look'
import {
  type CandidateRow as CandidateRowData,
  type ComparedFaceList,
  type FoldStore,
  type RuleVocabulary,
  faceLetter,
} from '@toolpath/dfm'

/**
 * Up, down, Home and End through the candidates: put them on whatever holds
 * the list — the whole panel, or just the list — as `ruleListKeys` is put on
 * the rules. Each row is chosen as it is reached.
 */
export const candidateListKeys = listKeys('candidates')

/**
 * One feature a face could have meant, as its row says it: `@toolpath/dfm`'s
 * row, and what the row renders beside it.
 */
export interface CandidateRow extends CandidateRowData {
  /** In place of the feature's type: `Blind hole ⌀ 6.35 × 4`. */
  readonly label?: ReactNode
  /** Right-aligned in the row: the folder it is in, say. */
  readonly detail?: ReactNode
  /** A second line under it: a note on how it overlaps another. */
  readonly note?: ReactNode
  /** Beside the row, outside its button: the app's own action on it. */
  readonly action?: ReactNode
}

export interface CandidateListProps {
  /** In the app's order: the first is what a click meant first. */
  rows: readonly CandidateRow[]
  selected: string | null
  onSelect: (tag: string) => void
  /** A row under the pointer, and leaving it: left out, the rows preview nothing. */
  onHover?: (tag: string | null) => void
  /** While comparing faces: this list's face. */
  face?: ComparedFaceList
  look?: FeaturePanelLook
  folds?: FoldStore
  /** How the rows' features are named: milling where left out. */
  vocabulary?: RuleVocabulary
}

/** A compared face's letter, as a chip: filled for the face being read. */
export const FaceLetter: FC<{ index: number; active: boolean }> = ({
  index,
  active,
}): ReactElement => (
  <span
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-2xs font-bold',
      active
        ? 'bg-info text-white'
        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-300',
    )}
  >
    {faceLetter(index)}
  </span>
)

/**
 * Every feature a clicked face belongs to, as rows to choose between: its
 * colour, its name and the way it is machined from, how many rules it breaks,
 * whether it is required, and whatever the app adds. The keys walk them, each
 * chosen as it is reached; see {@link candidateListKeys}.
 */
export const CandidateList: FC<CandidateListProps> = ({
  rows,
  selected,
  onSelect,
  onHover,
  face,
  look: lookOption,
  folds,
  vocabulary,
}): ReactElement => {
  const look = resolveLook(lookOption)
  const count = `Candidate features (${rows.length})`
  return (
    <div className="border-b border-gray-100 p-2 dark:border-zinc-800">
      <FoldSection
        id={face ? `candidates-${faceLetter(face.index)}` : 'candidates'}
        title={
          face ? (
            <span className="flex items-center gap-1.5">
              <FaceLetter index={face.index} active={face.active} />
              {count}
            </span>
          ) : (
            count
          )
        }
        action={
          face?.onStop ? (
            <IconButton
              aria-label={`Stop comparing face ${faceLetter(face.index)}`}
              variant="muted"
              size="sm"
              onClick={face.onStop}
            >
              <XIcon weight="bold" />
            </IconButton>
          ) : null
        }
        folds={folds}
        className="px-2"
      >
        <ul className="-mx-2 flex flex-col gap-0.5">
          {rows.map((row) => (
            <Row
              key={row.feature.tag}
              row={row}
              chosen={row.feature.tag === selected}
              onSelect={onSelect}
              onHover={onHover}
              look={look}
              vocabulary={vocabulary}
            />
          ))}
        </ul>
      </FoldSection>
    </div>
  )
}

const Row: FC<{
  row: CandidateRow
  chosen: boolean
  onSelect: (tag: string) => void
  onHover?: (tag: string | null) => void
  look: ResolvedLook
  vocabulary?: RuleVocabulary
}> = ({ row, chosen, onSelect, onHover, look, vocabulary }): ReactElement => {
  const { feature } = row
  const info = look.selected === 'info'
  return (
    <li
      className={cn(
        'flex items-center gap-1',
        info && 'rounded border pr-1',
        info && (chosen ? 'border-info/60 bg-info/15' : 'border-transparent'),
      )}
    >
      <button
        type="button"
        data-list-item="candidates"
        data-follow
        aria-pressed={chosen}
        onClick={() => onSelect(feature.tag)}
        onPointerEnter={onHover ? () => onHover(feature.tag) : undefined}
        onPointerLeave={onHover ? () => onHover(null) : undefined}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer flex-col rounded px-2 py-1.5 text-left text-sm',
          'outline-none focus-visible:ring-2 focus-visible:ring-info/75',
          'text-gray-600 dark:text-zinc-200',
          info
            ? 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'
            : 'hover:bg-gray-100 dark:hover:bg-zinc-800',
          chosen && (info ? 'font-medium' : 'bg-gray-100 font-semibold dark:bg-zinc-800'),
        )}
      >
        <span className="flex w-full items-center gap-2">
          {row.color ? (
            <Swatch color={row.color} />
          ) : (
            <span aria-hidden className="size-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">
            <FeatureName feature={feature} label={row.label} look={look} vocabulary={vocabulary} />
          </span>
          {row.ruleCount ? (
            <span className={cn('text-2xs tabular-nums', secondaryText(look))}>
              {row.ruleCount} {row.ruleCount === 1 ? 'rule' : 'rules'}
            </span>
          ) : null}
          {row.required ? <RequiredBadge /> : null}
          {row.detail ? (
            <span className={cn('max-w-32 shrink-0 truncate text-xs', secondaryText(look))}>
              {row.detail}
            </span>
          ) : null}
        </span>
        {row.note ? <span className="pl-6 text-2xs text-warning-darken">{row.note}</span> : null}
      </button>
      {row.action}
    </li>
  )
}
