import { Html } from '@react-three/drei'
import type { CSSProperties } from 'react'
import type { Vector3 } from 'three'
import { MEASURE_LABEL_CLASS } from './render/measure.js'

export interface SceneLabelProps {
  position: Vector3 | [number, number, number]
  text: string
  note?: string
  /** Web: `data-measure-label`. Native: the label's `testID`, `scene-label-<kind>`. */
  kind: string
  /** `data-axis` */
  axis?: 'x' | 'y' | 'z'
  /** Web: sets `--measure-color`. Native: the label's border colour. */
  color?: string
  /** Web only: added after {@link MEASURE_LABEL_CLASS}. */
  className?: string
  /** Web: drei's `zIndexRange` is `[layer, 0]`. Default 0. */
  layer?: number
}

/**
 * A text label pinned to a point in the scene.
 *
 * On the web it is an unstyled DOM element over the canvas, through drei's
 * `<Html>`: the {@link MEASURE_LABEL_CLASS} class plus `className`, with
 * `data-measure-label` and `data-axis` for styling, the text in a
 * `data-measure-value` span and the note in a `data-measure-note` one. It takes no pointer events, so the canvas under it keeps the gesture.
 */
export const SceneLabel = ({
  position,
  text,
  note,
  kind,
  axis,
  color,
  className,
  layer,
}: SceneLabelProps) => (
  <Html position={position} center zIndexRange={[layer ?? 0, 0]} style={{ pointerEvents: 'none' }}>
    <div
      className={[MEASURE_LABEL_CLASS, className].filter(Boolean).join(' ')}
      data-measure-label={kind}
      data-axis={axis}
      style={color ? ({ '--measure-color': color } as CSSProperties) : undefined}
    >
      <span data-measure-value>{text}</span>
      {note ? <span data-measure-note> {note}</span> : null}
    </div>
  </Html>
)
