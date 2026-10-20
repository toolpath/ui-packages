/**
 * React Native's `render/keys.ts`: there is no window, and no keyboard events
 * of this kind, so nothing is listened to. The shortcuts these serve — Escape
 * clearing the cut — are a desktop affordance and do not exist on a phone.
 */
interface WindowKeyHandlers {
  keydown?: (event: KeyboardEvent) => void
  keyup?: (event: KeyboardEvent) => void
  blur?: () => void
}

export function onWindowKeys(_handlers: WindowKeyHandlers): () => void {
  return () => {}
}
