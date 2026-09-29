import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, type BufferGeometry, type Group, type Mesh } from 'three'
import { useContentBox } from './content-box.js'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { bananaFrameBounds, bananaPosition } from './render/banana.js'

/** The six-inch (154 mm) reference model bundled with `@toolpath/viewer`. */
export const BANANA_MODEL_URL = new URL('./assets/banana.glb', import.meta.url).href

const SKIN = '#e8b530'
const FURNITURE = { [EXCLUDE_FROM_FRAME]: true }

export interface BananaProps {
  /** Bounds of the part and placed banana, for `ViewerHandle.frameBox`. */
  onPlaced?: (bounds: Box3) => void
}

/**
 * A 154 mm banana beside the part, for immediate visual scale.
 *
 * It is excluded from normal part framing and overlay placement. Applications
 * can use `onPlaced` to intentionally frame the comparison together. The model
 * is fetched only when this component is mounted.
 */
export const Banana = ({ onPlaced }: BananaProps) => {
  const part = useContentBox()
  const invalidate = useThree((state) => state.invalidate)
  const gltf = useGLTF(BANANA_MODEL_URL)
  const group = useRef<Group>(null)

  const geometry = useMemo(() => {
    let found: BufferGeometry | null = null
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh
      if (found === null && mesh.isMesh) found = mesh.geometry
    })
    const source = found as BufferGeometry | null
    if (!source) return null

    const own = source.clone()
    own.computeVertexNormals()
    own.rotateY(Math.PI / 2)
    own.rotateX(Math.PI / 2)
    own.computeBoundingBox()
    return own
  }, [gltf])

  useLayoutEffect(() => {
    const node = group.current
    const own = geometry?.boundingBox
    if (!node || !own || part.isEmpty()) return

    const position = bananaPosition(part, own)
    node.position.copy(position)
    // The content bounds arrive one frame after a Suspense-loaded part. Until
    // then the group would render at its default origin, briefly inside the
    // part, before this placement effect could move it beside the part.
    node.visible = true
    node.updateWorldMatrix(true, true)
    onPlaced?.(bananaFrameBounds(part, own, position))
    invalidate()
  }, [geometry, invalidate, onPlaced, part])

  if (!geometry) return null

  return (
    <group ref={group} userData={FURNITURE} visible={false}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={SKIN} roughness={0.85} metalness={0} />
      </mesh>
    </group>
  )
}
