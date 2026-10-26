import { useMemo, useRef, type FC, type ReactElement, type ReactNode } from 'react'
import { cn } from '../common'
import { AllTools } from './all-tools'
import { GroupMenu } from './group-menu'
import { toolsIn, togglePin } from './pins'
import { SURFACE } from './styles'
import { ToolButton } from './tool-button'
import { ToolDockContext } from './tool-dock-context'
import type { DockGroup, DockTool, ToolDockLayout } from './types'
import { useControlled } from './use-controlled'

const NO_TOOLS: ReadonlyArray<string> = []

export interface ToolDockProps {
  groups: ReadonlyArray<DockGroup>
  /** The layout, if the app holds it; leave it out to let the dock hold it from `defaultLayout`. */
  layout?: ToolDockLayout
  /** The layout the dock opens in when the app does not hold it. */
  defaultLayout?: ToolDockLayout
  onLayoutChange?: (layout: ToolDockLayout) => void
  /** The ids of the tools on the bar, in order, if the app holds them. Both layouts share them. */
  pins?: ReadonlyArray<string>
  /** The tools pinned when the dock opens, when the app does not hold them. */
  defaultPins?: ReadonlyArray<string>
  onPinsChange?: (pins: Array<string>) => void
  /** The bar's name for assistive technology. */
  label?: string
  className?: string
  /** After the tools at the end of the bar, such as a settings menu holding `ToolDock.LayoutToggle`. */
  children?: ReactNode
}

/**
 * A toolbar for many tools, in either of two layouts. Both show the pinned
 * tools as buttons, then what holds every tool, where each can be pinned:
 * All tools in `spread`, and a menu for each group in `grouped`. The two
 * layouts share the pins, so a tool pinned in one is on the bar in the other.
 *
 * The tools are plain data, so the dock holds nothing of theirs: a row or
 * button calls the tool's own `onClick`, and shows its `on`. The dock holds
 * only its layout and pins, and only when the app leaves them to it; saving
 * either is the app's.
 */
export const ToolDock: FC<ToolDockProps> = ({
  groups,
  layout: layoutProp,
  defaultLayout = 'spread',
  onLayoutChange,
  pins: pinsProp,
  defaultPins = NO_TOOLS,
  onPinsChange,
  label = 'Tools',
  className,
  children,
}): ReactElement => {
  const [layout, setLayout] = useControlled(layoutProp, defaultLayout, onLayoutChange)
  const [pins, setPins] = useControlled<ReadonlyArray<string>>(pinsProp, defaultPins, onPinsChange)
  const barRef = useRef<HTMLDivElement>(null)
  const context = useMemo(() => ({ layout, setLayout, bar: barRef }), [layout, setLayout])
  const pin = (id: string): void => setPins(togglePin(pins, id))

  return (
    <ToolDockContext.Provider value={context}>
      <div
        ref={barRef}
        role="group"
        aria-label={label}
        data-layout={layout}
        // `dark`, so kit controls among the children, such as LayoutToggle, take their dark look.
        className={cn(SURFACE, 'dark flex max-w-full flex-wrap items-center gap-1 p-1', className)}
      >
        <OnBar tools={toolsIn(groups, pins)}>
          {layout === 'spread' ? (
            <AllTools groups={groups} pins={pins} onPin={pin} />
          ) : (
            groups.map((group) => (
              <GroupMenu key={group.id} group={group} pins={pins} onPin={pin} />
            ))
          )}
        </OnBar>
        {children ? (
          <>
            <Divider />
            {children}
          </>
        ) : null}
      </div>
    </ToolDockContext.Provider>
  )
}

/** The tools on the bar as buttons, then a divider, then what holds the rest. */
const OnBar: FC<{ tools: ReadonlyArray<DockTool>; children: ReactNode }> = ({
  tools,
  children,
}): ReactElement => (
  <>
    {tools.map((tool) => (
      <ToolButton key={tool.id} tool={tool} />
    ))}
    {tools.length > 0 ? <Divider /> : null}
    {children}
  </>
)

const Divider: FC = (): ReactElement => (
  <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-zinc-700" />
)
