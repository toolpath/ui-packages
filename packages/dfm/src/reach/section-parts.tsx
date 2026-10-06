import type { FC, ReactElement } from 'react'
import { lengthValue, type Units } from '../model/units.js'
import type { SectionGeometry } from './section-geometry.js'
import {
  AXIS_LABEL_HALF_PX,
  DEPTH_WORD_PX,
  FLOOR_STRIP,
  READ_INSET,
  SECTION_PAD,
  featureBreak,
} from './section-layout.js'
import {
  ARROW,
  FEATURE_FILL,
  FEATURE_LINE,
  FEATURE_TEXT,
  FLOOR,
  LINE,
  MATERIAL,
  TEXT,
} from './styles.js'

interface PartProps {
  geometry: SectionGeometry
}

interface DimensionProps extends PartProps {
  units: Units
}

/** A dimension drawn with arrowheads: it names the drawing's own marker. */
interface ArrowedProps extends DimensionProps {
  arrowId: string
}

/** A dimension's arrowhead, as a marker on its line's ends. */
export const Arrows: FC<{ id: string }> = ({ id }): ReactElement => (
  <defs>
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="10"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M 0 1.5 L 10 5 L 0 8.5 z" className={ARROW} />
    </marker>
  </defs>
)

/**
 * The feature, shaded as the part paints it, the floor strip, the material,
 * and the feature's own edges: its floor, unless it runs through, and its
 * wall up to where the material starts.
 */
export const SectionShapes: FC<PartProps> = ({ geometry }): ReactElement => {
  const { x, floorY, right, featureTopY, featureBottomY, wallTop, feature } = geometry
  const floorLeft = feature.through ? x(0) : SECTION_PAD.left
  return (
    <>
      <rect
        x={SECTION_PAD.left}
        y={featureTopY}
        width={x(0) - SECTION_PAD.left}
        height={featureBottomY - featureTopY}
        className={FEATURE_FILL}
      />
      <rect
        x={floorLeft}
        y={floorY}
        width={right - floorLeft}
        height={FLOOR_STRIP}
        className={FLOOR}
      />
      <path d={geometry.materialPath} strokeWidth={1} className={MATERIAL} />
      <line x1={floorLeft} x2={right} y1={floorY} y2={floorY} strokeWidth={1} className={LINE} />
      {feature.through ? null : (
        <line
          x1={SECTION_PAD.left}
          x2={x(0)}
          y1={floorY}
          y2={floorY}
          strokeWidth={2}
          className={FEATURE_LINE}
        />
      )}
      <line
        x1={x(0)}
        x2={x(0)}
        y1={featureBottomY}
        y2={wallTop}
        strokeWidth={2}
        className={FEATURE_LINE}
      />
      <line
        x1={x(0)}
        x2={x(0)}
        y1={wallTop}
        y2={SECTION_PAD.top}
        strokeWidth={0.75}
        strokeDasharray="3 2"
        className={FEATURE_LINE}
      />
    </>
  )
}

/** The headings: the feature's over its middle, the walls' flush with the drawing's right edge. */
export const SectionHeadings: FC<PartProps> = ({ geometry }): ReactElement => {
  const { right } = geometry
  return (
    <>
      <text
        x={geometry.featureHeadingX}
        y={SECTION_PAD.top - 8}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        className={FEATURE_TEXT}
      >
        {geometry.featureHeading}
      </text>
      <text
        x={right}
        y={SECTION_PAD.top - 8}
        textAnchor="end"
        fontSize={9}
        className={TEXT}
        opacity={0.7}
      >
        ADJACENT WALL HEIGHT
      </text>
    </>
  )
}

/** Wider than the drawing gives it: the feature broken off at the left, as the walls are at the right. */
export const FeatureBreak: FC<PartProps> = ({ geometry }): ReactElement | null =>
  geometry.featureCut ? (
    <path
      d={featureBreak(SECTION_PAD.left, geometry.featureTopY, geometry.featureBottomY)}
      strokeWidth={1}
      fill="none"
      className={FEATURE_LINE}
    />
  ) : null

/** The feature's depth: its top across it, carried over to its height among the walls'. */
export const FeatureDepth: FC<DimensionProps> = ({ geometry, units }): ReactElement | null => {
  const { x, featureTopY, datumX } = geometry
  const { depth } = geometry.feature
  if (depth === null) return null
  return (
    <g>
      <title>Feature depth</title>
      <line
        x1={SECTION_PAD.left}
        x2={x(0)}
        y1={featureTopY}
        y2={featureTopY}
        strokeWidth={2}
        className={FEATURE_LINE}
      />
      <line
        x1={x(0)}
        x2={datumX}
        y1={featureTopY}
        y2={featureTopY}
        strokeWidth={0.75}
        strokeDasharray="4 2"
        className={FEATURE_LINE}
      />
      {x(0) - SECTION_PAD.left >= DEPTH_WORD_PX ? (
        <text
          x={SECTION_PAD.left + 4}
          y={featureTopY - 4}
          fontSize={9}
          fontWeight={600}
          className={FEATURE_TEXT}
        >
          depth
        </text>
      ) : null}
      <text
        x={datumX + 4}
        y={featureTopY + 3.5}
        fontSize={10}
        fontWeight={600}
        className={FEATURE_TEXT}
      >
        {lengthValue(depth, units)}
      </text>
    </g>
  )
}

/** The whole run the curve was read over, end to end; shown only when the curve was not cut. */
const ReadRun: FC<ArrowedProps> = ({ geometry, units, arrowId }): ReactElement | null => {
  const { x, last, cut, floorY, ordinateY } = geometry
  if (last <= 0 || cut) return null
  return (
    <g>
      <line
        x1={x(0)}
        x2={x(last)}
        y1={ordinateY - 8}
        y2={ordinateY - 8}
        strokeWidth={0.75}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
        className={LINE}
      />
      <line
        x1={x(last)}
        x2={x(last)}
        y1={floorY}
        y2={ordinateY - 4}
        strokeWidth={0.5}
        className={LINE}
      />
      <text
        x={(x(0) + x(last)) / 2}
        y={ordinateY - 11}
        textAnchor="middle"
        fontSize={10}
        className={TEXT}
      >
        {lengthValue(last, units)} read
      </text>
    </g>
  )
}

/** The axis the offsets run along, the wall's datum, and the offsets out from it, as ordinates beneath. */
export const OffsetOrdinates: FC<ArrowedProps> = (props): ReactElement => {
  const { geometry, units } = props
  const { x, y, right, width, floorY, ordinateY } = geometry
  return (
    <>
      <text
        x={Math.min(
          Math.max((x(0) + right) / 2, AXIS_LABEL_HALF_PX + READ_INSET),
          width - AXIS_LABEL_HALF_PX - READ_INSET,
        )}
        y={ordinateY + 32}
        textAnchor="middle"
        fontSize={9}
        className={TEXT}
        opacity={0.7}
      >
        XY PLANE DISTANCE FROM FEATURE
      </text>
      <line
        x1={x(0)}
        x2={x(0)}
        y1={floorY}
        y2={ordinateY + 4}
        strokeWidth={0.75}
        className={LINE}
      />
      <text x={x(0)} y={ordinateY + 15} textAnchor="middle" fontSize={10} className={TEXT}>
        0
      </text>
      {geometry.across.map((riser) => (
        <g key={`x:${riser.at}`}>
          <line
            x1={x(riser.at)}
            x2={x(riser.at)}
            y1={y(riser.from) + 2}
            y2={ordinateY + 4}
            strokeWidth={0.5}
            strokeDasharray="2 2"
            className={LINE}
          />
          <text
            x={x(riser.at)}
            y={ordinateY + 15}
            textAnchor="middle"
            fontSize={10}
            className={TEXT}
          >
            {lengthValue(riser.at, units)}
          </text>
        </g>
      ))}
      <ReadRun {...props} />
    </>
  )
}

/** The floor's datum, and each step's height, as ordinates on the right: the tallest is the last. */
export const HeightOrdinates: FC<DimensionProps> = ({ geometry, units }): ReactElement => {
  const { y, right, floorY, datumX } = geometry
  return (
    <>
      <text x={datumX + 4} y={floorY + 3.5} fontSize={10} className={TEXT}>
        0
      </text>
      {geometry.up.map((h) => (
        <g key={`y:${h}`}>
          <line
            x1={right - 2}
            x2={datumX}
            y1={y(h)}
            y2={y(h)}
            strokeWidth={0.5}
            strokeDasharray="2 2"
            className={LINE}
          />
          <text x={datumX + 4} y={y(h) + 3.5} fontSize={10} className={TEXT}>
            {lengthValue(h, units)}
          </text>
        </g>
      ))}
    </>
  )
}
