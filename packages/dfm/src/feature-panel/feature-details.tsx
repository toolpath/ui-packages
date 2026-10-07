import { useCallback, useMemo, useState, type FC, type ReactElement, type ReactNode } from 'react'
import { CrosshairIcon, InfoIcon } from '@phosphor-icons/react'
import { Button, Tooltip, cn } from '@toolpath/ui'
import type { BrokenRule } from '../model/broken-rules.js'
import type { Measurement } from '../model/feature-details.js'
import type { FeatureRecord } from '../model/feature-record.js'
import { readReachCurve, type FeatureProfile } from '../model/reach.js'
import type { Units } from '../model/units.js'
import { ReachChart } from '../reach/reach-chart.js'
import { directionLabel } from '../rule-list/direction-label.js'
import { Swatch } from '../rule-list/swatch.js'
import { FeatureName, RequiredBadge } from './feature-name.js'
import { FoldSection } from './fold-section.js'
import type { FoldStore } from './fold-store.js'
import {
  faintText,
  resolveLook,
  secondaryText,
  type FeaturePanelLook,
  type ResolvedLook,
} from './look.js'
import { ReadFailure, Reading } from './read-state.js'
import { PopOutButton, PopOuts } from './pop-outs.js'
import { RecordSections } from './record-sections.js'
import type { FeatureIdentity, Loadable, PopOutId, PopOutWindow } from './types.js'

/** Whether the widest tool is drawn on the part, and how to change that. */
export interface PinchPointsToggle {
  shown: boolean
  onShownChange: (shown: boolean) => void
}

export interface FeatureDetailsProps {
  feature: FeatureIdentity
  /** Lengths in the reach chart; every other figure comes in written. */
  units: Units
  /** The colour of the feature's machining direction, as the part shows it: any CSS colour. */
  directionColor: string
  /** The feature beside its walls, for the reach chart: `featureProfile` of its sheet. */
  profile: FeatureProfile
  /** In place of the feature's type: `Through hole ⌀ 6.35`. */
  label?: ReactNode
  /** A feature the plan cannot do without: shows the REQUIRED pill. Left out, no pill. */
  required?: boolean
  /** Turns the camera to the feature: shows a "Show this feature" button. */
  onFrame?: () => void
  /** Right of the name: the app's own buttons. */
  actions?: ReactNode
  /** At the end of the "Machined from" line: a folder badge, say. */
  status?: ReactNode
  /** Under the title, before the sections: a sentence of the app's, its own action. */
  children?: ReactNode
  /** The rules it breaks, as rows: see `brokenRules`. */
  rules: readonly BrokenRule[]
  /** Its measurements and milling considerations: `featureMeasurements`. */
  measurements: Loadable<readonly Measurement[]>
  /** Its raw report entry and datasheet, for the reach chart. Null where the app has none. */
  record: Loadable<FeatureRecord | null>
  /**
   * The widest tool drawn on the part: its "Max tool diameter" row then shows
   * and hides it. Left out, the row is plain. Apps start it shown.
   */
  pinchPoints?: PinchPointsToggle
  /**
   * The app's window, to pop the reach, the datasheet fields and the raw
   * record out into, larger. Left out, there are no pop-out buttons.
   */
  PopOut?: PopOutWindow
  look?: FeaturePanelLook
  folds?: FoldStore
}

/**
 * One feature, as the Engine read it: its name and the way it is machined
 * from, then the rules it breaks, what was measured of it, what that asks of
 * the milling, and its reach.
 *
 * Then, shut until opened, every field of its datasheet and its raw API record,
 * to read or copy.
 *
 * Each section folds away under its heading. A section waiting on something
 * the app reads says so, and one whose read failed says why, with a Retry.
 */
export const FeatureDetails: FC<FeatureDetailsProps> = ({
  feature,
  units,
  directionColor,
  profile,
  label,
  required,
  onFrame,
  actions,
  status,
  children,
  rules,
  measurements,
  record,
  pinchPoints,
  PopOut,
  look: lookOption,
  folds,
}): ReactElement => {
  const look = resolveLook(lookOption)
  const name = <FeatureName feature={feature} label={label} look={look} />
  // Which sections are popped out. They stay out as the feature read changes, and follow it.
  const [out, setOut] = useState<ReadonlySet<PopOutId>>(new Set())
  const openOut = useCallback((id: PopOutId) => setOut((was) => new Set(was).add(id)), [])
  const closeOut = useCallback(
    (id: PopOutId) =>
      setOut((was) => {
        const next = new Set(was)
        next.delete(id)
        return next
      }),
    [],
  )
  const popOut = PopOut ? (id: PopOutId) => <PopOutButton id={id} onOpen={openOut} /> : undefined
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate text-sm font-semibold text-gray-600 dark:text-zinc-100">
              {name}
            </h3>
            <p className={cn('flex flex-wrap items-center gap-1.5 text-xs', secondaryText(look))}>
              <Swatch color={directionColor} className="size-2.5" />
              Machined from {directionLabel(feature.machiningDirection)}
              {required ? <RequiredBadge /> : null}
              {status}
            </p>
          </div>
          {actions}
          {onFrame ? (
            <Button variant="secondary" size="sm" onClick={onFrame} className="shrink-0">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <CrosshairIcon weight="bold" className="size-3.5" />
                Show this feature
              </span>
            </Button>
          ) : null}
        </div>
        {children}
      </div>

      <FoldSection id="rules" title="Rules broken" folds={folds}>
        <BrokenRuleList rules={rules} look={look} />
      </FoldSection>

      <MeasurementSections
        measurements={measurements}
        pinchPoints={pinchPoints}
        look={look}
        folds={folds}
      />

      <ReachSection
        record={record}
        units={units}
        profile={profile}
        folds={folds}
        action={popOut?.('reach')}
      />

      <RecordSections record={record} look={look} folds={folds} popOut={popOut} />

      {PopOut ? (
        <PopOuts
          open={out}
          onClose={closeOut}
          Window={PopOut}
          subtitle={name}
          record={record.status === 'ready' ? record.value : null}
          units={units}
          profile={profile}
          look={look}
        />
      ) : null}
    </div>
  )
}

/** The rules a feature breaks: a dot, the rule, the figure that broke it. */
const BrokenRuleList: FC<{ rules: readonly BrokenRule[]; look: ResolvedLook }> = ({
  rules,
  look,
}): ReactElement =>
  rules.length > 0 ? (
    <ul className="flex flex-col gap-1">
      {rules.map((rule) => (
        <li
          key={rule.key}
          className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-100"
        >
          <Swatch color={rule.color} className="mt-0.5" />
          <Explained note={rule.note}>
            <span className="min-w-0 flex-1">{rule.text}</span>
          </Explained>
          {rule.figure ? (
            <span
              className={cn(
                'shrink-0 tabular-nums',
                look.rules === 'result' ? 'font-semibold' : secondaryText(look),
              )}
              style={look.rules === 'result' ? { color: rule.color } : undefined}
            >
              {rule.figure}
              {look.rules === 'result' && rule.limit ? (
                <span className="ml-1 font-normal opacity-60">{rule.limit}</span>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  ) : (
    <None look={look} />
  )

/** A rule's text, its note on hover where it has one. */
const Explained: FC<{ note?: string; children: ReactElement }> = ({ note, children }) =>
  note ? (
    <Tooltip tip={note} side="left">
      {children}
    </Tooltip>
  ) : (
    children
  )

const None: FC<{ look: ResolvedLook }> = ({ look }): ReactElement => (
  <p className={cn('text-sm', secondaryText(look))}>None</p>
)

/**
 * What the Engine measured of the feature, then — under their own heading,
 * where there are any — what that asks of the milling.
 */
const MeasurementSections: FC<{
  measurements: Loadable<readonly Measurement[]>
  pinchPoints?: PinchPointsToggle
  look: ResolvedLook
  folds?: FoldStore
}> = ({ measurements, pinchPoints, look, folds }): ReactElement => {
  if (measurements.status !== 'ready') {
    return (
      <FoldSection id="measurements" title="Measurements" folds={folds}>
        {measurements.status === 'loading' ? (
          <Reading>Reading the feature’s datasheet…</Reading>
        ) : (
          <ReadFailure failure={measurements} />
        )}
      </FoldSection>
    )
  }
  const measured = measurements.value.filter((row) => !row.milling)
  const milling = measurements.value.filter((row) => row.milling)
  return (
    <>
      <FoldSection id="measurements" title="Measurements" folds={folds}>
        <MeasurementList rows={measured} look={look} />
      </FoldSection>
      {milling.length > 0 ? (
        <FoldSection id="milling" title="Milling considerations" folds={folds}>
          <MeasurementList rows={milling} look={look} pinchPoints={pinchPoints} />
        </FoldSection>
      ) : null}
    </>
  )
}

/** The row the widest tool on the part stands for. */
const PINCH_ROW = 'pinch'

/**
 * Measurements as rows: what each is and its figure, the other unit on hover,
 * with how it was worked out behind an ⓘ. With `pinchPoints`, the widest
 * tool's row is a button that shows and hides it on the part.
 */
const MeasurementList: FC<{
  rows: readonly Measurement[]
  look: ResolvedLook
  pinchPoints?: PinchPointsToggle
}> = ({ rows, look, pinchPoints }): ReactElement =>
  rows.length > 0 ? (
    <dl className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
      {rows.map((row) => {
        const toggle = pinchPoints && row.key === PINCH_ROW ? pinchPoints : undefined
        const shown = toggle?.shown ?? false
        const derivation = <Derivation lines={row.derivation} look={look} />
        return (
          <div key={row.key} className="contents">
            <dt className={cn('flex items-center gap-1', secondaryText(look))}>
              {toggle ? (
                <button
                  type="button"
                  aria-pressed={shown}
                  title={shown ? 'Hide the tool on the part' : 'Show the tool on the part'}
                  onClick={() => toggle.onShownChange(!shown)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-info/75',
                    shown
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'hover:text-gray-600 dark:hover:text-zinc-200',
                  )}
                >
                  {row.label}
                  {shown ? <span className="text-2xs font-medium uppercase">shown</span> : null}
                </button>
              ) : (
                row.label
              )}
              {derivation}
            </dt>
            <dd
              className={cn(
                'text-right tabular-nums',
                shown ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-zinc-100',
              )}
              title={row.alt}
            >
              {row.value}
            </dd>
          </div>
        )
      })}
    </dl>
  ) : (
    <None look={look} />
  )

/** How a measurement was read from the datasheet, behind an ⓘ beside its label. */
const Derivation: FC<{ lines: readonly string[]; look: ResolvedLook }> = ({
  lines,
  look,
}): ReactElement | null =>
  lines.length > 0 ? (
    <Tooltip
      side="left"
      hoverable
      tip={
        <div className="flex max-w-sm flex-col gap-0.5 font-mono text-2xs leading-snug whitespace-pre-wrap">
          {lines.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </div>
      }
    >
      <button
        type="button"
        aria-label="How this was measured"
        className={cn(
          'shrink-0 rounded outline-none hover:text-gray-500 focus-visible:ring-2 focus-visible:ring-info/75 dark:hover:text-zinc-300',
          faintText(look),
        )}
      >
        <InfoIcon weight="bold" className="size-3" />
      </button>
    </Tooltip>
  ) : null

/**
 * The feature's reach: the walls beside it, to scale. Its heading shows while
 * the record is read; it goes where the record has no curve worth drawing.
 */
const ReachSection: FC<{
  record: Loadable<FeatureRecord | null>
  units: Units
  profile: FeatureProfile
  folds?: FoldStore
  /** Beside the heading, once there is a curve: the pop-out button. */
  action?: ReactNode
}> = ({ record, units, profile, folds, action }): ReactElement | null => {
  const curve = useMemo(
    () => (record.status === 'ready' ? readReachCurve(record.value?.datasheet) : null),
    [record],
  )
  if (record.status === 'ready' && !curve) return null
  return (
    <FoldSection id="reach" title="Reach" folds={folds} action={curve ? action : null}>
      {record.status === 'loading' ? (
        <Reading>Reading the reach curve…</Reading>
      ) : record.status === 'error' ? (
        <ReadFailure failure={record} />
      ) : curve ? (
        <ReachChart curve={curve} units={units} feature={profile} />
      ) : null}
    </FoldSection>
  )
}
