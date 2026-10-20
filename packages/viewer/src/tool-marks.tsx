import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { MEASURE_LINE_PIXELS, MEASURE_RENDER_ORDER } from './render/measure.js'
import { type ViewerTheme, resolveTheme } from './render/theme.js'
import { type ToolMark, type ToolMarkShape, toolMarkShape } from './render/tool-marks.js'
import { SceneLabel } from './scene-label.js'

export interface ToolMarksProps {
  /** The tools to draw, in the coordinates the part is drawn in. */
  marks: readonly ToolMark[]
  /** Draws nothing while false, and keeps its place in the scene. On by default. */
  visible?: boolean
  /**
   * Added to every label's `className`, beside `MEASURE_LABEL_CLASS` —
   * a Tailwind utility list, or a CSS module's class.
   */
  labelClassName?: string
  /** `measure` colours the rims and the dimension, as it does the measure tool's lines. */
  theme?: Partial<ViewerTheme>
}

/** The tool itself: pale and see-through, so what it stands in shows through it. */
const BODY = { color: 0xf8fafc, opacity: 0.32 } as const
const ignoreRay = (): void => undefined

/**
 * Cutting tools drawn on the part, each to scale where it stands: a
 * see-through end mill — flat, bull nose or ball — or any tool turned from its
 * `profile`, rimmed at its bottom and top, with a dimension across its top and
 * a label on it. Mount it inside
 * `<Viewer>`, beside or inside the part.
 *
 * What a tool stands for is the caller's. A DFM panel stands the widest tool
 * a pocket admits in its tightest place; a plan could show the tool an
 * operation uses. Nothing here reads a datasheet.
 *
 * Drawn as the measure tool draws: the lines show through the part, in the
 * theme's `measure` colour, and the labels are unstyled DOM elements with the
 * `MEASURE_LABEL_CLASS` class and `data-measure-label="tool"`, the
 * label's text in a `data-measure-value` span and its note in a
 * `data-measure-note` one. The marks take no pointer events and are left out
 * of framing, so fitting the view fits the part.
 */
export const ToolMarks = ({ marks, visible = true, labelClassName, theme }: ToolMarksProps) => {
  const color = resolveTheme(theme).measure
  const shapes = useMemo(
    () =>
      marks.flatMap((mark) => {
        const shape = toolMarkShape(mark)
        return shape ? [{ mark, shape }] : []
      }),
    [marks],
  )
  return (
    <group visible={visible} userData={{ [EXCLUDE_FROM_FRAME]: true }}>
      {shapes.map(({ mark, shape }, index) => (
        <group key={index}>
          <ToolBody shape={shape} />
          {[...shape.rims, shape.dimension, ...shape.ticks].map((points, line) => (
            <Line
              key={line}
              points={points}
              color={color}
              lineWidth={MEASURE_LINE_PIXELS.line}
              depthTest={false}
              depthWrite={false}
              renderOrder={MEASURE_RENDER_ORDER}
              raycast={ignoreRay}
            />
          ))}
          {mark.label && visible ? (
            <SceneLabel
              kind="tool"
              position={shape.labelAt}
              text={mark.label}
              note={mark.note}
              className={labelClassName}
            />
          ) : null}
        </group>
      ))}
    </group>
  )
}

const ToolBody = ({ shape }: { shape: ToolMarkShape }) => (
  <mesh
    position={shape.base}
    quaternion={shape.turn}
    raycast={ignoreRay}
    renderOrder={MEASURE_RENDER_ORDER - 1}
  >
    <latheGeometry args={[shape.profile, 64]} />
    <meshBasicMaterial
      color={BODY.color}
      transparent
      opacity={BODY.opacity}
      depthWrite={false}
      side={DoubleSide}
    />
  </mesh>
)
