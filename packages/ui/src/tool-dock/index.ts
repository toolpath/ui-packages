import type { FC } from 'react'
import { useBarPopout } from './bar-popout'
import { BarTooltip } from './dock-tooltip'
import { LayoutToggle } from './layout-toggle'
import { ToolDock as ToolDockRoot, type ToolDockProps } from './tool-dock'
import { useToolDock } from './tool-dock-context'

type ToolDockCompoundType = FC<ToolDockProps> & {
  LayoutToggle: typeof LayoutToggle
  useToolDock: typeof useToolDock
  useBarPopout: typeof useBarPopout
  Tooltip: typeof BarTooltip
}

export const ToolDock: ToolDockCompoundType = Object.assign(ToolDockRoot, {
  LayoutToggle,
  useToolDock,
  useBarPopout,
  Tooltip: BarTooltip,
})

export type { ToolDockProps }
export type { BarPopout } from './bar-popout'
export type { DockGroup, DockTool, ToolDockLayout } from './types'
