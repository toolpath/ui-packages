import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Group, Object3D } from 'three'
import { EXCLUDE_FROM_FRAME } from './render/camera.js'
import { createRayMask } from './render/visibility.js'

/**
 * Keeps what `root` holds out of raycasts while `hidden`, as of every render, and puts it back
 * once shown or unmounted.
 */
export const useHiddenFromRays = (root: RefObject<Object3D | null>, hidden: boolean) => {
  const [mask] = useState(createRayMask)
  useLayoutEffect(() => {
    if (hidden && root.current) {
      mask.hide(root.current)
    } else if (!hidden) {
      mask.show()
    }
  })
  useLayoutEffect(() => () => mask.show(), [mask])
}

export interface VisibilityGroupProps {
  /** False hides what it holds from drawing, framing and picking, and keeps it mounted. */
  visible: boolean
  children?: ReactNode
}

/**
 * A group that hides what it holds without unmounting it: not drawn, left out of Fit, and out
 * of every raycast, so its state and paint come back as they were. For what an application
 * draws beside a part it hides, such as stock and direction arrows while it is exploded.
 */
export const VisibilityGroup = ({ visible, children }: VisibilityGroupProps) => {
  const root = useRef<Group>(null)
  useHiddenFromRays(root, !visible)
  return (
    <group ref={root} visible={visible} userData={{ [EXCLUDE_FROM_FRAME]: !visible }}>
      {children}
    </group>
  )
}
