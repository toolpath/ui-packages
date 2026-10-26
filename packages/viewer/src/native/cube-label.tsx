import { useEffect, useMemo } from 'react'
import type { CubeLabelProps } from '../cube-label.js'
import { glyphLabelGeometry } from '../render/view-cube-glyph-label.js'

export type { CubeLabelProps } from '../cube-label.js'

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
