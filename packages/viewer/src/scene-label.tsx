import { Html } from '@react-three/drei'
import type { CSSProperties } from 'react'
import type { Vector3 } from 'three'
import { MEASURE_LABEL_CLASS } from './measure-tool.js'

export interface SceneLabelProps {
  position: Vector3 | readonly [number, number, number]
  text: string
  note?: string
  /** `data-measure-label` */
  kind: string
  /** `data-axis` */
  axis?: 'x' | 'y' | 'z'
  /** `data-measurement-id` */
  measurementId?: string
  /** Web: sets `--measure-color`. Native: the label's border colour. */
  color?: string
  /** Web only: added after {@link MEASURE_LABEL_CLASS}. */
  className?: string
  /** Web: drei's `zIndexRange` is `[layer, 0]`. Default 0. */
  layer?: number
  /** Native only. Web consumers handle label clicks in the DOM, as they do today. */
  onPress?: () => void
}

/**
 * A text label pinned to a point in the scene.
 *
 * On the web it is an unstyled DOM element over the canvas, through drei's
 * `<Html>`: the {@link MEASURE_LABEL_CLASS} class plus `className`, with
 * `data-measure-label`, `data-axis` and `data-measurement-id` for styling, the
 * text in a `data-measure-value` span and the note in a `data-measure-note`
 * one. It takes no pointer events, so the canvas under it keeps the gesture.
 */
export const SceneLabel = ({
  position,
  text,
  note,
  kind,
  axis,
  measurementId,
  color,
  className,
  layer,
}: SceneLabelProps) => (
  <Html
    position={position as Vector3}
    center
    zIndexRange={[layer ?? 0, 0]}
    pointerEvents="none"
    style={{ pointerEvents: 'none' }}
  >
    <div
      className={[MEASURE_LABEL_CLASS, className].filter(Boolean).join(' ')}
      data-measure-label={kind}
      data-axis={axis}
      data-measurement-id={measurementId}
      style={color ? ({ '--measure-color': color } as CSSProperties) : undefined}
    >
      <span data-measure-value>{text}</span>
      {note ? <span data-measure-note> {note}</span> : null}
    </div>
  </Html>
)
