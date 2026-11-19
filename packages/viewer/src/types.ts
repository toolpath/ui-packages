import type { Box3, Vector3 } from 'three'
import type { ViewerView } from './render/camera.js'
import type { SectionOptions } from './render/section.js'

export type { ViewerView }

export interface ViewerControls {
  /** Frames the part without changing the current viewing direction. */
  fit(): void
  /** Returns to the opening view and frames the part. */
  reset(): void
  setView(view: ViewerView): void
  /**
   * Frames the part from an arbitrary direction — a unit vector from the part
   * toward the camera.
   *
   * The named views are the six a keyboard shortcut reaches; the orientation
   * cube offers twenty-six, and the twenty that are not axis-aligned have no
   * names worth inventing.
   */
  setViewDirection(direction: { x: number; y: number; z: number }): void
  /**
   * Frames arbitrary bounds, for zooming to one feature rather than to the whole
   * part.
   *
   * Without options it frames from the direction being looked from, and lands
   * at once. That is on purpose: somebody who has turned the part to see a wall
   * and then asks to zoom to it wants it closer, not re-oriented.
   *
   * With either option it eases there in one move instead — the camera turns,
   * slides across and closes in together, so nobody loses track of where on the
   * part they are being taken. It lands at once for somebody who asks for less
   * motion, and a gesture or another framing stops it where it is.
   */
  frameBox(box: Box3, options?: FrameBoxOptions): void
  /**
   * Sets or clears the cut the viewer holds for itself — the one `<SectionTool>`
   * places and `<PartMesh>` follows when it is given no `section` of its own.
   *
   * `null` clears it. A `<PartMesh section>` is not affected: that cut is the
   * consumer's, and this one is the viewer's.
   */
  setSection(options: SectionOptions | null): void
}

/** How `frameBox` frames, beyond the box. Either one makes it ease. */
export interface FrameBoxOptions {
  /**
   * Look from this direction — from the box toward the camera — rather than
   * from where the camera is: for zooming to a feature from the side it is
   * machined from. `threeQuarterDirection` tips one so that walls show.
   *
   * The roll ends square, as `setViewDirection`'s does: of the four square
   * rolls, the one nearest the camera's. A zero vector keeps the direction being
   * looked from.
   */
  direction?: VectorLike | undefined
  /**
   * The least the view takes in, as a share of the scene across: `0.4` frames
   * at least two fifths of the part. A face framed on its own fills the view
   * with nothing to say where on the part it is.
   */
  minShare?: number | undefined
}

export interface ViewerHandle extends ViewerControls {}

export type VectorLike = Pick<Vector3, 'x' | 'y' | 'z'>
