import { useState } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import {
  featureTypeLabel,
  hitFigure,
  describeRule,
  type BodyDfmSummary,
  type BodyDfmFeature,
  type DfmRule,
  type Units,
  type RuleVocabulary,
} from '@toolpath/dfm'
import { Button } from '../button'
import { cn } from '../common'
import { Swatch } from '../dfm-rule-list'
import { Table } from '../table'
import { ScrollArea } from '../scroll-area'

export interface BodyDfmResultsProps {
  summary: BodyDfmSummary
  tab: 'rules' | 'features'
  units: Units
  vocabulary?: RuleVocabulary
  onInspect: (bodyId: string, tag: string) => void
  onHover?: (bodyId: string, tag: string | null) => void
  /**
   * The rule pointed at in the Rules tab, and the body when the pointer is on
   * one of its bodies; both null once it leaves the list.
   */
  onHoverRule?: (ruleId: string | null, bodyId: string | null) => void
  onRetry?: (bodyId: string) => void
  /** Each body's colour on the model, by id, for the dot beside its name. */
  bodyColors?: ReadonlyMap<string, number>
}

/** A failed body never finishes, so only a pending one is worth waiting for. */
const emptyMessage = (summary: BodyDfmSummary, tab: BodyDfmResultsProps['tab']): string => {
  if (summary.completed + summary.failed < summary.total) {
    return 'Results appear as bodies finish analysis.'
  }
  if (summary.failed > 0 && summary.completed === 0) {
    return 'No bodies could be checked.'
  }
  const none = tab === 'rules' ? 'No rule violations' : 'No features found'
  return summary.failed > 0 ? `${none} in the checked bodies.` : `${none}.`
}

/** Combined results retain the body's identity; selection never hides other bodies. */
export const BodyDfmResults = ({
  summary,
  tab,
  units,
  vocabulary,
  onInspect,
  onHover,
  onHoverRule,
  onRetry,
  bodyColors,
}: BodyDfmResultsProps) => {
  const rows: Array<BodyDfmFeature> = summary.features
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <p role="status" className="shrink-0 px-3 text-xs text-gray-500 dark:text-zinc-400">
        {summary.completed} of {summary.total} bodies checked
        {summary.failed ? ` · ${summary.failed} failed` : ''}
      </p>
      {summary.completed < summary.total ? (
        <ScrollArea className="max-h-24 flex-none [&_[data-viewport]]:max-h-24">
          {summary.bodies
            .filter((body) => body.status === 'pending')
            .map((body) => (
              <p key={body.id} className="shrink-0 px-3 text-xs text-gray-500 dark:text-zinc-400">
                {body.label}:{' '}
                {body.progress == null
                  ? 'Pending analysis'
                  : `Checking ${Math.round(body.progress)}%`}
              </p>
            ))}
          {summary.bodies
            .filter((body) => body.status === 'error')
            .map((body) => (
              <div
                key={body.id}
                className="flex shrink-0 items-center gap-2 px-3 text-xs text-danger"
              >
                <span className="flex-1">
                  {body.label}: {body.error ?? 'Analysis failed'}
                </span>
                {onRetry ? (
                  <Button size="sm" variant="secondary" onClick={() => onRetry(body.id)}>
                    Retry {body.label}
                  </Button>
                ) : null}
              </div>
            ))}
        </ScrollArea>
      ) : null}
      {tab === 'rules' ? (
        <>
          {summary.violations.length === 0 ? (
            <p className="px-3 text-sm text-gray-500 dark:text-zinc-400">
              {emptyMessage(summary, tab)}
            </p>
          ) : null}
          <RulesByRule
            summary={summary}
            units={units}
            vocabulary={vocabulary}
            bodyColors={bodyColors}
            onInspect={onInspect}
            onHover={onHover}
            onHoverRule={onHoverRule}
          />
        </>
      ) : rows.length > 0 ? (
        <Table
          data={rows}
          virtualized={false}
          scrollable
          header={
            <Table.HeaderRow>
              <Table.HeaderCell>Body</Table.HeaderCell>
              <Table.HeaderCell>Feature</Table.HeaderCell>
            </Table.HeaderRow>
          }
        >
          {(row) => (
            <Table.Row
              onMouseEnter={() => onHover?.(row.bodyId, row.feature.tag)}
              onMouseLeave={() => onHover?.(row.bodyId, null)}
            >
              <Table.Cell>{row.bodyLabel}</Table.Cell>
              <Table.Cell>
                <Button
                  size="sm"
                  variant="muted"
                  onClick={() => onInspect(row.bodyId, row.feature.tag)}
                >
                  {featureTypeLabel(row.feature.featureType)} {row.feature.number}
                </Button>
              </Table.Cell>
            </Table.Row>
          )}
        </Table>
      ) : (
        <p className="px-3 text-sm text-gray-500 dark:text-zinc-400">
          {emptyMessage(summary, tab)}
        </p>
      )}
    </div>
  )
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

const ROW = cn(
  'flex w-full cursor-pointer items-center gap-2 rounded text-left outline-none',
  'hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-info/75 dark:hover:bg-zinc-800',
)

/**
 * The Rules tab: every rule as the rule list shows it, its colour, its words
 * and how many features break it in all bodies together, dimmed where none do.
 * A rule opens into the bodies that break it, and each of those into its
 * features with what they measure.
 */
const RulesByRule = ({
  summary,
  units,
  vocabulary,
  bodyColors,
  onInspect,
  onHover,
  onHoverRule,
}: Pick<
  BodyDfmResultsProps,
  'summary' | 'units' | 'vocabulary' | 'bodyColors' | 'onInspect' | 'onHover' | 'onHoverRule'
>) => {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setOpen((old) => {
      const next = new Set(old)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const byBody = (rule: DfmRule) =>
    summary.bodies.flatMap((body) => {
      const hits = summary.violations.filter(
        (violation) => violation.rule.id === rule.id && violation.bodyId === body.id,
      )
      return hits.length > 0 ? [{ body, hits }] : []
    })
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul
        aria-label="Rules"
        className="px-1 pb-2"
        onPointerLeave={() => {
          onHoverRule?.(null, null)
        }}
      >
        {summary.byRule.map(({ rule, count }) => {
          const ruleOpen = open.has(rule.id)
          const bodies = byBody(rule)
          return (
            <li
              key={rule.id}
              className={cn(count === 0 && 'opacity-55 hover:opacity-100 focus-within:opacity-100')}
            >
              <button
                type="button"
                aria-expanded={count > 0 ? ruleOpen : undefined}
                disabled={count === 0}
                className={cn(ROW, 'px-2 py-2 disabled:cursor-default')}
                onClick={() => toggle(rule.id)}
                onPointerMove={() => onHoverRule?.(rule.id, null)}
              >
                <CaretRightIcon
                  aria-hidden
                  weight="bold"
                  className={cn(
                    'size-3.5 shrink-0 text-gray-300 transition-transform duration-150 dark:text-zinc-500',
                    ruleOpen && 'rotate-90',
                    count === 0 && 'invisible',
                  )}
                />
                <Swatch color={rule.color} />
                <span className="min-w-0 flex-1 text-sm text-gray-700 dark:text-zinc-200">
                  {describeRule(rule, units, vocabulary)}
                </span>
                {count > 0 ? (
                  <span className="shrink-0 text-xs text-gray-500 dark:text-zinc-400">
                    in {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}
                  </span>
                ) : null}
                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 text-2xs font-semibold text-gray-500 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                  {count}
                </span>
              </button>
              {ruleOpen ? (
                <ul aria-label={describeRule(rule, units, vocabulary)} className="pb-1 pl-6">
                  {bodies.map(({ body, hits }) => {
                    const key = `${rule.id}:${body.id}`
                    const bodyOpen = open.has(key)
                    const color = bodyColors?.get(body.id)
                    return (
                      <li key={body.id}>
                        <button
                          type="button"
                          aria-expanded={bodyOpen}
                          className={cn(ROW, 'px-2 py-1.5 text-sm')}
                          onClick={() => toggle(key)}
                          onPointerMove={() => onHoverRule?.(rule.id, body.id)}
                        >
                          <CaretRightIcon
                            aria-hidden
                            weight="bold"
                            className={cn(
                              'size-3 shrink-0 text-gray-300 transition-transform duration-150 dark:text-zinc-500',
                              bodyOpen && 'rotate-90',
                            )}
                          />
                          {color === undefined ? null : (
                            <span
                              aria-hidden
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: hex(color) }}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-200">
                            {body.label}
                          </span>
                          <span className="text-xs text-gray-500 tabular-nums dark:text-zinc-400">
                            {hits.length}
                          </span>
                        </button>
                        {bodyOpen ? (
                          <ul aria-label={body.label} className="pb-1 pl-6">
                            {hits.map((hit) => (
                              <li key={hit.id}>
                                <button
                                  type="button"
                                  className={cn(ROW, 'items-baseline px-2 py-1 text-xs')}
                                  onClick={() => onInspect(hit.bodyId, hit.feature.tag)}
                                  onPointerEnter={() => onHover?.(hit.bodyId, hit.feature.tag)}
                                  onPointerLeave={() => onHover?.(hit.bodyId, null)}
                                  onPointerMove={() => onHoverRule?.(rule.id, body.id)}
                                >
                                  <span className="font-medium text-gray-700 dark:text-zinc-200">
                                    {featureTypeLabel(hit.feature.featureType)} {hit.feature.number}
                                  </span>
                                  {hit.hit ? (
                                    <span className="text-gray-500 tabular-nums dark:text-zinc-400">
                                      {hitFigure(hit.hit, units)}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}
