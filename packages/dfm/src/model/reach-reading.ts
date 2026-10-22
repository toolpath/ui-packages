import { heightAt } from '@toolpath/tool-support'
import type { ReachCurve } from './reach.js'
import type { SectionGeometry } from './section-geometry.js'
import { READ_INSET, SECTION_PAD } from './section-layout.js'
import { lengthValue, unitLabel, type Units } from './units.js'

/** The curve read off at one offset: the material's height within that offset of the wall. */
export interface ReachReading {
  offset: number
  height: number
  /** Past the last offset the Engine read: the last height, held. */
  past: boolean
}

/**
 * The whole curve read off at `offset`, as the tool catalog reads it. `past`
 * is against the whole curve, not the drawn one: past a cut, the Engine still
 * read the material.
 */
export const readingAt = ({ offsets, heights }: ReachCurve, offset: number): ReachReading => ({
  offset,
  height: heightAt({ horizontalOffset: offsets, verticalOffset: heights }, offset),
  past: offset > (offsets[offsets.length - 1] ?? 0),
})

/** A reading as the chart writes it beside its line. */
export const readingText = ({ offset, height, past }: ReachReading, units: Units): string =>
  `${lengthValue(offset, units)} ${unitLabel(units)} → ${lengthValue(height, units)} ${unitLabel(units)} reach${past ? ' · past the last reading' : ''}`

/**
 * The offset under a pointer or finger at `clientX`, or null where it is not
 * over the walls: left of the wall, or past the drawing's right edge. `box` is
 * where the drawing is shown, in the same units as `clientX`.
 */
export const offsetUnder = (
  clientX: number,
  box: { left: number; width: number },
  geometry: SectionGeometry,
): number | null => {
  const at = (clientX - box.left) * (geometry.width / box.width)
  const offset = (at - SECTION_PAD.left) / geometry.scale + geometry.x0
  return offset >= 0 && at <= geometry.right ? offset : null
}

/**
 * Where the reading's text goes beside its line at `touchX`, in a drawing
 * `width` wide: to the line's right when `textWidth` fits there, else to its
 * left, and either way held inside the drawing, so none of it is cut off at
 * the edge. `anchor` is the SVG `textAnchor` that `x` is for.
 */
export const readingLabelX = (
  touchX: number,
  textWidth: number,
  width: number,
): { x: number; anchor: 'start' | 'end' } =>
  touchX + READ_INSET + textWidth <= width - READ_INSET
    ? { x: touchX + READ_INSET, anchor: 'start' }
    : {
        x: Math.min(Math.max(touchX - READ_INSET, READ_INSET + textWidth), width - READ_INSET),
        anchor: 'end',
      }
