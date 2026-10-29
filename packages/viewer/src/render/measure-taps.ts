import type { ViewportSize } from './camera.js'
import { onViewCube, type ViewCubePlace } from './view-cube.js'

/**
 * The measure tool's taps on React Native (`measure-pointer.native.ts`):
 * which of the canvas's clicks are taps that pick, without a canvas.
 */

/**
 * What a tap on the canvas is to the measure tool: nothing while the tool is
 * waiting; a pinch's lift, when more than one finger was down in the gesture
 * it ends; the view cube's, on the cube; else the part's, to pick what is
 * under it.
 */
export type TapKind = 'none' | 'pinch' | 'cube' | 'part'

export interface Tap {
  /** Whether the tool takes taps now: not while a section tool waits for its cut. */
  measuring: boolean
  /** The most fingers down in the gesture the tap ends (`countFingers`). */
  fingers: number
  /** Where, CSS pixels from the canvas's top left. */
  pointer: { x: number; y: number }
  viewport: ViewportSize
  /** Where a view cube stands, whose taps are its own; null for none. */
  viewCube: ViewCubePlace | null
}

/** What a tap is, read in this order: the tool, the fingers, the cube, the part. */
export const classifyTap = ({ measuring, fingers, pointer, viewport, viewCube }: Tap): TapKind => {
  if (!measuring) return 'none'
  if (fingers > 1) return 'pinch'
  if (viewCube && onViewCube(pointer, viewport, viewCube)) return 'cube'
  return 'part'
}

/** The most fingers down in the gesture under way. */
export interface FingerCount {
  /** A finger landed, with `down` fingers down then. */
  land: (down: number) => void
  most: () => number
}

/**
 * Counts the fingers of each gesture afresh as its first finger lands. A
 * click comes only for a lift that barely moved, so after a pinch or a
 * two-finger pan there may be none to reset the count on; and every lift of
 * a gesture that had two fingers down is a pinch's, however many clicks it
 * sends.
 */
export const countFingers = (): FingerCount => {
  let most = 0
  return {
    land: (down) => {
      most = down === 1 ? 1 : Math.max(most, down)
    },
    most: () => most,
  }
}
