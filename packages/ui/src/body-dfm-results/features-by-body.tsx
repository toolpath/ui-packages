import { useState, type ReactElement } from 'react'
import { CaretRightIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react'
import { CRITICAL_COLOR, featureTypeLabel, type BodyDfmSummary } from '@toolpath/dfm'
import { cn } from '../common'
import { ScrollArea } from '../scroll-area'
import { SeverityIcon, type FeatureSeverity } from './severity-icon'

/** One feature as the Features tab lists it. */
export interface BodyFeatureRow {
  /** What a click opens and the pointer lights. */
  tag: string
  /** `Blind hole 12`. */
  label: string
  /** What it measures, as short phrases: `⌀ 6 mm`, `depth 12 mm`. */
  facts?: ReadonlyArray<string>
  severity?: FeatureSeverity | null
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

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

const ROW = cn(
  'flex w-full cursor-pointer items-center gap-2 rounded text-left outline-none',
  'hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-info/75 dark:hover:bg-zinc-800',
  'disabled:cursor-default',
)

const Caret = ({ open, size = 'size-3.5' }: { open: boolean; size?: string }) => (
  <CaretRightIcon
    aria-hidden
    weight="bold"
    className={cn(
      size,
      'shrink-0 text-gray-300 transition-transform duration-150 dark:text-zinc-500',
      open && 'rotate-90',
    )}
  />
)

/** A body's colour, round, or a group's, square; outlined where the group paints nothing. */
const Dot = ({ color, square = false }: { color: number | null | undefined; square?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      'inline-block size-2.5 shrink-0',
      square ? 'rounded-sm' : 'rounded-full',
      color == null && 'border border-gray-400',
    )}
    style={color == null ? undefined : { backgroundColor: hex(color) }}
  />
)

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
        </span>
      ) : null}
      {warning > 0 ? (
        <span
          className="flex items-center gap-0.5 text-warning tabular-nums"
          title={`${warning} breaking a rule`}
        >
          <InfoIcon aria-hidden weight="fill" className="size-3.5" />
          {warning}
        </span>
      ) : null}
    </>
  )
}

/**
 * A body's features by type, where the application gives no groups of its
 * own: each type one group, each feature marked by the rules it breaks, as
 * the Rules tab counts them.
 */
const groupsByType = (summary: BodyDfmSummary, bodyId: string): Array<BodyFeatureGroup> => {
  const body = summary.bodies.find((entry) => entry.id === bodyId)
  const severities = new Map<string, FeatureSeverity>()
  for (const violation of summary.violations) {
    if (violation.bodyId !== bodyId) continue
    const critical = violation.rule.color === CRITICAL_COLOR
    if (critical || !severities.has(violation.feature.tag))
      severities.set(violation.feature.tag, critical ? 'critical' : 'warning')
  }
  const groups = new Map<string, BodyFeatureGroup & { rows: Array<BodyFeatureRow> }>()
  for (const feature of body?.features ?? []) {
    const label = featureTypeLabel(feature.featureType)
    const group = groups.get(feature.featureType) ?? {
      key: feature.featureType,
      label,
      color: null,
      rows: [],
    }
    group.rows.push({
      tag: feature.tag,
      label: `${label} ${feature.number}`,
      severity: severities.get(feature.tag) ?? null,
    })
    groups.set(feature.featureType, group)
  }
  return [...groups.values()]
}

export interface FeaturesByBodyProps {
  summary: BodyDfmSummary
  /** Each body's groups, by id; by feature type where a body has none here. */
  featureGroups?: ReadonlyMap<string, ReadonlyArray<BodyFeatureGroup>>
  bodyColors?: ReadonlyMap<string, number>
  onInspect: (bodyId: string, tag: string) => void
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
  onInspect,
  onHoverFeatures,
}: FeaturesByBodyProps): ReactElement => {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setOpen((old) => {
      const next = new Set(old)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul
        aria-label="Features by body"
        className="px-1 pb-2"
        onPointerLeave={() => onHoverFeatures?.(null)}
      >
        {summary.bodies.map((body) => {
          const groups = (featureGroups?.get(body.id) ?? groupsByType(summary, body.id)).filter(
            (group) => group.rows.length > 0,
          )
          const ready = body.status === 'ready'
          const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
          const expanded = open.has(body.id)
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
                    const key = `${body.id}:${group.key}`
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
