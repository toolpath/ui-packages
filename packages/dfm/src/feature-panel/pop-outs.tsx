import { useMemo, type FC, type ReactElement, type ReactNode } from 'react'
import {
  ArrowSquareOutIcon,
  BracketsCurlyIcon,
  ChartLineIcon,
  TableIcon,
} from '@phosphor-icons/react'
import { IconButton } from '@toolpath/ui'
import type { FeatureRecord } from '../model/feature-record.js'
import { readReachCurve, type FeatureProfile } from '../model/reach.js'
import type { Units } from '../model/units.js'
import { ReachDrawing } from '../reach/reach-chart.js'
import type { ResolvedLook } from './look.js'
import { CopyButton, DatasheetFields, RawRecord } from './record-sections.js'
import type { PopOutId, PopOutWindow } from './types.js'

const TITLES: Record<PopOutId, string> = {
  reach: 'Reach',
  datasheet: 'All datasheet fields',
  raw: 'Raw API record',
}

const LABELS: Record<PopOutId, string> = {
  reach: 'Pop out the reach drawing',
  datasheet: 'Pop out the datasheet fields',
  raw: 'Pop out the raw record',
}

/** The button on a section's heading that pops it out, larger, into the app's window. */
export const PopOutButton: FC<{ id: PopOutId; onOpen: (id: PopOutId) => void }> = ({
  id,
  onOpen,
}): ReactElement => (
  <IconButton
    aria-label={LABELS[id]}
    title="Pop out, larger"
    variant="muted"
    size="sm"
    onClick={() => onOpen(id)}
  >
    <ArrowSquareOutIcon weight="bold" />
  </IconButton>
)

interface PopOutsProps {
  open: ReadonlySet<PopOutId>
  onClose: (id: PopOutId) => void
  Window: PopOutWindow
  /** The feature they are of, under each window's title. */
  subtitle: ReactNode
  record: FeatureRecord | null
  units: Units
  profile: FeatureProfile
  look: ResolvedLook
}

/**
 * The sections popped out, each in the app's window: the reach as the larger
 * drawing, the datasheet fields wide, and the raw record with its copy button.
 * They follow the feature being read, and close when it has nothing to show.
 */
export const PopOuts: FC<PopOutsProps> = ({
  open,
  onClose,
  Window,
  subtitle,
  record,
  units,
  profile,
  look,
}): ReactElement | null => {
  const curve = useMemo(() => readReachCurve(record?.datasheet), [record])
  const json = useMemo(() => (record ? JSON.stringify(record, null, 2) : ''), [record])
  if (!record) return null
  return (
    <>
      {open.has('reach') && curve ? (
        <Window
          id="reach"
          title={TITLES.reach}
          subtitle={subtitle}
          icon={<ChartLineIcon weight="bold" />}
          onClose={() => onClose('reach')}
        >
          <ReachDrawing curve={curve} units={units} feature={profile} />
        </Window>
      ) : null}
      {open.has('datasheet') ? (
        <Window
          id="datasheet"
          title={TITLES.datasheet}
          subtitle={subtitle}
          icon={<TableIcon weight="bold" />}
          onClose={() => onClose('datasheet')}
        >
          <DatasheetFields record={record} look={look} wide />
        </Window>
      ) : null}
      {open.has('raw') ? (
        <Window
          id="raw"
          title={TITLES.raw}
          subtitle={subtitle}
          icon={<BracketsCurlyIcon weight="bold" />}
          action={<CopyButton text={json} />}
          onClose={() => onClose('raw')}
        >
          <RawRecord json={json} wide />
        </Window>
      ) : null}
    </>
  )
}
