import type { FC, HTMLAttributes, ReactElement, ReactNode } from 'react'
import { CubeIcon, XIcon } from '@phosphor-icons/react'
import { IconButton, ScrollArea, cn } from '@toolpath/ui'
import { CandidateList, candidateListKeys, type CandidateRow } from './candidate-list.js'
import { ComparisonTable, type ComparedFace } from './comparison-table.js'
import type { FoldStore } from './fold-store.js'
import { resolveLook, secondaryText, type FeaturePanelLook } from './look.js'

/** One face being inspected: the features it could mean, and the one being read. */
export interface InspectedFace {
  /** The face clicked; null for a feature chosen from a list, which has no candidates to show. */
  readonly region: number | null
  /** In the app's order: see `CandidateList`. */
  readonly rows: readonly CandidateRow[]
  readonly selected: string | null
}

export interface FeaturePanelProps {
  /** One face, or several while comparing. */
  faces: readonly InspectedFace[]
  /** Which face's feature the details are of. */
  active: number
  /** A group of identical holes chosen together: how many, for the title. */
  group?: number
  /** What each compared face was read as: the comparison table, while comparing. */
  comparison?: readonly ComparedFace[]
  onSelect: (tag: string, face: number) => void
  /** Takes a face out of the comparison. */
  onDropFace?: (face: number) => void
  onHover?: (tag: string | null) => void
  onClose: () => void
  /** Spread on the header: an app's drag handle, say. */
  headerProps?: HTMLAttributes<HTMLElement>
  className?: string
  look?: FeaturePanelLook
  folds?: FoldStore
  /** The active face's feature: its `<FeatureDetails>`. */
  children?: ReactNode
}

const title = (faces: readonly InspectedFace[], active: number, group?: number): string => {
  if (faces.length > 1) return `Comparing ${faces.length} faces`
  if (faces[active]?.region !== null && faces[active]?.region !== undefined)
    return 'Features on this face'
  if (group !== undefined) return `${group} identical holes`
  return 'Feature'
}

/**
 * The feature panel as a card: what a click on the part found — every feature
 * the face belongs to, then the details of the one being read — or, with
 * several faces shift-clicked, each face's candidates under a letter and a
 * comparison of what each was read as.
 *
 * It fills what it is put in: where the card sits, and whether it moves, is
 * the app's. Escape calls `onClose`, and the arrow keys walk the candidates
 * from anywhere in it.
 */
export const FeaturePanel: FC<FeaturePanelProps> = ({
  faces,
  active,
  group,
  comparison,
  onSelect,
  onDropFace,
  onHover,
  onClose,
  headerProps,
  className,
  look: lookOption,
  folds,
  children,
}): ReactElement => {
  const look = resolveLook(lookOption)
  const comparing = faces.length > 1
  const face = faces[active]
  const heading = title(faces, active, group)
  return (
    <section
      aria-label={heading}
      data-list-root
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
        else candidateListKeys(event)
      }}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded bg-white/90 shadow-lg ring-1 ring-gray-200/70 backdrop-blur-md',
        'dark:bg-zinc-900/90 dark:ring-zinc-800',
        className,
      )}
    >
      <header
        {...headerProps}
        className={cn(
          'flex items-center gap-2 border-b border-gray-100 py-2 pr-2 pl-4 select-none dark:border-zinc-800',
          headerProps?.className,
        )}
      >
        <CubeIcon weight="bold" className={cn('size-5 shrink-0', secondaryText(look))} />
        <h2 className="flex-1 text-sm font-semibold text-gray-600 dark:text-zinc-100">{heading}</h2>
        <IconButton aria-label="Close" variant="muted" onClick={onClose}>
          <XIcon weight="bold" />
        </IconButton>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {comparing ? (
          <>
            {faces.map((each, index) => (
              <CandidateList
                key={`${each.region ?? 'list'}-${index}`}
                rows={each.rows}
                selected={each.selected}
                onSelect={(tag) => onSelect(tag, index)}
                onHover={onHover}
                face={{
                  index,
                  active: index === active,
                  ...(onDropFace ? { onStop: () => onDropFace(index) } : {}),
                }}
                look={lookOption}
                folds={folds}
              />
            ))}
            {comparison ? (
              <ComparisonTable
                faces={comparison}
                active={active}
                onSelect={onSelect}
                onHover={onHover}
                look={lookOption}
                folds={folds}
              />
            ) : null}
          </>
        ) : face && face.region !== null ? (
          <CandidateList
            rows={face.rows}
            selected={face.selected}
            onSelect={(tag) => onSelect(tag, active)}
            onHover={onHover}
            look={lookOption}
            folds={folds}
          />
        ) : null}
        {face?.selected ? (
          children
        ) : (
          <p className={cn('px-4 py-3 text-sm', secondaryText(look))}>No feature owns this face.</p>
        )}
      </ScrollArea>
    </section>
  )
}
