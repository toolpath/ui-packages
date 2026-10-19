import { heightAt } from '@toolpath/tool-support'
import type { FC, ReactElement } from 'react'
import type { ReachCurve } from '../model/reach.js'
import { lengthValue, unitLabel, type Units } from '../model/units.js'
import type { SectionGeometry } from './section-geometry.js'
import { READ_CHAR_PX, READ_INSET, SECTION_PAD } from './section-layout.js'
import { READ, READ_DOT, TEXT } from './styles.js'

/** The curve read off at one offset: the material's height within that offset of the wall. */
interface Reading {
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
export const readingAt = ({ offsets, heights }: ReachCurve, offset: number): Reading => ({
  offset,
  height: heightAt({ horizontalOffset: offsets, verticalOffset: heights }, offset),
  past: offset > (offsets[offsets.length - 1] ?? 0),
})

const readingText = ({ offset, height, past }: Reading, units: Units): string =>
  `${lengthValue(offset, units)} ${unitLabel(units)} → ${lengthValue(height, units)} ${unitLabel(units)} reach${past ? ' · past the last reading' : ''}`

/**
 * The offset under a pointer at `clientX`, or null where it is not over the
 * walls: left of the wall, or past the drawing's right edge.
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
 * The curve read off under the pointer: a line down to the floor, a dot on
 * the material's top, and the reading beside the line: to its right when it
 * fits, else to its left, and either way held inside the drawing, so none of
 * it is cut off at the panel's edge.
 */
export const ReadingMark: FC<{ geometry: SectionGeometry; reading: Reading; units: Units }> = ({
  geometry,
  reading,
  units,
}): ReactElement => {
  const { x, y, width, floorY } = geometry
  const text = readingText(reading, units)
  const textWidth = text.length * READ_CHAR_PX
  const pointerX = x(reading.offset)
  const onRight = pointerX + READ_INSET + textWidth <= width - READ_INSET
  const labelX = onRight
    ? pointerX + READ_INSET
    : Math.min(Math.max(pointerX - READ_INSET, READ_INSET + textWidth), width - READ_INSET)
  return (
    <g pointerEvents="none">
      <line
        x1={pointerX}
        x2={pointerX}
        y1={SECTION_PAD.top}
        y2={floorY}
        strokeWidth={1}
        strokeDasharray="3 3"
        className={READ}
      />
      <circle cx={pointerX} cy={y(reading.height)} r={4} className={READ_DOT} />
      <text
        x={labelX}
        y={SECTION_PAD.top + 14}
        textAnchor={onRight ? 'start' : 'end'}
        fontSize={11}
        fontWeight={600}
        className={TEXT}
      >
        {text}
      </text>
    </g>
  )
}
