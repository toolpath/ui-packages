import { useMemo, type FC, type ReactElement, type ReactNode } from 'react'
import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { IconButton, cn } from '@toolpath/ui'
import {
  datasheetFields,
  MAX_DATASHEET_FIELDS,
  type FeatureRecord,
} from '../model/feature-record.js'
import { useTimedValue } from '../rule-list/use-timed-value.js'
import { FoldSection } from './fold-section.js'
import type { FoldStore } from './fold-store.js'
import { secondaryText, type ResolvedLook } from './look.js'
import { ReadFailure, Reading } from './read-state.js'
import type { Loadable } from './types.js'

/** How long "Copied" stands in for the copy button, ms. */
const COPIED_MS = 1500

interface RecordSectionsProps {
  record: Loadable<FeatureRecord | null>
  look: ResolvedLook
  folds?: FoldStore
  /** Beside each section's heading: the button that pops it out, where the app gives a window. */
  popOut?: (section: 'datasheet' | 'raw') => ReactNode
}

/**
 * Everything the API said about a feature, for a reader who wants more than
 * the summary: every field of its datasheet, and the raw record — its report
 * entry and its datasheet — to read or copy. Both start shut. Their headings
 * show while the record is read; with no record there are none.
 */
export const RecordSections: FC<RecordSectionsProps> = ({
  record,
  look,
  folds,
  popOut,
}): ReactElement | null => {
  const value = record.status === 'ready' ? record.value : null
  const { fields, more } = useMemo(() => datasheetFields(value?.datasheet), [value])
  const json = useMemo(() => (value ? JSON.stringify(value, null, 2) : ''), [value])
  if (record.status === 'ready' && !value) return null
  const waiting =
    record.status === 'loading' ? (
      <Reading>Reading the feature’s record…</Reading>
    ) : record.status === 'error' ? (
      <ReadFailure failure={record} />
    ) : null
  const count = more ? `${MAX_DATASHEET_FIELDS}+` : String(fields.length)
  return (
    <>
      <FoldSection
        id="datasheet"
        defaultOpen={false}
        title={value ? `All datasheet fields (${count})` : 'All datasheet fields'}
        action={value ? popOut?.('datasheet') : null}
        folds={folds}
      >
        {waiting ?? <DatasheetFields record={value} look={look} />}
      </FoldSection>
      <FoldSection
        id="raw"
        defaultOpen={false}
        title="Raw API record"
        action={
          value ? (
            <>
              <CopyButton text={json} />
              {popOut?.('raw')}
            </>
          ) : null
        }
        folds={folds}
      >
        {waiting ?? <RawRecord json={json} />}
      </FoldSection>
    </>
  )
}

/**
 * Every leaf of a datasheet by its path, as sent: millimetres and degrees,
 * whatever units the panel reads in. `wide` for a window of its own.
 */
export const DatasheetFields: FC<{
  record: FeatureRecord | null
  look: ResolvedLook
  wide?: boolean
}> = ({ record, look, wide = false }): ReactElement => {
  const { fields } = useMemo(() => datasheetFields(record?.datasheet), [record])
  return record?.datasheet ? (
    <dl
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] gap-y-0.5 text-xs',
        wide ? 'gap-x-4 p-4' : 'gap-x-3',
      )}
    >
      {fields.map((field) => (
        <div key={field.path} className="contents">
          <dt className={cn('truncate font-mono', secondaryText(look))} title={field.path}>
            {field.path}
          </dt>
          <dd
            className={cn(
              'truncate text-right font-mono text-gray-600 tabular-nums select-text dark:text-zinc-100',
              wide ? 'max-w-60' : 'max-w-40',
            )}
            title={field.value}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className={cn('text-sm', secondaryText(look), wide && 'p-4')}>
      The API sent no datasheet for this feature.
    </p>
  )
}

/** The raw record as JSON, to read or select. `wide` for a window of its own. */
export const RawRecord: FC<{ json: string; wide?: boolean }> = ({
  json,
  wide = false,
}): ReactElement => (
  <pre
    className={cn(
      'font-mono text-2xs leading-relaxed text-gray-600 select-text dark:text-zinc-200',
      wide ? 'p-4' : 'max-h-80 overflow-auto rounded bg-gray-50 p-2 dark:bg-zinc-800/60',
    )}
  >
    {json}
  </pre>
)

/** Copies the raw record, and says so for a moment. */
export const CopyButton: FC<{ text: string }> = ({ text }): ReactElement => {
  const [copied, setCopied] = useTimedValue<true>(COPIED_MS)
  return (
    <IconButton
      aria-label={copied ? 'Copied' : 'Copy raw record'}
      title="Copy"
      variant="muted"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true))
      }}
    >
      {copied ? <CheckIcon weight="bold" /> : <CopyIcon weight="bold" />}
    </IconButton>
  )
}
