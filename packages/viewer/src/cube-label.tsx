import { useEffect, useMemo } from 'react'
import { labelTexture } from './render/label-texture.js'
import type { ViewerTheme } from './render/theme.js'
import { type CubeZone, labelGeometry } from './render/view-cube.js'

export interface CubeLabelProps {
  /** A face of the cube; edges and corners carry no name. */
  zone: CubeZone
  theme: ViewerTheme
}

/**
 * A face's name on the view cube: on the web, a canvas texture on a quad just
 * proud of the face, set in the theme's `cubeLabel` colour.
 */
export const CubeLabel = ({ zone, theme }: CubeLabelProps) => {
  const geometry = useMemo(() => labelGeometry(zone), [zone])
  const texture = useMemo(() => labelTexture(zone.name, theme.cubeLabel), [theme.cubeLabel, zone])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh geometry={geometry} raycast={() => null}>
      {/* Basic rather than lambert: shading a label makes the same word
          darker on whichever faces the key light misses, which on a control
          reads as a rendering fault rather than as depth. */}
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}
