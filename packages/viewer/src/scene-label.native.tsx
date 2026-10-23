import { useThree } from '@react-three/fiber'
import { useContext, useId, useLayoutEffect } from 'react'
import { SceneLabelStoreContext } from './label-context.js'
import type { SceneLabelProps } from './scene-label.js'

export type { SceneLabelProps } from './scene-label.js'

let warned = false

/**
 * React Native's `<SceneLabel>`: there is no DOM to put a label in, so it
 * registers itself with the store the native frame provides, and the frame
 * draws it as a view over the canvas. `className` and `layer` are web-only and
 * ignored here; `onPress` makes the label pressable, and `accessibilityHint`
 * says what pressing it does.
 */
export const SceneLabel = ({
  position,
  text,
  note,
  kind,
  axis,
  color,
  onPress,
  accessibilityHint,
}: SceneLabelProps) => {
  const store = useContext(SceneLabelStoreContext)
  const invalidate = useThree((state) => state.invalidate)
  const id = useId()

  useLayoutEffect(() => {
    if (!store) return
    store.set(id, { position, text, note, kind, axis, color, onPress, accessibilityHint })
    // The overlay updates when the frame next projects, and on a canvas drawn
    // on demand that frame has to be asked for.
    invalidate()
  }, [accessibilityHint, axis, color, id, invalidate, kind, note, onPress, position, store, text])

  useLayoutEffect(() => {
    if (!store) return undefined
    return () => {
      store.remove(id)
      invalidate()
    }
  }, [id, invalidate, store])

  if (!store && !warned) {
    warned = true
    console.warn('@toolpath/viewer: <SceneLabel> on React Native draws only inside a <Viewer>.')
  }
  return null
}
