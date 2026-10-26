import { useThree } from '@react-three/fiber'
import {
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { type TapPoint, type TapTracker, trackTaps } from './render/tap.js'

/** Whether the gesture ending at this event was a click rather than a drag. */
export type TapGuard = (event: TapPoint) => boolean

const ViewerTapContext = createContext<TapGuard | null>(null)

/**
 * Shares one tracker with everything below it.
 *
 * Every tracker attaches its own capture-phase `pointerdown` listener to the
 * canvas and records the same point from it, so a second one is a second
 * listener doing identical work on every press. The scene and the part both
 * need the answer — the scene to judge a middle-button gesture, the part to
 * judge a click on a face — and one press has one answer.
 *
 * The provider does not create the tracker: it passes down the guard the scene
 * already made by calling {@link useTapGuard} above it. That keeps a single
 * code path for owning a tracker, rather than one here and one in the hook.
 */
export const ViewerTapProvider = ({ value, children }: PropsWithChildren<{ value: TapGuard }>) => (
  <ViewerTapContext.Provider value={value}>{children}</ViewerTapContext.Provider>
)

/**
 * A click that is a click, for anything inside the canvas.
 *
 * Bound to the canvas element rather than to the object, because the gesture
 * being judged started before any object knew about it.
 *
 * Under a `<Viewer>` this returns the tracker the scene already owns and
 * attaches nothing. Called outside one — it is exported, so a consumer may use
 * it in a scene of their own — it owns a tracker of its own instead. The effect
 * is what differs, not the hooks: they run in the same order either way.
 */
export function useTapGuard(): TapGuard {
  const shared = useContext(ViewerTapContext)
  const domElement = useThree((state) => state.gl.domElement)
  const tracker = useRef<TapTracker | null>(null)

  useEffect(() => {
    if (shared) return

    const tracked = trackTaps(domElement)
    tracker.current = tracked

    return () => {
      tracked.dispose()
      if (tracker.current === tracked) tracker.current = null
    }
  }, [domElement, shared])

  const own = useMemo<TapGuard>(
    () => (event: TapPoint) => tracker.current?.isTap(event) ?? true,
    [],
  )

  return shared ?? own
}
