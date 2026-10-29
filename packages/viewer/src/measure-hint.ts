import type { FaceSurface } from './render/face-measure.js'
import { MEASURE_HINT_CLASS } from './render/measure.js'

/** The face under the pointer: a plane in light blue, a cylinder in violet, anything the tool cannot read in grey. */
export const HOVER_COLORS: Record<FaceSurface['kind'], number> = {
  plane: 0x60a5fa,
  cylinder: 0xa78bfa,
  other: 0x9ca3af,
}

export const cssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

/** A spot on the canvas, CSS pixels from its top left. */
export interface CanvasSpot {
  x: number
  y: number
}

/** Where an Alt point would go, and whether it is a corner proper, whose ring is a size up. */
interface RingSpot extends CanvasSpot {
  corner: boolean
}

/**
 * What a click under the pointer would pick, at the pointer: a caption just
 * off it ("Face", "Hole ⌀ 6.350", "Corner", "Edge"), and for an Alt point a
 * ring where it snaps.
 */
export interface MeasureHint {
  show: (caption: string, pointer: CanvasSpot, ring: RingSpot | null) => void
  hide: () => void
  remove: () => void
}

/** Over the labels (drei's `Html`, stacked from 20 down), and never in the pointer's way. */
const OVERLAY = { position: 'absolute', zIndex: '31', pointerEvents: 'none' } as const

const CAPTION_STYLE = { ...OVERLAY, left: '14px', top: '-26px', whiteSpace: 'nowrap' } as const

const RING_PIXELS = 12
const CORNER_RING_PIXELS = 16

const ringStyle = (pixels: number) =>
  ({
    left: `${-pixels / 2}px`,
    top: `${-pixels / 2}px`,
    width: `${pixels}px`,
    height: `${pixels}px`,
  }) as const

/**
 * The hint as plain elements over the canvas, moved straight from the
 * pointer's events. Drawn as part of the scene (drei `Html`), it followed the
 * pointer a frame late, as the scene draws only on demand, and a new one
 * showed for a frame where the part's middle is before it found its place:
 * both read as flicker. Here a move places it at once, and nothing of React
 * runs for it.
 *
 * The ring is drawn here, as a marker is. The caption's look is the
 * stylesheet's, through {@link MEASURE_HINT_CLASS}.
 */
export const createMeasureHint = (container: HTMLElement): MeasureHint => {
  const caption = document.createElement('div')
  caption.className = MEASURE_HINT_CLASS
  Object.assign(caption.style, CAPTION_STYLE)
  const ring = document.createElement('div')
  Object.assign(ring.style, OVERLAY, ringStyle(RING_PIXELS), {
    boxSizing: 'border-box',
    border: `2px solid ${cssColor(HOVER_COLORS.plane)}`,
    borderRadius: '9999px',
  })
  for (const element of [caption, ring]) {
    element.hidden = true
    container.append(element)
  }
  const place = (element: HTMLElement, { x, y }: CanvasSpot): void => {
    element.style.transform = `translate(${x}px, ${y}px)`
    element.hidden = false
  }
  const hide = (): void => {
    caption.hidden = true
    ring.hidden = true
  }
  return {
    show: (text, pointer, at) => {
      if (caption.textContent !== text) caption.textContent = text
      place(caption, pointer)
      if (!at) {
        ring.hidden = true
        return
      }
      Object.assign(ring.style, ringStyle(at.corner ? CORNER_RING_PIXELS : RING_PIXELS))
      place(ring, at)
    },
    hide,
    remove: () => {
      caption.remove()
      ring.remove()
    },
  }
}
