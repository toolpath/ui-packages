import { useMemo, useRef, type RefObject } from 'react'
import { useToolDock } from './tool-dock-context'

/** The space between the bar's edge and each menu or panel that opens from it, in px. */
export const POPOUT_GAP = 4

type Box = Omit<DOMRect, 'toJSON'>

/** What a popup positions against, in place of an element: its box, and the element it moves with. */
interface Anchor {
  getBoundingClientRect: () => Box
  readonly contextElement: Element | undefined
}

export interface BarPopout<T extends HTMLElement> {
  /** For the control the popup opens from. */
  trigger: RefObject<T | null>
  /** For the popup: what it opens over, in place of the control. */
  anchor: Anchor
  /** For the popup: its distance from `anchor`, which is `POPOUT_GAP`. */
  sideOffset: number
}

/**
 * Where a popup from a control on the bar opens: over the control, and
 * `POPOUT_GAP` past the bar's edge on the popup's `side`, not the control's. The controls sit inside
 * the bar's padding, and on a second row when it wraps, so a gap from the
 * control would change from one popup to the next.
 *
 * Put `trigger` on the control, and `anchor` and `sideOffset` on the popup.
 */
export const useBarPopout = <T extends HTMLElement>(): BarPopout<T> => {
  const { bar } = useToolDock()
  const trigger = useRef<T>(null)
  const anchor = useMemo<Anchor>(
    () => ({
      getBoundingClientRect: () => overBar(trigger.current, bar.current),
      get contextElement() {
        return trigger.current ?? undefined
      },
    }),
    [bar],
  )
  return { trigger, anchor, sideOffset: POPOUT_GAP }
}

/** The control's left and right, with the bar's top and bottom. */
const overBar = (control: Element | null, bar: Element | null): Box => {
  const controlBox = boxOf(control)
  const barBox = bar ? boxOf(bar) : controlBox
  return toBox(controlBox.x, barBox.y, controlBox.width, barBox.height)
}

const boxOf = (element: Element | null): Box => {
  const rect = element?.getBoundingClientRect()
  return toBox(rect?.x ?? 0, rect?.y ?? 0, rect?.width ?? 0, rect?.height ?? 0)
}

const toBox = (x: number, y: number, width: number, height: number): Box => ({
  x,
  y,
  width,
  height,
  top: y,
  right: x + width,
  bottom: y + height,
  left: x,
})
