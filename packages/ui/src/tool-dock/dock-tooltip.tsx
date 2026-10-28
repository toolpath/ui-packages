import { useCallback, type FC, type ReactElement, type ReactNode, type RefObject } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { POPOUT_GAP, useBarPopout, type BarPopout } from './bar-popout'
import { TIP } from './styles'

interface TipProps {
  /** What the tip says. Without one, there is no tip. */
  tip: ReactNode
  /** What the tooltip is for. It is wrapped in a span, which is what is pointed at. */
  children: ReactNode
  /** How long the pointer rests before the tip shows, in ms. */
  delay?: number
}

interface DockTooltipProps extends TipProps {
  /** Takes the span that is pointed at, for an `anchor` that measures it. */
  trigger?: RefObject<HTMLElement | null>
  /** What the tip opens over, in place of the span. */
  anchor?: BarPopout<HTMLElement>['anchor']
}

/**
 * A tooltip in the dock's own look: the bar's dark plate, opening
 * `POPOUT_GAP` above what it is for. The kit's `Tooltip` takes the page's
 * theme, and its light look is the theme's blue-gray `gray-800`.
 */
export const DockTooltip: FC<DockTooltipProps> = ({
  tip,
  children,
  delay = 0,
  trigger,
  anchor,
}): ReactElement => {
  // A ref of Base UI's trigger type, a button's, handing the span on to `trigger`.
  const takeSpan = useCallback(
    (node: HTMLElement | null) => {
      if (trigger) {
        trigger.current = node
      }
    },
    [trigger],
  )
  if (tip === null || tip === undefined || tip === '') {
    return <span ref={takeSpan}>{children}</span>
  }
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger ref={takeSpan} delay={delay} render={<span />}>
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          side="top"
          anchor={anchor}
          sideOffset={POPOUT_GAP}
          className="pointer-events-none z-50"
        >
          <BaseTooltip.Popup className={TIP}>{tip}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}

/**
 * A tooltip for a control on the bar: `POPOUT_GAP` above the bar, as its
 * menus are, not above the control. Exported as `ToolDock.Tooltip`, for a
 * control of the app's own among the dock's children.
 */
export const BarTooltip: FC<TipProps> = (props): ReactElement => {
  const popout = useBarPopout<HTMLElement>()
  return <DockTooltip {...props} trigger={popout.trigger} anchor={popout.anchor} />
}
