import { useId, type FC, type ReactElement } from 'react'
import { Menu as BaseMenu } from '@base-ui/react'
import { CaretDownIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { Menu } from '../menu'
import { useBarPopout } from './bar-popout'
import { BAR_BUTTON, DIMMED, FOCUS, HEADING, OPEN, pinLook, POPOVER, ROW_WITH_PIN } from './styles'
import { PinMark, pinLabel, ToolRowContent } from './tool-row'
import { headingOf, isSwitch, lineOf } from './tools'
import type { DockGroup, DockTool } from './types'

interface Props {
  group: DockGroup
  pins: ReadonlyArray<string>
  onPin: (id: string) => void
}

/**
 * A group as a menu on the bar, for the grouped layout. A switch row leaves
 * the menu open, so several can be flipped in a row; an action or a gated tool
 * closes it. Each row's pin puts its tool on the bar or takes it off, and
 * leaves the menu open.
 */
export const GroupMenu: FC<Props> = ({ group, pins, onPin }): ReactElement => {
  const popout = useBarPopout<HTMLButtonElement>()
  return (
    <Menu>
      {/* Base UI's own trigger, so the bar's button is the trigger; the kit's wraps one in another. */}
      <BaseMenu.Trigger
        ref={popout.trigger}
        data-group={group.id}
        className={cn(BAR_BUTTON, FOCUS, OPEN, 'group px-2 text-xs font-medium [&_svg]:size-4')}
      >
        {group.icon}
        {group.label}
        <CaretDownIcon className="size-3! transition-transform group-data-[popup-open]:rotate-180" />
      </BaseMenu.Trigger>
      <Menu.Popover
        side="top"
        align="start"
        anchor={popout.anchor}
        sideOffset={popout.sideOffset}
        className={cn(POPOVER, 'w-72 p-1')}
      >
        <div className={HEADING}>{headingOf(group)}</div>
        {group.tools.map((tool) => (
          // A grid, so the row takes the width the pin leaves. The arrow keys stop at both.
          <div key={tool.id} role="presentation" className={cn(ROW_WITH_PIN, 'gap-1')}>
            <GroupMenuItem tool={tool} />
            <GroupMenuPin
              tool={tool}
              pinned={pins.includes(tool.id)}
              onPin={() => onPin(tool.id)}
            />
          </div>
        ))}
      </Menu.Popover>
    </Menu>
  )
}

const GroupMenuItem: FC<{ tool: DockTool }> = ({ tool }): ReactElement => {
  const lineId = useId()
  const toggles = isSwitch(tool)
  return (
    <Menu.Item
      {...(toggles ? { role: 'menuitemcheckbox', 'aria-checked': tool.on } : {})}
      aria-label={tool.label}
      aria-describedby={lineOf(tool) ? lineId : undefined}
      data-tool={tool.id}
      closeOnClick={!toggles}
      onClick={tool.onClick}
      className={cn(
        'gap-3 rounded py-1.5 whitespace-normal text-zinc-100 data-[highlighted]:bg-zinc-800',
        tool.gate && DIMMED,
      )}
    >
      <ToolRowContent tool={tool} lineId={lineId} />
    </Menu.Item>
  )
}

/** A checkbox item of its own, so the arrow keys reach it, and a click leaves the menu open. */
const GroupMenuPin: FC<{ tool: DockTool; pinned: boolean; onPin: () => void }> = ({
  tool,
  pinned,
  onPin,
}): ReactElement => (
  <BaseMenu.CheckboxItem
    aria-label={pinLabel(tool)}
    checked={pinned}
    onCheckedChange={onPin}
    data-pin={tool.id}
    className={cn('outline-none data-[highlighted]:bg-zinc-800', pinLook(pinned))}
  >
    <PinMark pinned={pinned} />
  </BaseMenu.CheckboxItem>
)
