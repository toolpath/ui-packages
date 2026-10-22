import type { FC, ReactElement } from 'react'
import {
  READ_CHAR_PX,
  type ReachReading,
  readingLabelX,
  readingText,
  SECTION_LABEL,
  SECTION_PAD,
  SECTION_TYPE,
  type SectionGeometry,
  type Units,
} from '@toolpath/dfm'
import { READ, READ_DOT, TEXT } from './styles'

/**
 * The curve read off under the pointer: a line down to the floor, a dot on
 * the material's top, and the reading beside the line: to its right when it
 * fits, else to its left, and either way held inside the drawing, so none of
 * it is cut off at the panel's edge.
 */
export const ReadingMark: FC<{
  geometry: SectionGeometry
  reading: ReachReading
  units: Units
}> = ({ geometry, reading, units }): ReactElement => {
  const { x, y, width, floorY } = geometry
  const text = readingText(reading, units)
  const pointerX = x(reading.offset)
  const label = readingLabelX(pointerX, text.length * READ_CHAR_PX, width)
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
        x={label.x}
        y={SECTION_PAD.top + SECTION_LABEL.readingBelow}
        textAnchor={label.anchor}
        fontSize={SECTION_TYPE.reading}
        fontWeight={600}
        className={TEXT}
      >
        {text}
      </text>
    </g>
  )
}
