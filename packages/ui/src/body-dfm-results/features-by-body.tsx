import type { ReactElement } from 'react'
import { InfoIcon, WarningIcon } from '@phosphor-icons/react'
import {
  featureSeverities,
  featuresByType,
  MILLING_RULES,
  type BodyDfmCheck,
  type BodyDfmSummary,
  type DfmSeverity,
  type RuleVocabulary,
} from '@toolpath/dfm'
import { cn } from '../common'
import { ScrollArea } from '../scroll-area'
import { Caret, Dot, ROW, useOnUnmount, useOpenSet } from './rows'
import { SeverityIcon } from './severity-icon'

/** One feature as the Features tab lists it. */
export interface BodyFeatureRow {
  /** What a click opens and the pointer lights. */
  tag: string
  /** `Blind hole 12`. */
  label: string
  /** What it measures, as short phrases: `⌀ 6 mm`, `depth 12 mm`. */
  facts?: ReadonlyArray<string>
  severity?: DfmSeverity | null
}

/** A kind of feature on one body: `Holes`, in its colour on the model. */
export interface BodyFeatureGroup {
  key: string
  label: string
  /** `0xrrggbb`, or null for a group the model does not colour. */
  color: number | null
  rows: ReadonlyArray<BodyFeatureRow>
}

/** What the pointer is on: a body, one of its groups, or one of its features. */
export interface BodyFeatureFocus {
  bodyId: string
  group: string | null
  tag: string | null
}

/** How many of `rows` break a rule, by severity, so a closed body or group says where its problems are. */
const Flags = ({ rows }: { rows: ReadonlyArray<BodyFeatureRow> }) => {
  const critical = rows.filter((row) => row.severity === 'critical').length
  const warning = rows.filter((row) => row.severity === 'warning').length
  return (
    <>
      {critical > 0 ? (
        <span
          className="flex items-center gap-0.5 text-danger tabular-nums"
          title={`${critical} breaking a critical rule`}
        >
          <WarningIcon aria-hidden weight="fill" className="size-3.5" />
          {critical}
          <span className="sr-only"> breaking a critical rule</span>
        </span>
      ) : null}
      {warning > 0 ? (
        <span
          className="flex items-center gap-0.5 text-warning-darken tabular-nums dark:text-warning"
          title={`${warning} breaking a rule`}
        >
          <InfoIcon aria-hidden weight="fill" className="size-3.5" />
          {warning}
          <span className="sr-only"> breaking a rule</span>
        </span>
      ) : null}
    </>
  )
}

/**
 * A ready body's features by type, where the application gives no groups of
 * its own: each type one group, each feature marked by the rules it breaks, as
 * the Rules tab counts them. A body that is not ready has none.
 */
const groupsByType = (body: BodyDfmCheck, vocabulary: RuleVocabulary): Array<BodyFeatureGroup> => {
  if (body.status !== 'ready') {
    return []
  }
  const severities = body.check ? featureSeverities(body.check) : new Map<string, DfmSeverity>()
  return featuresByType(body.features).map(({ featureType, features }) => {
    const label = vocabulary.featureLabel(features[0]!).name
    return {
      key: featureType,
      label,
      color: null,
      rows: features.map((feature) => ({
        tag: feature.tag,
        label: `${vocabulary.featureLabel(feature).name} ${feature.number}`,
        severity: severities.get(feature.tag.toLowerCase()) ?? null,
      })),
    }
  })
}

export interface FeaturesByBodyProps {
  summary: BodyDfmSummary
  /** Each body's groups, by id; by feature type where a body has none here. */
  featureGroups?: ReadonlyMap<string, ReadonlyArray<BodyFeatureGroup>>
  bodyColors?: ReadonlyMap<string, number>
  /** How a feature is named; milling where left out. */
  vocabulary?: RuleVocabulary
  onInspect: (bodyId: string, tag: string) => void
  /**
   * The body, group or feature the pointer is on; null once it leaves or the
   * list unmounts. Called as the pointer moves, so it may repeat a value.
   */
  onHoverFeatures?: (focus: BodyFeatureFocus | null) => void
}

/**
 * The Features tab: each body with how many features of each kind it has and
 * how many break a rule, opening into its groups and those into its features,
 * each marked where it breaks a rule.
 */
export const FeaturesByBody = ({
  summary,
  featureGroups,
  bodyColors,
  vocabulary = MILLING_RULES,
  onInspect,
  onHoverFeatures,
}: FeaturesByBodyProps): ReactElement => {
  const [open, toggle] = useOpenSet()
  useOnUnmount(() => onHoverFeatures?.(null))
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul
        aria-label="Features by body"
        className="px-1 pb-2"
        onPointerLeave={() => onHoverFeatures?.(null)}
      >
        {summary.bodies.map((body) => {
          const ready = body.status === 'ready'
          const groups = ready
            ? (featureGroups?.get(body.id) ?? groupsByType(body, vocabulary)).filter(
                (group) => group.rows.length > 0,
              )
            : []
          const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
          const expanded = ready && open.has(body.id)
          return (
            <li
              key={body.id}
              className="border-b border-gray-100 last:border-0 dark:border-zinc-800"
            >
              <button
                type="button"
                aria-expanded={ready ? expanded : undefined}
                disabled={!ready}
                className={cn(ROW, 'px-2 py-2')}
                onClick={() => toggle(body.id)}
                onPointerMove={() => onHoverFeatures?.({ bodyId: body.id, group: null, tag: null })}
              >
                <Caret open={expanded} />
                <Dot color={bodyColors?.get(body.id)} />
                {/* The name and total, then what it holds and what breaks a rule, so the name has the width. */}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-zinc-200">
                      {body.label}
                    </span>
                    <span className="shrink-0 text-xs text-gray-600 dark:text-zinc-300">
                      {ready
                        ? `${total} ${total === 1 ? 'feature' : 'features'}`
                        : body.status === 'error'
                          ? 'Check failed'
                          : 'Checking…'}
                    </span>
                  </span>
                  {ready ? (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600 dark:text-zinc-300">
                      <Flags rows={groups.flatMap((group) => group.rows)} />
                      {groups
                        .filter((group) => group.color !== null)
                        .map((group) => (
                          <span
                            key={group.key}
                            className="flex items-center gap-1"
                            title={group.label}
                          >
                            <Dot color={group.color} square />
                            {group.rows.length}
                          </span>
                        ))}
                    </span>
                  ) : null}
                </span>
              </button>
              {expanded
                ? groups.map((group) => {
                    const key = JSON.stringify([body.id, group.key])
                    const groupOpen = open.has(key)
                    return (
                      <div key={key} className="pl-5">
                        <button
                          type="button"
                          aria-expanded={groupOpen}
                          className={cn(ROW, 'px-2 py-1.5 text-sm')}
                          onClick={() => toggle(key)}
                          onPointerMove={() =>
                            onHoverFeatures?.({ bodyId: body.id, group: group.key, tag: null })
                          }
                        >
                          <Caret open={groupOpen} size="size-3" />
                          <Dot color={group.color} square />
                          <span className="flex-1 text-gray-700 dark:text-zinc-200">
                            {group.label}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                            <Flags rows={group.rows} />
                            {group.rows.length}
                          </span>
                        </button>
                        {groupOpen ? (
                          <ul aria-label={group.label} className="pb-1 pl-7">
                            {group.rows.map((row) => (
                              <li key={row.tag}>
                                <button
                                  type="button"
                                  className={cn(ROW, 'items-baseline px-2 py-1 text-xs')}
                                  onClick={() => onInspect(body.id, row.tag)}
                                  onPointerMove={() =>
                                    onHoverFeatures?.({
                                      bodyId: body.id,
                                      group: group.key,
                                      tag: row.tag,
                                    })
                                  }
                                >
                                  <span className="flex w-3.5 shrink-0 self-center [&_svg]:size-3.5">
                                    <SeverityIcon severity={row.severity} />
                                  </span>
                                  <span className="font-medium text-gray-700 dark:text-zinc-200">
                                    {row.label}
                                  </span>
                                  {row.facts?.length ? (
                                    <span className="truncate text-gray-500 dark:text-zinc-400">
                                      {row.facts.slice(0, 3).join(' · ')}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })
                : null}
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}
