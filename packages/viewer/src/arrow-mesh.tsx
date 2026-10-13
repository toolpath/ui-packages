import { type EventHandlers, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'
import {
  applyArrowColor,
  createArrowDepthMaterial,
  createArrowMaterial,
  createDepthResetMaterial,
} from './render/arrow-material.js'

interface ArrowMeshProps {
  geometry: BufferGeometry
  color: number
  opacity: number
  /**
   * Drawn over the part rather than behind it: a preview being aimed, or a
   * handle that has to be found wherever the cut is.
   */
  onTop?: boolean
  /** On the colour pass, the one mesh here a ray can hit. */
  events?: EventHandlers
}

/**
 * One shaded arrow, as the passes that draw it: clear the depth under it when
 * it is drawn on top, lay down its own front, then colour that front.
 *
 * Placed, aimed and sized by the group it sits in, whose render order keeps
 * the passes together; their own render orders keep them in sequence.
 * Re-coloured rather than rebuilt, so a hover or a drag at interaction rate
 * costs a uniform.
 */
export const ArrowMesh = ({ geometry, color, opacity, onTop = false, events }: ArrowMeshProps) => {
  const invalidate = useThree((state) => state.invalidate)

  const material = useMemo(() => createArrowMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  const depth = useMemo(() => createArrowDepthMaterial(), [])
  useEffect(() => () => depth.dispose(), [depth])
  const reset = useMemo(() => (onTop ? createDepthResetMaterial() : null), [onTop])
  useEffect(() => () => reset?.dispose(), [reset])

  useLayoutEffect(() => {
    applyArrowColor(material, color, opacity)
    invalidate()
  }, [color, invalidate, material, opacity])

  return (
    <>
      {reset ? (
        <mesh geometry={geometry} material={reset} renderOrder={0} raycast={() => null} />
      ) : null}
      <mesh geometry={geometry} material={depth} renderOrder={1} raycast={() => null} />
      <mesh geometry={geometry} material={material} renderOrder={2} {...events} />
    </>
  )
}
