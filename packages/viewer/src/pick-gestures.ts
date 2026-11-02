import type { ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPickGestures, type PickGestureRules } from './render/pick-gestures.js'
import { POINTER_HOVER } from './render/pointer-hover.js'
import { useTapGuard } from './tap.js'
import { useRetarget } from './viewer.js'

/** The rules an object states for itself; the tap guard and re-aim come from the viewer. */
type PickGestureOptions<P> = Omit<PickGestureRules<ThreeEvent<MouseEvent>, P>, 'isTap' | 'retarget'>

type PickGestures<P> = ReturnType<typeof createPickGestures<ThreeEvent<MouseEvent>, P>>
type HoverHandler = 'onPointerMove' | 'onPointerOut'

/**
 * Pointer handlers for a pickable object, following the rules in `render/pick-gestures.ts`.
 * Spread them onto the object. They keep one identity and read this render's `options`.
 *
 * The hover pair is left out where the pointer does not hover (`render/pointer-hover.ts`): each
 * has fiber raycast the object on every pointer move. Without them a tap on a panel between two
 * taps on a face can't break the pair, but with a finger that is three taps inside 400 ms.
 */
export const usePickGestures = <P>(
  options: PickGestureOptions<P>,
): Omit<PickGestures<P>, HoverHandler> & Partial<Pick<PickGestures<P>, HoverHandler>> => {
  const isTap = useTapGuard()
  const retarget = useRetarget()
  const latest = useRef({ ...options, isTap, retarget })
  useLayoutEffect(() => {
    latest.current = { ...options, isTap, retarget }
  })
  const [gestures] = useState(() => {
    const all = createPickGestures(() => latest.current)
    return POINTER_HOVER ? all : { ...all, onPointerMove: undefined, onPointerOut: undefined }
  })
  return gestures
}
