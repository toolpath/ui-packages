import type { Box3, Vector3 } from 'three'
import type { ViewerView } from './render/camera.js'

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
   * Frames arbitrary bounds from the direction being looked from, for zooming
   * to one feature rather than to the whole part.
   *
   * Keeps the viewing direction on purpose: somebody who has turned the part to
   * see a wall and then asks to zoom to it wants it closer, not re-oriented.
   */
  frameBox(box: Box3): void
}

export interface ViewerHandle extends ViewerControls {}

export type VectorLike = Pick<Vector3, 'x' | 'y' | 'z'>
