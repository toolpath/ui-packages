import { createContext, useContext } from 'react'
import type { Frame } from '../model/frame.js'
import type { Outline } from '../model/outline.js'
import type { Sheet } from './sheet.js'

/**
 * What `<ToolDrawing>` hands the things drawn inside it.
 *
 * **A child cannot work this out for itself, and should not try.** The panel is
 * measured by a `ResizeObserver` on an `<svg>` the consumer never holds, and
 * the chrome the dimension bands take is settled from that measurement — so a
 * child that wanted to draw in the drawing's own coordinates had no way to
 * learn them. The one consumer that needed them ended up re-deriving the frame
 * from the same inputs and keeping a lockstep test to catch the drift, which is
 * a workaround for a hole in this component's surface rather than a design.
 *
 * So the frame is published to the subtree instead. `frame` carries the scale,
 * the viewBox and the two mapping functions; `outline` is what was drawn, for a
 * child that needs the extent; `sheet` is the ink, so an overlay draws in the
 * same palette without being told the theme twice.
 */
export interface DrawingContext {
  readonly frame: Frame
  readonly outline: Outline
  readonly sheet: Sheet
}

const Drawing = createContext<DrawingContext | null>(null)

export const DrawingProvider = Drawing.Provider

/**
 * The frame the surrounding `<ToolDrawing>` settled on, or `null` outside one.
 *
 * Null rather than throwing, because a caller may legitimately pass the frame
 * explicitly — a test framing a fixture, or a drawing composed by hand — and
 * the props stay the override.
 */
export const useDrawingContext = (): DrawingContext | null => useContext(Drawing)
