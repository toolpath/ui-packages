import { useEffect, useMemo } from 'react'
import type { ViewerTheme } from './render/theme.js'
import { glyphLabelGeometry } from './render/view-cube-glyph-label.js'
import type { CubeZone } from './render/view-cube.js'

export interface CubeLabelProps {
  /** A face of the cube; edges and corners carry no name. */
  zone: CubeZone
  theme: ViewerTheme
}

/**
 * React Native's face name on the view cube: the name as flat glyph geometry
 * lying on the face, since there is no 2D canvas to draw a texture with.
 */
export const CubeLabel = ({ zone, theme }: CubeLabelProps) => {
  const geometry = useMemo(() => glyphLabelGeometry(zone), [zone])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshBasicMaterial color={theme.cubeLabel} />
    </mesh>
  )
}
