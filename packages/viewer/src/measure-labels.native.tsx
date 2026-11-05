import { useFrame } from '@react-three/fiber'
import { type FC, useRef } from 'react'
import {
  type Mesh,
  type OrthographicCamera,
  type PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three'
import { MEASURE_RENDER_ORDER, type LabelPress, type MeasureLabelKind } from './render/measure.js'
import { SceneLabel, type SceneLabelProps } from './scene-label.js'

/**
 * React Native's `measure-labels.tsx`: there is no DOM to lay labels over the
 * canvas with, so a label is the frame's `SceneLabel`, and a point picked is
 * a dot drawn in the scene.
 */

/** A label as the tool reads it out (`measure-readout.tsx`). */
export interface MeasureLabelProps {
  at: Vector3
  text: string
  kind: MeasureLabelKind
  axis?: 'x' | 'y' | 'z'
  /** Its measurement's colour, CSS; none for a distance's leg, which wears its axis's. */
  color?: string
  /** Ignored: there is no DOM to style. */
  labelClass: string
  /** Makes the label pressable. */
  onPress?: () => void
  /** What pressing it does, for a screen reader (`SceneLabel`'s `accessibilityHint`). */
  hint?: string
}

/**
 * The native `SceneLabel`, with its press. Typed for both checks: the web
 * one reads `scene-label.tsx` here, whose label takes no press.
 */
const PressableLabel: FC<SceneLabelProps & { onPress?: () => void; accessibilityHint?: string }> =
  SceneLabel

/**
 * A measure label, drawn by the native frame as a view over the canvas. It
 * is pressable only with `onPress`, and `hint` tells a screen reader what a
 * press does, which the app decides; without one it hears the label's text
 * and "button" alone.
 */
export const MeasureLabel = ({ at, text, kind, axis, color, onPress, hint }: MeasureLabelProps) => (
  <PressableLabel
    position={at}
    text={text}
    kind={kind}
    axis={axis}
    color={color}
    onPress={onPress}
    accessibilityHint={hint}
  />
)

/** The dot's diameter on screen, points: the web's 10 CSS pixels. */
const DOT_POINTS = 10

/** How much of the world one point on screen spans at `distance` from the camera. */
const worldPerPoint = (
  camera: PerspectiveCamera | OrthographicCamera,
  distance: number,
  height: number,
): number =>
  'isPerspectiveCamera' in camera && camera.isPerspectiveCamera
    ? (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / height
    : ((camera as OrthographicCamera).top - (camera as OrthographicCamera).bottom) /
      (camera as OrthographicCamera).zoom /
      height

const scratchPosition = new Vector3()
const scratchTurn = new Quaternion()

const ignoreRay = (): void => undefined

/**
 * A point picked: a dot in its measurement's colour, facing the camera and
 * drawn over the part and the measurement's lines, a set size on screen
 * however far off. Turned and sized each frame from the camera alone.
 */
export const PointMarker = ({ at, color }: { at: Vector3; color: number }) => {
  const ref = useRef<Mesh>(null)
  useFrame(({ camera, size }) => {
    const dot = ref.current
    if (!dot) return
    // Facing the camera in the world, whatever its parent's turn.
    const parent = dot.parent
    const turn = parent ? parent.getWorldQuaternion(scratchTurn).invert() : scratchTurn.identity()
    dot.quaternion.copy(turn).multiply(camera.quaternion)
    const distance = camera.position.distanceTo(dot.getWorldPosition(scratchPosition))
    const view = camera as PerspectiveCamera | OrthographicCamera
    dot.scale.setScalar((DOT_POINTS / 2) * worldPerPoint(view, distance, size.height))
  })
  return (
    <mesh ref={ref} position={at} renderOrder={MEASURE_RENDER_ORDER + 2} raycast={ignoreRay}>
      <circleGeometry args={[1, 20]} />
      <meshBasicMaterial color={color} depthTest={false} transparent />
    </mesh>
  )
}

/** Nothing beside the labels: a native label is pressed by itself, and labels are not moved apart. */
export const MeasureLabelChrome = (_props: { onPress?: (label: LabelPress) => void }): null => null
