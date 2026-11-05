import { Html } from '@react-three/drei/web/Html.js'
import { addAfterEffect, useThree } from '@react-three/fiber'
import { type CSSProperties, useEffect, useRef } from 'react'
import type { Vector3 } from 'three'
import {
  MEASURE_LABEL_CLASS,
  cssColor,
  labelValue,
  type LabelPress,
  type MeasureLabelKind,
} from './render/measure.js'

/**
 * The measure tool's labels and points as the web draws them: elements laid
 * over the canvas (drei's `Html`), styled by the page. React Native's are in
 * `measure-labels.native.tsx`.
 */

/** A label as the tool reads it out (`measure-readout.tsx`). */
export interface MeasureLabelProps {
  at: Vector3
  text: string
  kind: MeasureLabelKind
  axis?: 'x' | 'y' | 'z'
  /** Its measurement's colour, CSS; none for a distance's leg, which wears its axis's. */
  color?: string
  /** The label's class: {@link MEASURE_LABEL_CLASS}, and the consumer's beside it. */
  labelClass: string
  /** Pressing it; on the web a click is read where the labels live (`MeasureLabelChrome`). */
  onPress?: () => void
  /** Ignored: React Native's, for a screen reader. */
  hint?: string
}

/** A measure label: an unstyled element whose look is the page's stylesheet's. */
export const MeasureLabel = ({ at, text, kind, axis, color, labelClass }: MeasureLabelProps) => (
  <Html position={at} center zIndexRange={[20, 0]} pointerEvents="none">
    <div
      className={labelClass}
      data-measure-label={kind}
      data-axis={axis}
      style={color ? ({ '--measure-color': color } as CSSProperties) : undefined}
    >
      {/* What a click on the label copies. */}
      <span data-measure-value>{text}</span>
    </div>
  </Html>
)

/** The size of a point picked, in CSS pixels, and of the white ring round it. */
const MARKER_STYLE: CSSProperties = {
  width: '10px',
  height: '10px',
  boxSizing: 'border-box',
  border: '2px solid #fff',
  borderRadius: '9999px',
  boxShadow: '0 1px 3px rgb(0 0 0 / 30%)',
}

/**
 * Set on the box drei wraps round a dot. Its `pointerEvents` prop does not
 * reach that box unless `transform` is set, and the box, the dot's size,
 * would take a click on the point from the part.
 */
const DEAF: CSSProperties = { pointerEvents: 'none' }

/** A point picked: a dot on screen, a set size however far off. */
export const PointMarker = ({ at, color }: { at: Vector3; color: number }) => (
  <Html position={at} center zIndexRange={[20, 0]} style={DEAF}>
    <div style={{ ...MARKER_STYLE, backgroundColor: cssColor(color) }} />
  </Html>
)

/** The room left between two labels, in CSS pixels. */
const GAP_PIXELS = 4

interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right &&
  b.left < a.right &&
  a.top < b.bottom + GAP_PIXELS &&
  b.top < a.bottom + GAP_PIXELS

const movedBy = (box: Box, pixels: number): Box => ({
  ...box,
  top: box.top + pixels,
  bottom: box.bottom + pixels,
})

/** How far `box` must move to clear `blocker`, going to the side its middle is already on. */
const clearance = (box: Box, blocker: Box): number => {
  const sitsAbove = box.top + box.bottom < blocker.top + blocker.bottom
  return sitsAbove ? blocker.top - GAP_PIXELS - box.bottom : blocker.bottom + GAP_PIXELS - box.top
}

/** One pass over what is already placed: enough for a handful of labels, and it cannot loop. */
const nudgeClearOf = (box: Box, placed: readonly Box[]): number =>
  placed.reduce((nudge, blocker) => {
    const moved = movedBy(box, nudge)
    return overlaps(moved, blocker) ? nudge + clearance(moved, blocker) : nudge
  }, 0)

/** How far a label is moved down now, from its `translate`: `0 12px` is 12. */
const currentNudge = (label: HTMLElement): number =>
  parseFloat(label.style.getPropertyValue('translate').split(' ')[1] ?? '') || 0

const nudge = (label: HTMLElement, pixels: number): void => {
  if (pixels === currentNudge(label)) return
  if (pixels === 0) label.style.removeProperty('translate')
  else label.style.setProperty('translate', `0 ${pixels}px`)
}

/** Where the label would sit with no nudge, so last frame's nudge does not feed this one. */
const restingBox = (label: HTMLElement): Box => {
  // Picked out by name: a `DOMRect` keeps its sides on its prototype, where a spread finds nothing.
  const { top, bottom, left, right } = label.getBoundingClientRect()
  return movedBy({ top, bottom, left, right }, -currentNudge(label))
}

/**
 * The labels that may move: a distance's X, Y and Z legs, and every label the
 * faces put up. Those are pinned to the middle of a line or the end of a
 * hole, where two of them often land together.
 */
const MOVABLE = new Set<string>(['delta', 'face'] satisfies MeasureLabelKind[])

const isMovable = (label: HTMLElement): boolean => MOVABLE.has(label.dataset.measureLabel ?? '')

/**
 * Any other labels stay where they are put; the movable ones give way, to
 * them and to each other. Every box is read before any label is moved, so
 * the browser lays the page out once.
 */
const declutter = (labels: readonly HTMLElement[]): void => {
  const movers = labels.filter(isMovable)
  const moverBoxes = movers.map(restingBox)
  const placed = labels.filter((label) => !isMovable(label)).map(restingBox)

  movers.forEach((mover, index) => {
    const box = moverBoxes[index]
    if (!box) return
    const pixels = Math.round(nudgeClearOf(box, placed))
    placed.push(movedBy(box, pixels))
    nudge(mover, pixels)
  })
}

/** Where drei's `<Html>` puts its elements, found the way drei finds it. */
const useLabelRoot = (): HTMLElement | null =>
  useThree(
    (state): HTMLElement | null =>
      (state.events.connected as HTMLElement | undefined) ??
      (state.gl.domElement.parentNode as HTMLElement | null),
  )

/**
 * Keeps the measure tool's labels off each other.
 *
 * Each label is pinned to the middle of its line. Seen from most angles the
 * middle of a distance and the middle of one of its legs are close on
 * screen, and the two labels land on top of each other. So the movable ones
 * are moved down or up, after they are placed, by their own `translate`,
 * which leaves a stylesheet's `transform` alone.
 *
 * It runs after the frame rather than in it. Callbacks in the frame run in
 * the order they signed up, and a label made later signs up later, so a
 * callback in the frame would read that label before drei had moved it.
 * It draws nothing.
 */
const MeasureLabelDeclutter = (): null => {
  const labelRoot = useLabelRoot()
  const invalidate = useThree((state) => state.invalidate)

  useEffect(
    () =>
      addAfterEffect(() => {
        const labels = labelRoot?.querySelectorAll<HTMLElement>(`.${MEASURE_LABEL_CLASS}`)
        if (labels) declutter([...labels])
      }),
    [labelRoot],
  )

  /*
   * The canvas draws on demand, and a change of units redraws the labels'
   * text without drawing a frame. So each render here asks for one, or the
   * labels would keep the room their old text needed.
   */
  useEffect(() => {
    invalidate()
  })

  return null
}

/** How long a label shows it was copied, ms. */
const COPIED_MS = 1200

/** The label a click copies: any measurement's. */
const copyable = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element) || target.closest('button')) return null
  return target.closest<HTMLElement>(`.${MEASURE_LABEL_CLASS}`)
}

/**
 * A click on a measurement's label copies its value (`labelValue`): `⌀ 6.35 mm`
 * copies as `6.35`, ready to paste into a field that wants a number. Where
 * `onPress` is given, the click goes to it instead, and nothing is copied.
 *
 * The labels are drei's `Html`, outside the canvas, so this listens where
 * they all live. It listens in the capture phase and stops a press that
 * lands on a label, so that the click does not go on to the viewer, which
 * listens on the same element and would read it as a click past the part. A
 * button on a label is left alone: it stops its own events.
 *
 * A label takes the pointer only where the stylesheet lets it
 * (`pointer-events: auto`); its wrapper never does.
 */
const MeasureLabelCopy = ({ onPress }: { onPress?: (label: LabelPress) => void }): null => {
  const labelRoot = useLabelRoot()
  // Read at the click, so a new handler each render does not set the listeners up afresh.
  const press = useRef(onPress)
  press.current = onPress

  useEffect(() => {
    if (!labelRoot) return
    const swallow = (event: Event): void => {
      if (copyable(event.target)) event.stopPropagation()
    }
    const copy = (event: MouseEvent): void => {
      const label = copyable(event.target)
      if (!label) return
      event.stopPropagation()
      const text = label.querySelector('[data-measure-value]')?.textContent ?? label.textContent
      if (press.current) {
        press.current({ text: text ?? '', value: labelValue(text ?? '') })
        return
      }
      // No clipboard (off a secure origin) or a refused one only means no "Copied" mark.
      navigator.clipboard
        ?.writeText(labelValue(text ?? ''))
        .then(() => {
          label.dataset.copied = ''
          window.setTimeout(() => delete label.dataset.copied, COPIED_MS)
        })
        .catch(() => undefined)
    }
    const pressEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick'] as const
    pressEvents.forEach((type) => labelRoot.addEventListener(type, swallow, { capture: true }))
    labelRoot.addEventListener('click', copy, { capture: true })
    return () => {
      pressEvents.forEach((type) => labelRoot.removeEventListener(type, swallow, { capture: true }))
      labelRoot.removeEventListener('click', copy, { capture: true })
    }
  }, [labelRoot])

  return null
}

/**
 * What the labels need beside them on the web: keeping them off each other,
 * and a click on one, which copies its value, or goes to `onPress` where
 * that is given.
 */
export const MeasureLabelChrome = ({ onPress }: { onPress?: (label: LabelPress) => void }) => (
  <>
    <MeasureLabelDeclutter />
    <MeasureLabelCopy onPress={onPress} />
  </>
)
