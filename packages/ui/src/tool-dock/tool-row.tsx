import type { FC, ReactElement } from 'react'
import { PushPinIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { isSwitch } from './pins'
import { NOTE } from './styles'
import type { DockTool } from './types'

/** What a row says under a tool's label: why it cannot work yet, or else what it does. */
export const lineOf = (tool: DockTool): string | null | undefined => tool.gate || tool.note

/** What a tool's pin is called, in All tools and in a group's menu. */
export const pinLabel = (tool: DockTool): string => `Pin ${tool.label} to the bar`

/** A pin's icon: filled while its tool is on the bar. */
export const PinMark: FC<{ pinned: boolean }> = ({ pinned }): ReactElement => (
  <PushPinIcon weight={pinned ? 'fill' : 'regular'} className="size-4" />
)

/** A tool's label and line, for a tooltip, so a label cut short is there in full. */
export const ToolTipText: FC<{ tool: DockTool }> = ({ tool }): ReactElement => {
  const line = lineOf(tool)
  return (
    <span className="flex flex-col">
      <span>{tool.label}</span>
      {line ? <span className="font-normal opacity-80">{line}</span> : null}
    </span>
  )
}

/**
 * A tool's icon, label and line, and its switch if it has one: the inside of
 * a row in a group's menu or in All tools. The row itself is the control.
 *
 * A `compact` row is one line, for All tools, which holds every tool at once:
 * its line is left for the row's tooltip, and kept here, hidden, for
 * assistive technology.
 */
export const ToolRowContent: FC<{ tool: DockTool; noteId: string; compact?: boolean }> = ({
  tool,
  noteId,
  compact = false,
}): ReactElement => {
  const line = lineOf(tool)
  return (
    <>
      <span
        aria-hidden="true"
        className={cn('flex shrink-0 text-zinc-300', compact ? '[&_svg]:size-4' : '[&_svg]:size-5')}
      >
        {tool.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-xs font-medium', compact && 'truncate')}>{tool.label}</span>
        {line ? (
          <span id={noteId} className={NOTE} hidden={compact}>
            {line}
          </span>
        ) : null}
      </span>
      {isSwitch(tool) ? <SwitchLook on={tool.on} /> : null}
    </>
  )
}

/**
 * A switch's look only: the row is the control and says on or off itself. The
 * knob is white either way; the track goes from dark to light gray.
 */
const SwitchLook: FC<{ on: boolean }> = ({ on }): ReactElement => (
  <span
    aria-hidden="true"
    data-on={on || undefined}
    className={cn(
      'relative h-4 w-7 shrink-0 rounded-full transition-colors',
      on ? 'bg-zinc-400' : 'bg-zinc-800',
    )}
  >
    <span
      className={cn(
        'absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-[left]',
        on ? 'left-3.5' : 'left-0.5',
      )}
    />
  </span>
)
