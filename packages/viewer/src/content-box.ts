import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Box3 } from 'three'
import { partBounds } from './render/camera.js'

/**
 * The bounds of the part, for the overlays that have to be sized against it.
 *
 * Measured on a frame rather than in an effect, because a Suspense-loaded mesh
 * does not exist yet when the effects around it run — the same reason the
 * viewer's opening frame waits. Measured once: an overlay that re-fitted itself
 * while the part was being orbited would be a grid that breathes.
 *
 * Scene furniture and stock are excluded, so tools stay sized to the finished part.
 */
export function useContentBox(): Box3 {
  const scene = useThree((state) => state.scene)
  const [box, setBox] = useState(() => new Box3())
  const measured = useRef(false)

  useFrame(() => {
    if (measured.current) return
    const next = new Box3()
    partBounds(scene, next)
    if (next.isEmpty()) return
    measured.current = true
    setBox(next)
  })

  return box
}
