/**
 * React Native's `render/keys.ts`: there is no window, and no keyboard events
 * of this kind, so nothing is listened to. The shortcut it serves — Escape
 * clearing the cut — is a desktop affordance and does not exist on a phone.
 */
export function onWindowKeydown(_handler: (event: KeyboardEvent) => void): () => void {
  return () => {}
}
