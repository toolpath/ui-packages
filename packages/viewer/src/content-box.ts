import { useFrame, useThree } from '@react-three/fiber'
import { type RefObject, useContext, useRef, useState } from 'react'
import { Box3, type Object3D } from 'three'
import { boxMoved, partBounds } from './render/camera.js'
import { CollectionBoundsContext } from './collection-context.js'

const EMPTY = new Box3()

export interface ContentBoxOptions {
  /**
   * Measured in this object's own coordinates rather than the scene's. An
   * overlay drawn inside the group that turns the part passes its own group: a
   * box measured on screen while the part was turned puts the overlay round
   * where the part was, not round the part.
   */
  frame?: RefObject<Object3D | null>
  /**
   * Measured again whenever the part has moved, rather than once — taken once it
   * holds still, not on every frame of a turn. For overlays drawn in the scene's
   * coordinates round a part that turns — a ground grid stays under the part as
   * it is held now. Orbiting moves the camera, not the part, so the grid still
   * does not breathe as the part is looked round.
   */
  live?: boolean
}

/**
 * The bounds of the part, for the overlays that have to be sized against it.
 *
 * Measured on a frame rather than in an effect, because a Suspense-loaded mesh
 * does not exist yet when the effects around it run — the same reason the
 * viewer's opening frame waits. Measured once unless `live`.
 *
 * Scene furniture and stock are excluded, so tools stay sized to the finished part.
 */
export function useContentBox({ frame, live = false }: ContentBoxOptions = {}): Box3 {
  const collection = useContext(CollectionBoundsContext)
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  const [box, setBox] = useState(() => new Box3())
  const measured = useRef<Box3 | null>(null)

  // Measured into one box, kept only once it has moved: a live box is asked for every frame.
  const scratch = useRef(new Box3())
  // A live box that moved, waiting to hold still for a frame: a part turning moves it every frame,
  // and what is sized to it would be rebuilt for each.
  const moving = useRef<Box3 | null>(null)
  useFrame(() => {
    if (collection || (measured.current && !live)) return
    if (frame && !frame.current) return
    partBounds(scene, scratch.current, frame?.current)
    if (!boxMoved(measured.current ?? EMPTY, scratch.current)) {
      moving.current = null
      return
    }
    if (measured.current && (!moving.current || boxMoved(moving.current, scratch.current))) {
      moving.current = scratch.current.clone()
      // One frame more, to see it hold still: a turn's last frame asks for no other.
      invalidate()
      return
    }
    const next = scratch.current.clone()
    moving.current = null
    measured.current = next
    setBox(next)
  })

  return collection ?? box
}
