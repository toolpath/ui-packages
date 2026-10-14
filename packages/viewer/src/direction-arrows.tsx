import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { type Box3, type BufferGeometry, Quaternion, Vector3 } from 'three'
import type { Vec3 } from './model/types.js'
import { ArrowMesh } from './arrow-mesh.js'
import { useContentBox } from './content-box.js'
import { ARROW_AXIS, arrowGeometry } from './render/arrow.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { arrowPlacement } from './render/directions.js'
import { type ViewerTheme, directionColor, resolveTheme } from './render/theme.js'

const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

export interface NamedDirection {
  readonly direction: Vec3
  readonly color: number
  readonly index: number
}

export interface DirectionArrowsProps {
  /**
   * The ways up the part can be held — a report's `candidateDirections`.
   *
   * The directions rather than the report: an arrow is drawn from a unit vector
   * and the part's bounds, and nothing else about a part is needed to place one.
   */
  directions: readonly Vec3[]
  /**
   * Shows one direction on its own. Choosing a direction is a way of asking
   * about that direction, so the others leave rather than dimming: five faded
   * arrows still cross the part, still hide surfaces behind them, and still
   * read as choices when only one is being asked about.
   */
  activeDirection?: number | null
  /**
   * Which arrows are drawn, without scoping anything: `null` for all of them,
   * an index for one, `-1` for none — and **a list of indices for a set**, which
   * is how a plan draws only the ways up it has confirmed.
   *
   * One prop rather than a singular and a plural, because two would need a rule
   * about which wins, and a caller with an answer to give should not also have
   * to say where to put it. Falls back to `activeDirection`.
   */
  shownDirection?: number | readonly number[] | null
  /**
   * A direction being named, drawn while it is aimed. Not a candidate and not a
   * selection: a way up that does not exist yet, so it is drawn over the part —
   * an arrow being aimed that hides behind the geometry looks like it has
   * stopped responding.
   */
  previewDirection?: Vec3 | null
  /**
   * Ways up that are held but were never candidates. A direction somebody named
   * is as real as one the Engine proposed, and without an arrow it is a row in a
   * list describing an orientation nothing on the part shows.
   */
  namedDirections?: readonly NamedDirection[]
  onPickDirection?: (index: number) => void
  theme?: Partial<ViewerTheme>
  visible?: boolean
}

/**
 * One arrow per candidate direction, pointing at the part.
 *
 * Aimed *inward* on purpose: a machining direction is the direction the tool
 * comes from, so an arrow flying toward the surface reads as the setup rather
 * than as a surface normal.
 */
export const DirectionArrows = ({
  directions,
  activeDirection = null,
  shownDirection,
  previewDirection = null,
  namedDirections = [],
  onPickDirection,
  theme,
  visible = true,
}: DirectionArrowsProps) => {
  const box = useContentBox()
  const resolved = useMemo(() => resolveTheme(theme), [theme])
  // One arrow, one long, shared by every arrow drawn: each is placed, aimed and
  // scaled, and none is ever rebuilt.
  const geometry = useMemo(() => arrowGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const shown = shownDirection === undefined ? activeDirection : shownDirection
  /** Whether this candidate is one of the ones asked for. */
  const drawn = (index: number): boolean => {
    if (shown === null) return true
    if (typeof shown === 'number') return shown === index
    return shown.includes(index)
  }

  if (!visible) return null

  return (
    // Excluded from framing: the arrows are deliberately placed outside the
    // part, so a Fit that measured them would frame the arrows and leave the
    // part small in the middle of them.
    <group userData={FURNITURE}>
      {directions.map((direction, index) => {
        if (!drawn(index)) return null
        return (
          <Arrow
            key={`candidate-${index}`}
            direction={direction}
            box={box}
            geometry={geometry}
            color={directionColor(index)}
            opacity={0.9}
            onPick={onPickDirection ? () => onPickDirection(index) : undefined}
          />
        )
      })}
      {namedDirections.map((named) => (
        <Arrow
          key={`named-${named.index}`}
          direction={named.direction}
          box={box}
          geometry={geometry}
          color={named.color}
          opacity={0.9}
          onPick={onPickDirection ? () => onPickDirection(named.index) : undefined}
        />
      ))}
      {previewDirection ? (
        <Arrow
          direction={previewDirection}
          box={box}
          geometry={geometry}
          color={resolved.hover}
          opacity={0.95}
          onTop
        />
      ) : null}
    </group>
  )
}

interface ArrowProps {
  direction: Vec3
  box: Box3
  geometry: BufferGeometry
  color: number
  opacity: number
  onPick?: () => void
  onTop?: boolean
}

const Arrow = ({ direction, box, geometry, color, opacity, onPick, onTop = false }: ArrowProps) => {
  const invalidate = useThree((state) => state.invalidate)
  // Re-aimed rather than rebuilt as the angle changes: a preview drags at
  // interaction rate, and tearing down a mesh per frame is how one stutters.
  const { tip, length, quaternion } = useMemo(() => {
    const placement = arrowPlacement(direction, box)
    const aim = new Quaternion().setFromUnitVectors(
      ARROW_AXIS,
      new Vector3(direction.x, direction.y, direction.z).normalize(),
    )
    return { tip: placement.tip, length: placement.length, quaternion: aim }
  }, [box, direction])

  // Propagation stops at the arrow: the part is behind it, and a press that
  // reached the part as well would change the selection along with the
  // direction.
  const press = onPick
    ? {
        onClick: (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          onPick()
          invalidate()
        },
      }
    : {}

  return (
    <group position={tip} quaternion={quaternion} scale={length} renderOrder={onTop ? 10 : 3}>
      <ArrowMesh geometry={geometry} color={color} opacity={opacity} onTop={onTop} events={press} />
    </group>
  )
}
