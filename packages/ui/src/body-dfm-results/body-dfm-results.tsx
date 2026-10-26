import {
  featureTypeLabel,
  hitFigure,
  describeRule,
  type BodyDfmSummary,
  type BodyDfmFeature,
  type BodyDfmViolation,
  type Units,
  type RuleVocabulary,
} from '@toolpath/dfm'
import { Button } from '../button'
import { Table } from '../table'
import { Tooltip } from '../tooltip'

export interface BodyDfmResultsProps {
  summary: BodyDfmSummary
  tab: 'rules' | 'features'
  units: Units
  vocabulary?: RuleVocabulary
  onInspect: (bodyId: string, tag: string) => void
  onHover?: (bodyId: string, tag: string | null) => void
  onRetry?: (bodyId: string) => void
}

/** Combined results retain the body's identity; selection never hides other bodies. */
export const BodyDfmResults = ({
  summary,
  tab,
  units,
  vocabulary,
  onInspect,
  onHover,
  onRetry,
}: BodyDfmResultsProps) => {
  const rows: Array<BodyDfmFeature | BodyDfmViolation> =
    tab === 'rules' ? summary.violations : summary.features
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <p role="status" className="shrink-0 px-3 text-xs text-gray-500 dark:text-zinc-400">
        {summary.completed} of {summary.total} bodies checked
        {summary.failed ? ` · ${summary.failed} failed` : ''}
      </p>
      {summary.bodies
        .filter((body) => body.status === 'error')
        .map((body) => (
          <div key={body.id} className="flex shrink-0 items-center gap-2 px-3 text-xs text-danger">
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
      {rows.length > 0 ? (
        <Table
          data={rows}
          virtualized={false}
          scrollable
          header={
            tab === 'rules' ? (
              <Table.HeaderRow>
                <Table.HeaderCell>Body</Table.HeaderCell>
                <Table.HeaderCell>Feature</Table.HeaderCell>
                <Table.HeaderCell>Rule / value</Table.HeaderCell>
              </Table.HeaderRow>
            ) : (
              <Table.HeaderRow>
                <Table.HeaderCell>Body</Table.HeaderCell>
                <Table.HeaderCell>Feature</Table.HeaderCell>
              </Table.HeaderRow>
            )
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
              {tab === 'rules' ? (
                <Table.Cell>
                  {'rule' in row ? (
                    <Tooltip
                      tip={`${describeRule(row.rule, units, vocabulary)} · ${row.hit ? hitFigure(row.hit, units) : ''}`}
                    >
                      <span className="truncate">
                        {describeRule(row.rule, units, vocabulary)}
                        {' · '}
                        {row.hit ? hitFigure(row.hit, units) : ''}
                      </span>
                    </Tooltip>
                  ) : null}
                </Table.Cell>
              ) : null}
            </Table.Row>
          )}
        </Table>
      ) : (
        <p className="px-3 text-sm text-gray-500 dark:text-zinc-400">
          {summary.completed === summary.total
            ? tab === 'rules'
              ? 'No rule violations.'
              : 'No features found.'
            : 'Results appear as bodies finish analysis.'}
        </p>
      )}
    </div>
  )
}
