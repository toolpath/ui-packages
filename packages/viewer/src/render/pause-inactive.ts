import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Pausing a React Native canvas while the app is not active.
 *
 * Behind Notification Centre an iOS app is inactive but not suspended:
 * fiber's loop keeps running, iOS refuses the GPU work, and the GL view never
 * shows a new frame again, though touches still move the camera. So the
 * native frame passes the canvas `frameloop="never"` while the app is inactive
 * (`useAppInactive`), and asks for a frame once the loop runs again
 * (`useRepaintOnResume`).
 */

/** The part of React Native's `AppState` this reads. */
export interface AppActivity {
  currentState: string | null | undefined
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void }
}

const isInactive = (state: string | null | undefined): boolean =>
  state === 'inactive' || state === 'background'

/** Whether the app is inactive or in the background, from its first render on. */
export const useAppInactive = (appState: AppActivity): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = appState.addEventListener('change', onChange)
      return () => subscription.remove()
    },
    [appState],
  )
  const inactive = () => isInactive(appState.currentState)
  return useSyncExternalStore(subscribe, inactive, inactive)
}

/**
 * A frame whenever the canvas loop runs, on mount and after a pause: a demand
 * canvas draws nothing until asked. Read from fiber's store rather than the
 * prop, since fiber applies a new `frameloop` after the render that passed it,
 * and drops a frame asked for while the loop is `never`.
 */
export const useRepaintOnResume = (): void => {
  const frameloop = useThree((state) => state.frameloop)
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (frameloop !== 'never') invalidate()
  }, [frameloop, invalidate])
}
