import { useRef, useState, type FC, type KeyboardEvent, type ReactElement } from 'react'
import { CaretRightIcon, TrashIcon } from '@phosphor-icons/react'
import { IconButton, cn } from '@toolpath/ui'
import type { RuleResult } from '../model/dfm-flags.js'
import type { DfmRule } from '../model/dfm-rules.js'
import { FeatureRows } from './feature-rows.js'
import { RuleSentence } from './rule-sentence.js'
import { FOCUS_RING } from './styles.js'
import { ColorPicker, Swatch } from './swatch.js'
import type { RuleListProps } from './types.js'

interface RowProps extends Omit<RuleListProps, 'rules'> {
  rule: DfmRule
  result: RuleResult | null
  checking: boolean
  open: boolean
  /** A rule just added: its first word takes focus, ready to change. */
  focusOnMount: boolean
  onToggle: () => void
  onChange: (rule: DfmRule) => void
  onRemove: () => void
}

/** A rule's own controls, which keep their clicks rather than opening the row. */
const isControl = (target: EventTarget): boolean =>
  target instanceof Element && target.closest('button, select, input, a') !== null

/** One rule: its colour, its sentence, how many features break it, and those features once opened. */
export const RuleRow: FC<RowProps> = ({
  rule,
  result,
  checking,
  open,
  focusOnMount,
  onToggle,
  onChange,
  onRemove,
  check,
  features,
  sheets,
  units,
  ...list
}): ReactElement => {
  const [picking, setPicking] = useState(false)
  const swatchRef = useRef<HTMLButtonElement>(null)
  const count = result?.tags.length ?? 0
  // Readings that break it but are not required: listed under the rule, not counted or shown on the badge.
  const others = result?.otherTags.length ?? 0
  const canOpen = count + others > 0

  /** On the swatch, the row's stop in the list: right opens the rule, or steps into it; left shuts it. */
  const onRowKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowRight' && canOpen) {
      event.preventDefault()
      if (!open) onToggle()
      else
        event.currentTarget.closest('li')?.querySelector<HTMLElement>('[data-feature-row]')?.focus()
    } else if (event.key === 'ArrowLeft' && open) {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <li
      className={cn(
        'group/rule',
        // Nothing on the part breaks it: dimmed, until pointed at or worked in.
        !checking &&
          count === 0 &&
          'opacity-55 transition-opacity focus-within:opacity-100 hover:opacity-100',
      )}
    >
      {/*
        The whole row opens the rule: a click anywhere but on its own controls — the words, the
        colour, the count, remove — toggles its features. Mouse only; the keyboard has the caret
        and the arrow keys.
      */}
      <div
        onClick={(event) => {
          if (canOpen && !isControl(event.target)) onToggle()
        }}
        className={cn(
          'flex items-start gap-1.5 rounded py-1 pr-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800/60',
          canOpen && 'cursor-pointer',
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Hide features' : 'Show features'}
          disabled={!canOpen}
          onClick={onToggle}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded text-gray-400 dark:text-zinc-400',
            canOpen
              ? 'cursor-pointer hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
              : 'invisible',
          )}
        >
          <CaretRightIcon
            weight="bold"
            className={cn('size-4 transition-transform duration-150', open && 'rotate-90')}
          />
        </button>
        <Swatch
          ref={swatchRef}
          color={rule.color}
          label="Change colour"
          onClick={() => setPicking((was) => !was)}
          onKeyDown={onRowKey}
          listItem="rules"
          className="mt-1.5"
        />
        <RuleSentence rule={rule} units={units} onChange={onChange} autoFocus={focusOnMount} />
        {/* The count, one size for every rule; remove floats to its left on hover, taking no room of its own. */}
        <div className="relative mt-1 shrink-0">
          <IconButton
            aria-label="Remove rule"
            variant="muted"
            size="sm"
            onClick={onRemove}
            className={cn(
              'absolute top-1/2 right-full mr-1 -translate-y-1/2 bg-white dark:bg-zinc-800',
              'pointer-events-none opacity-0 transition-opacity',
              'group-focus-within/rule:pointer-events-auto group-focus-within/rule:opacity-100',
              'group-hover/rule:pointer-events-auto group-hover/rule:opacity-100',
            )}
          >
            <TrashIcon weight="bold" />
          </IconButton>
          <CountPill
            count={count}
            others={others}
            checking={checking}
            open={open}
            canOpen={canOpen}
            onToggle={onToggle}
          />
        </div>
      </div>
      {picking ? (
        <div className="pb-1 pl-[34px]">
          <ColorPicker
            value={rule.color}
            onChange={(color) => {
              onChange({ ...rule, color })
              setPicking(false)
              swatchRef.current?.focus()
            }}
          />
        </div>
      ) : null}
      {open && result && check && features && sheets ? (
        <FeatureRows
          rule={rule}
          tags={result.tags}
          otherTags={result.otherTags}
          check={check}
          features={features}
          sheets={sheets}
          units={units}
          onBack={() => swatchRef.current?.focus()}
          {...list}
        />
      ) : null}
    </li>
  )
}

interface CountPillProps {
  count: number
  others: number
  checking: boolean
  open: boolean
  canOpen: boolean
  onToggle: () => void
}

/** How many required features break the rule; it opens the rule to them. */
const CountPill: FC<CountPillProps> = ({
  count,
  others,
  checking,
  open,
  canOpen,
  onToggle,
}): ReactElement => (
  <button
    type="button"
    aria-label={checking ? undefined : countLabel(count, others)}
    title={
      others > 0 ? `${count} required · ${others} other ${readings(others)} not counted` : undefined
    }
    aria-expanded={canOpen ? open : undefined}
    disabled={!canOpen}
    onClick={onToggle}
    className={cn(
      'flex h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
      canOpen
        ? 'cursor-pointer bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
        : 'text-gray-300 dark:text-zinc-600',
      FOCUS_RING,
    )}
  >
    {checking ? '…' : count}
  </button>
)

const readings = (count: number): string => (count === 1 ? 'reading' : 'readings')

const countLabel = (count: number, others: number): string => {
  const required = `${count} required ${count === 1 ? 'feature breaks' : 'features break'} it`
  return others > 0 ? `${required}, and ${others} other ${readings(others)}` : required
}
