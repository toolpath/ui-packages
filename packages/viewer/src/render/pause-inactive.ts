/** What the canvas loop is set to: fiber's `frameloop`. */
export type Frameloop = 'always' | 'demand' | 'never'

/** The part of React Native's `AppState` this reads. */
export interface AppActivity {
  currentState: string | null | undefined
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void }
}

/** The part of fiber's root store this reads and drives. */
export interface FrameloopStore {
  getState(): {
    frameloop: Frameloop
    setFrameloop(frameloop: Frameloop): void
    invalidate(): void
  }
  subscribe(listener: (state: { frameloop: Frameloop }) => void): () => void
}

const isInactive = (state: string | null | undefined): boolean =>
  state === 'inactive' || state === 'background'

/**
 * Holds the canvas loop at `never` while the app is not active, and returns the
 * function that stops.
 *
 * Behind Notification Centre an iOS app is inactive but not suspended:
 * fiber's loop keeps running, iOS refuses the GPU work, and the GL view never
 * shows a new frame again, though touches still move the camera. Stopping the
 * loop while inactive and asking for a frame on the way back avoids it.
 *
 * A canvas can mount while the app is already inactive, so the state it starts
 * in counts, not only changes. And some fiber versions set the loop back to the
 * `frameloop` prop on every render of the canvas, so the store is watched and
 * the pause put back whenever something else lifts it.
 */
export function pauseWhileInactive(
  appState: AppActivity,
  store: FrameloopStore,
  frameloop: Frameloop,
): () => void {
  let inactive = isInactive(appState.currentState)
  if (inactive) store.getState().setFrameloop('never')

  const unsubscribe = store.subscribe((state) => {
    if (inactive && state.frameloop !== 'never') store.getState().setFrameloop('never')
  })
  const subscription = appState.addEventListener('change', (state) => {
    inactive = isInactive(state)
    const root = store.getState()
    if (inactive) {
      root.setFrameloop('never')
    } else {
      root.setFrameloop(frameloop)
      root.invalidate()
    }
  })
  return () => {
    subscription.remove()
    unsubscribe()
  }
}
