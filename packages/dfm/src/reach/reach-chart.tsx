import { useMemo, type FC, type ReactElement } from 'react'
import { trimmedCurve } from '../model/reach.js'
import { lengthValue, unitLabel } from '../model/units.js'
import { ReachSection } from './reach-section.js'
import type { ReachChartProps } from './types.js'
import { useElementSize } from './use-element-size.js'

/*
 * The reach curve drawn: the section through the part at the wall, to scale
 * and dimensioned as a drawing is, in a panel or in a larger window of its
 * own. Pointing at the material reads the curve off at that offset.
 *
 * As `model/reach.ts` reads the curve: material within `offsets[i]` of the
 * feature rises to `heights[i]` above it, the rise coming at the start of
 * each run, just past the knot before, and the last height held past the
 * last knot. The section stops half an inch past where the material reaches
 * its full height (`trimmedCurve`): the Engine reads a long way out, and once
 * the material is level there is nothing more to see.
 */

/** The narrowest the section is drawn, CSS pixels, before its container is measured. */
const CHART_MIN_W = 200
const DRAWING_MIN_W = 240

/**
 * The section alone, as a panel shows it: dimensioned, as wide as the panel
 * gives it.
 */
export const ReachChart: FC<ReachChartProps> = ({ curve, units, feature }): ReactElement => {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className="w-full">
      <ReachSection
        curve={curve}
        units={units}
        feature={feature}
        width={Math.max(size.width, CHART_MIN_W)}
      />
    </div>
  )
}

/** Where the drawing stops, when it was cut off past full height, and how far the Engine read. */
const CutNote: FC<Pick<ReachChartProps, 'curve' | 'units'>> = ({
  curve,
  units,
}): ReactElement | null => {
  const trimmed = useMemo(() => trimmedCurve(curve), [curve])
  if (!trimmed.cut) return null
  const drawnTo = trimmed.curve.offsets[trimmed.curve.offsets.length - 1] ?? 0
  const readTo = curve.offsets[curve.offsets.length - 1] ?? 0
  return (
    <>
      {' '}
      It is at full height from {lengthValue(drawnTo, units)} {unitLabel(units)} out, so the drawing
      stops there; the Engine read it to {lengthValue(readTo, units)} {unitLabel(units)}.
    </>
  )
}

/** A larger window's contents: the section, large, with what it is and how to read it. */
export const ReachDrawing: FC<ReachChartProps> = ({ curve, units, feature }): ReactElement => {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className="flex flex-col gap-3 p-4">
      <figure className="flex flex-col gap-1">
        <figcaption className="text-2xs font-semibold text-gray-400 uppercase dark:text-zinc-500">
          Section at the wall · to scale · {unitLabel(units)}
        </figcaption>
        <ReachSection
          curve={curve}
          units={units}
          feature={feature}
          width={Math.max(size.width, DRAWING_MIN_W)}
        />
      </figure>
      <p className="text-2xs text-gray-400 dark:text-zinc-500">
        Point at the walls to read them: the distance from the feature, then the reach a tool needs
        there.
        <CutNote curve={curve} units={units} />
      </p>
    </div>
  )
}
