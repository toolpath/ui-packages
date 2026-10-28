import { useMemo, useRef } from 'react'
import {
  bodiesByRule,
  describeRule,
  MILLING_RULES,
  type BodyDfmSummary,
  type Units,
  type RuleVocabulary,
} from '@toolpath/dfm'
import { Button } from '../button'
import { cn } from '../common'
import { HitFigure } from '../dfm-rule-list/feature-button'
import { Swatch } from '../dfm-rule-list/swatch'
import { FeaturesByBody, type BodyFeatureFocus, type BodyFeatureGroup } from './features-by-body'
import { Caret, Dot, ROW, useOnUnmount, useOpenSet } from './rows'
import { ScrollArea } from '../scroll-area'

export interface BodyDfmResultsProps {
  summary: BodyDfmSummary
  tab: 'rules' | 'features'
  units: Units
  /** How rules and features are named; milling where left out. */
  vocabulary?: RuleVocabulary
  onInspect: (bodyId: string, tag: string) => void
  /**
   * The feature pointed at in the Rules tab, null for its tag once the pointer
   * leaves it or the list unmounts.
   */
  onHover?: (bodyId: string, tag: string | null) => void
  /**
   * The rule pointed at in the Rules tab, and the body when the pointer is on
   * one of its bodies; both null once it leaves the list or the list unmounts.
   * Called as the pointer moves, so it may repeat the same value.
   */
  onHoverRule?: (ruleId: string | null, bodyId: string | null) => void
  onRetry?: (bodyId: string) => void
  /** Each body's colour on the model, by id, for the dot beside its name. */
  bodyColors?: ReadonlyMap<string, number>
  /**
   * The Features tab's groups for each body, by id: the application's own kinds
   * of feature, colours and measurements. A body with none here is grouped by
   * feature type.
   */
  featureGroups?: ReadonlyMap<string, ReadonlyArray<BodyFeatureGroup>>
  /**
   * The body, group or feature the pointer is on in the Features tab; null once
   * it leaves or the list unmounts. Called as the pointer moves, so it may
   * repeat the same value.
   */
  onHoverFeatures?: (focus: BodyFeatureFocus | null) => void
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
  featureGroups,
  onHoverFeatures,
}: BodyDfmResultsProps) => {
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
      ) : (
        <>
          {summary.features.length === 0 ? (
            <p className="px-3 text-sm text-gray-500 dark:text-zinc-400">
              {emptyMessage(summary, tab)}
            </p>
          ) : null}
          <FeaturesByBody
            summary={summary}
            featureGroups={featureGroups}
            bodyColors={bodyColors}
            vocabulary={vocabulary}
            onInspect={onInspect}
            onHoverFeatures={onHoverFeatures}
          />
        </>
      )}
    </div>
  )
}

/**
 * The Rules tab: every rule as the rule list shows it, its colour, its words
 * and how many features break it in all bodies together, dimmed where none do.
 * A rule opens into the bodies that break it, and each of those into its
 * features with what they measure.
 */
const RulesByRule = ({
  summary,
  units,
  vocabulary = MILLING_RULES,
  bodyColors,
  onInspect,
  onHover,
  onHoverRule,
}: Pick<
  BodyDfmResultsProps,
  'summary' | 'units' | 'vocabulary' | 'bodyColors' | 'onInspect' | 'onHover' | 'onHoverRule'
>) => {
  const [open, toggle] = useOpenSet()
  const bodiesOf = useMemo(() => bodiesByRule(summary), [summary])
  // The body whose feature the pointer is on, so leaving with the list can let it go.
  const hovered = useRef<string | null>(null)
  useOnUnmount(() => {
    onHoverRule?.(null, null)
    if (hovered.current !== null) {
      onHover?.(hovered.current, null)
    }
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
          const bodies = bodiesOf.get(rule.id) ?? []
          const ruleOpen = count > 0 && open.has(rule.id)
          return (
            <li
              key={rule.id}
              className={cn(count === 0 && 'opacity-55 hover:opacity-100 focus-within:opacity-100')}
            >
              <button
                type="button"
                aria-expanded={count > 0 ? ruleOpen : undefined}
                disabled={count === 0}
                className={cn(ROW, 'px-2 py-2')}
                onClick={() => toggle(rule.id)}
                onPointerMove={() => onHoverRule?.(rule.id, null)}
              >
                <Caret open={ruleOpen} className={cn(count === 0 && 'invisible')} />
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
                  {bodies.map(({ body, violations }) => {
                    const key = JSON.stringify([rule.id, body.id])
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
                          <Caret open={bodyOpen} size="size-3" />
                          {color === undefined ? null : <Dot color={color} />}
                          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-200">
                            {body.label}
                          </span>
                          <span className="text-xs text-gray-500 tabular-nums dark:text-zinc-400">
                            {violations.length}
                          </span>
                        </button>
                        {bodyOpen ? (
                          <ul aria-label={body.label} className="pb-1 pl-6">
                            {violations.map((violation) => (
                              <li key={violation.id}>
                                <button
                                  type="button"
                                  className={cn(ROW, 'items-baseline px-2 py-1 text-xs')}
                                  onClick={() => onInspect(violation.bodyId, violation.feature.tag)}
                                  onPointerEnter={() => {
                                    hovered.current = violation.bodyId
                                    onHover?.(violation.bodyId, violation.feature.tag)
                                  }}
                                  onPointerLeave={() => {
                                    hovered.current = null
                                    onHover?.(violation.bodyId, null)
                                  }}
                                  onPointerMove={() => onHoverRule?.(rule.id, body.id)}
                                >
                                  <span className="font-medium text-gray-700 dark:text-zinc-200">
                                    {vocabulary.featureLabel(violation.feature).name}{' '}
                                    {violation.feature.number}
                                  </span>
                                  <HitFigure hit={violation.hit ?? undefined} units={units} />
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
