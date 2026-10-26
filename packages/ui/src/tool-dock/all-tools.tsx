import { useId, useState, type FC, type ReactElement } from 'react'
import { Popover } from '@base-ui/react/popover'
import { DotsNineIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { POPOUT_GAP } from './bar-popout'
import { isSwitch } from './pins'
import { DockTooltip } from './dock-tooltip'
import { BAR_BUTTON, FOCUS, HEADING, OPEN, pinLook, POPOVER } from './styles'
import { useToolDock } from './tool-dock-context'
import { lineOf, PinMark, pinLabel, ToolRowContent, ToolTipText } from './tool-row'
import type { DockGroup, DockTool } from './types'

interface Props {
  groups: ReadonlyArray<DockGroup>
  pins: ReadonlyArray<string>
  onPin: (id: string) => void
}

/**
 * Every tool, a column per group, for the spread layout: what is not pinned
 * is reached here. Each row flips its tool, and its pin puts the tool on the
 * bar or takes it off. Switches leave the panel open; an action closes it.
 *
 * The rows are one line each, in columns wide enough for most labels, so the
 * panel covers little of the part; a row's tooltip holds its label in full
 * and what the tool does. The panel centers on the whole bar.
 */
export const AllTools: FC<Props> = ({ groups, pins, onPin }): ReactElement => {
  const { bar } = useToolDock()
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        data-all-tools="true"
        className={cn(BAR_BUTTON, FOCUS, 'px-2 text-xs font-medium [&_svg]:size-4', open && OPEN)}
      >
        <DotsNineIcon />
        All tools
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          anchor={bar}
          side="top"
          sideOffset={POPOUT_GAP}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            aria-label="All tools"
            className={cn(
              POPOVER,
              'grid max-h-[60vh] w-[min(54rem,calc(100vw-1.5rem))] grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-2 gap-y-1 overflow-y-auto p-2 outline-none',
            )}
          >
            {groups.map((group) => (
              <section key={group.id} aria-label={group.title ?? group.label}>
                <div className={HEADING}>{group.title ?? group.label}</div>
                <ul>
                  {group.tools.map((tool) => (
                    <AllToolsRow
                      key={tool.id}
                      tool={tool}
                      pinned={pins.includes(tool.id)}
                      onPin={() => onPin(tool.id)}
                      onUse={() => {
                        tool.onClick()
                        if (!isSwitch(tool)) {
                          setOpen(false)
                        }
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

const AllToolsRow: FC<{
  tool: DockTool
  pinned: boolean
  onPin: () => void
  onUse: () => void
}> = ({ tool, pinned, onPin, onUse }): ReactElement => {
  const noteId = useId()
  const toggles = isSwitch(tool)
  const line = lineOf(tool)
  return (
    // A grid, so the tooltip's wrapper, and the row in it, take the width the pin leaves.
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
      <DockTooltip tip={<ToolTipText tool={tool} />} delay={400}>
        <button
          type="button"
          {...(toggles ? { role: 'switch', 'aria-checked': tool.on } : {})}
          aria-label={tool.label}
          aria-describedby={line ? noteId : undefined}
          data-tool={tool.id}
          onClick={onUse}
          className={cn(
            FOCUS,
            'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-left text-zinc-100 transition-colors hover:bg-zinc-800',
            tool.gate && 'opacity-60',
          )}
        >
          <ToolRowContent tool={tool} noteId={noteId} compact />
        </button>
      </DockTooltip>
      <button
        type="button"
        aria-label={pinLabel(tool)}
        aria-pressed={pinned}
        data-pin={tool.id}
        onClick={onPin}
        className={cn(FOCUS, pinLook(pinned))}
      >
        <PinMark pinned={pinned} />
      </button>
    </li>
  )
}
