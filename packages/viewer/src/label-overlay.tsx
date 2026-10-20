import type { LabelStore } from './render/label-store.js'
import type { ViewerTheme } from './render/theme.js'

export interface LabelOverlayProps {
  store: LabelStore
  theme?: ViewerTheme['labels']
}

/**
 * Labels drawn over the canvas from a label store. The web has nothing to draw
 * here: a web `<SceneLabel>` is a DOM element of its own, through drei's
 * `<Html>`. The React Native build's `label-overlay.native.tsx` is the overlay.
 */
export const LabelOverlay = (_props: LabelOverlayProps) => null
