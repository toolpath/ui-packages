import type { ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPickGestures, type PickGestureRules } from './render/pick-gestures.js'
import { useTapGuard } from './tap.js'
import { useRetarget } from './viewer.js'

/** The rules an object states for itself; the tap guard and re-aim come from the viewer. */
type PickGestureOptions<P> = Omit<PickGestureRules<ThreeEvent<MouseEvent>, P>, 'isTap' | 'retarget'>

/**
 * Pointer handlers for a pickable object, following the rules in `render/pick-gestures.ts`.
 * Spread them onto the object. They keep one identity and read this render's `options`.
 */
export const usePickGestures = <P>(options: PickGestureOptions<P>) => {
  const isTap = useTapGuard()
  const retarget = useRetarget()
  const latest = useRef({ ...options, isTap, retarget })
  useLayoutEffect(() => {
    latest.current = { ...options, isTap, retarget }
  })
  const [gestures] = useState(() => createPickGestures(() => latest.current))
  return gestures
}
