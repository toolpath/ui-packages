import { useId, type FC, type ReactElement } from 'react'
import { cn } from '../common'
import { BarTooltip } from './dock-tooltip'
import { BAR_BUTTON, FOCUS, GATED, PRESSED } from './styles'
import { ToolTipText } from './tool-row'
import { isSwitch, lineOf } from './tools'
import type { DockTool } from './types'

/** A tool as a button on the bar: its icon, with its label and line in a tooltip. */
export const ToolButton: FC<{ tool: DockTool }> = ({ tool }): ReactElement => {
  const line = lineOf(tool)
  const lineId = useId()
  return (
    <BarTooltip tip={<ToolTipText tool={tool} />}>
      <button
        type="button"
        aria-label={tool.label}
        aria-describedby={line ? lineId : undefined}
        aria-pressed={isSwitch(tool) ? tool.on : undefined}
        data-tool={tool.id}
        data-gated={tool.gate ? true : undefined}
        onClick={tool.onClick}
        className={cn(BAR_BUTTON, FOCUS, 'w-8', {
          [PRESSED]: isSwitch(tool) && tool.on,
          [GATED]: Boolean(tool.gate),
        })}
      >
        {tool.icon}
        {/* The tooltip is only there on hover, so the line is here too, for assistive technology. */}
        {line ? (
          <span id={lineId} hidden>
            {line}
          </span>
        ) : null}
      </button>
    </BarTooltip>
  )
}
