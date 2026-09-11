import { GizmoHelper } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { useContentBox } from './content-box.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { gridFor } from './render/grid.js'
import { type ViewerTheme, resolveTheme } from './render/theme.js'
import {
  type CubeZone,
  type ViewName,
  cubeOutlineGeometry,
  cubeZones,
  labelGeometry,
  labelTexture,
  panelGeometry,
  viewVector,
} from './render/view-cube.js'
import { useViewerControls } from './viewer.js'

const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

export interface GridProps {
  /** Cell size in millimetres. Sized from the scene when omitted. */
  step?: number
  extent?: number
  color?: string | number
  opacity?: number
}

/**
 * A ground grid on the part's base plane, sized to the part.
 *
 * Measured from whatever else is in the scene rather than given a fixed size:
 * the Engine emits millimetres but says nothing about scale, and a grid of
 * fixed cells is either invisible on a 900 mm plate or a solid wash under a
 * 12 mm insert.
 */
export const Grid = ({ step, extent, color, opacity = 0.35 }: GridProps) => {
  const theme = resolveTheme()
  const box = useContentBox()

  // `null` until the scene has been measured: `useContentBox` hands back an
  // empty box on the first frame, and a grid sized from one is built at
  // infinity — three.js logs "Computed radius is NaN" for it.
  const geometry = useMemo(() => gridFor(box, { step, extent }), [box, extent, step])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null

  return (
    <lineSegments geometry={geometry} renderOrder={-1} raycast={() => null} userData={FURNITURE}>
      <lineBasicMaterial color={color ?? theme.cubeEdge} transparent opacity={opacity} />
    </lineSegments>
  )
}

export interface AxesProps {
  size?: number
}

export const Axes = ({ size = 25 }: AxesProps) => (
  <axesHelper args={[size]} userData={FURNITURE} raycast={() => null} />
)

export interface ViewCubeProps {
  alignment?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  margin?: [number, number]
  theme?: Partial<ViewerTheme>
  /** Called with the view a panel was clicked for, after the camera moves. */
  onViewChange?: (view: ViewName) => void
}

/**
 * The orientation cube, in the corner of the viewport.
 *
 * Twenty-six clickable panels rather than six: the chamfers between faces are
 * the edge and corner views, which is how you reach an isometric without
 * dragging for it. A drei `GizmoViewport` gives three labelled axes and no
 * views at all.
 */
export const ViewCube = ({
  alignment = 'top-right',
  margin = [80, 80],
  theme,
  onViewChange,
}: ViewCubeProps) => {
  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const zones = useMemo(() => cubeZones(), [])

  return (
    <GizmoHelper alignment={alignment} margin={margin}>
      <CubePanels zones={zones} theme={resolved} onViewChange={onViewChange} />
    </GizmoHelper>
  )
}

const CubePanels = ({
  zones,
  theme,
  onViewChange,
}: {
  zones: readonly CubeZone[]
  theme: ViewerTheme
  onViewChange?: (view: ViewName) => void
}) => {
  const controls = useViewerControls()
  const invalidate = useThree((state) => state.invalidate)
  const groupRef = useRef<Group>(null)
  const [hovered, setHovered] = useState<ViewName | null>(null)

  const panels = useMemo(
    () => zones.map((zone) => ({ zone, geometry: panelGeometry(zone) })),
    [zones],
  )
  const outline = useMemo(() => cubeOutlineGeometry(zones), [zones])
  const labels = useMemo(
    () =>
      zones
        .filter((zone) => zone.kind === 'face')
        .map((zone) => ({
          zone,
          geometry: labelGeometry(zone),
          texture: labelTexture(zone.name, theme.cubeLabel),
        })),
    [theme.cubeLabel, zones],
  )

  useEffect(
    () => () => {
      for (const panel of panels) panel.geometry.dispose()
      for (const label of labels) {
        label.geometry.dispose()
        label.texture.dispose()
      }
      outline.dispose()
    },
    [labels, outline, panels],
  )

  const choose = (zone: CubeZone) => {
    controls.setViewDirection(zone.direction)
    onViewChange?.(zone.name)
  }

  const hover = (name: ViewName | null) => {
    setHovered(name)
    invalidate()
  }

  return (
    <group ref={groupRef} scale={38}>
      {panels.map(({ zone, geometry }) => (
        <mesh
          key={zone.name}
          geometry={geometry}
          onPointerOver={(event) => {
            event.stopPropagation()
            hover(zone.name)
          }}
          onPointerOut={() => hover(null)}
          onClick={(event) => {
            event.stopPropagation()
            choose(zone)
          }}
        >
          <meshLambertMaterial
            color={hovered === zone.name ? theme.hover : theme.cube}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ))}
      {labels.map(({ zone, geometry, texture }) => (
        <mesh key={`${zone.name}-label`} geometry={geometry} raycast={() => null}>
          {/* Basic rather than lambert: shading a label makes the same word
              darker on whichever faces the key light misses, which on a control
              reads as a rendering fault rather than as depth. */}
          <meshBasicMaterial map={texture} transparent />
        </mesh>
      ))}
      <lineSegments geometry={outline} raycast={() => null}>
        <lineBasicMaterial color={theme.cubeEdge} />
      </lineSegments>
      <ambientLight intensity={1.4} />
      <directionalLight position={[viewVector('top-front-right').x, 1, 2]} intensity={1.1} />
    </group>
  )
}
