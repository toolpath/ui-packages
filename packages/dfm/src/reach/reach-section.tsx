import { useId, useMemo, useState, type FC, type ReactElement } from 'react'
import { ReadingMark, offsetUnder, readingAt } from './reading.js'
import { sectionGeometry } from './section-geometry.js'
import {
  Arrows,
  FeatureBreak,
  FeatureDepth,
  HeightOrdinates,
  OffsetOrdinates,
  SectionHeadings,
  SectionShapes,
} from './section-parts.js'
import type { ReachChartProps } from './types.js'

/**
 * The section through the part at the wall, to scale: the feature on the
 * left, shaded in its selection blue down to its floor, and the material
 * stepping up from the wall on the right. Every step is dimensioned from the
 * wall out, beneath, and from the floor up, on the right, as ordinates from
 * those two datums, where the labels have room. Pointing at the material
 * reads the curve at that offset.
 */
export const ReachSection: FC<ReachChartProps & { width: number }> = ({
  curve: whole,
  units,
  feature,
  width,
}): ReactElement => {
  const [hover, setHover] = useState<number | null>(null)
  const geometry = useMemo(() => sectionGeometry(whole, feature, width), [whole, feature, width])
  // One per drawing: the panel's chart and the popped-out one can be on screen at once.
  const reactId = useId()
  // React's ids carry punctuation a `url(#…)` reference may not parse; keep the word characters.
  const arrowId = `reach-dim-arrow-${reactId.replace(/[^\w-]/g, '')}`
  const reading = hover === null ? null : readingAt(whole, hover)
  // Held as one element, so a pointer move redraws the reading and not the section under it.
  const drawing = useMemo(
    () => (
      <>
        <Arrows id={arrowId} />
        <SectionShapes geometry={geometry} />
        <SectionHeadings geometry={geometry} />
        <FeatureBreak geometry={geometry} />
        <FeatureDepth geometry={geometry} units={units} />
        <OffsetOrdinates geometry={geometry} units={units} arrowId={arrowId} />
        <HeightOrdinates geometry={geometry} units={units} />
      </>
    ),
    [arrowId, geometry, units],
  )

  return (
    <svg
      viewBox={`0 0 ${width} ${geometry.height}`}
      width={width}
      height={geometry.height}
      className="select-none"
      role="img"
      aria-label="Reach curve, dimensioned"
      onPointerMove={(event) =>
        setHover(offsetUnder(event.clientX, event.currentTarget.getBoundingClientRect(), geometry))
      }
      onPointerLeave={() => setHover(null)}
    >
      {drawing}
      {reading ? <ReadingMark geometry={geometry} reading={reading} units={units} /> : null}
    </svg>
  )
}
