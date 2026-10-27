import { addAfterEffect, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/**
 * The class every measure label carries, for a stylesheet to find.
 *
 * The labels ship with no look at all. Each one is a `<div>` with this class
 * and `data-measure-label` naming what it is: `face` for a reading of the
 * picks, `delta` for one leg of a distance's breakdown, with `data-axis` on
 * a leg. A measurement's own colour is set on its `face` labels as
 * `--measure-color`, for a border, and the value a click copies is in the
 * label's `[data-measure-value]`. A label marks itself `data-copied` for a
 * moment once copied. The README shows a stylesheet to start from.
 */
export const MEASURE_LABEL_CLASS = 'toolpath-measure-label'

/** What a label is, for a stylesheet to tell them apart. */
export type MeasureLabelKind = 'face' | 'delta'

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
export const MeasureLabelDeclutter = (): null => {
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

/** A hole's count at the front of its label (`4× ⌀ 6.350 mm`), which is not its value. */
const HOLE_COUNT = /^\s*\d+×\s*/

/** How long a label shows it was copied, ms. */
const COPIED_MS = 1200

/** The label a click copies: any measurement's. */
const copyable = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element) || target.closest('button')) return null
  return target.closest<HTMLElement>(`.${MEASURE_LABEL_CLASS}`)
}

/**
 * The number a label reads, without its words or its unit: `⌀ 6.35 mm` and
 * `Angle 45.0°` copy as `6.35` and `45.0`, ready to paste into a field that
 * wants a number; `4× ⌀ 6.35 mm` copies the diameter, not the count. A label
 * with no number copies as it reads.
 */
const labelValue = (text: string): string =>
  text.replace(HOLE_COUNT, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? text.trim()

/**
 * A click on a measurement's label copies its value.
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
export const MeasureLabelCopy = (): null => {
  const labelRoot = useLabelRoot()

  useEffect(() => {
    if (!labelRoot) return
    const swallow = (event: Event): void => {
      if (copyable(event.target)) event.stopPropagation()
    }
    const copy = (event: MouseEvent): void => {
      const label = copyable(event.target)
      if (!label) return
      event.stopPropagation()
      const value = label.querySelector('[data-measure-value]')?.textContent ?? label.textContent
      // No clipboard (off a secure origin) or a refused one only means no "Copied" mark.
      navigator.clipboard
        ?.writeText(labelValue(value ?? ''))
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
