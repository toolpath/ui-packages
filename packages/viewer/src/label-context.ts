import { createContext } from 'react'
import type { LabelStore } from './render/label-store.js'

/**
 * Where a native `<SceneLabel>` registers itself: the store the native frame
 * projects each frame and draws over its canvas. `null` outside one, which is
 * also every web `<Viewer>` — labels there are DOM elements of their own.
 */
export const SceneLabelStoreContext = createContext<LabelStore | null>(null)
