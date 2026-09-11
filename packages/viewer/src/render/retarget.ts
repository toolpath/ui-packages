import type { Vec3 } from '../model/types.js'

/** A camera and the point it orbits, together, because neither moves alone. */
export interface RetargetPose {
  readonly position: Vec3
  readonly target: Vec3
}

/**
 * Where the camera and its orbit target go when somebody asks to orbit about a
 * point on the part.
 *
 * The target moves to the point and the camera moves by the same delta, so the
 * offset between them — the viewing direction and the distance along it — comes
 * through untouched. Only the pivot changes: what was clicked ends up in the
 * middle of the view, at the same size, seen from the same angle, and every
 * orbit and zoom afterwards is about it. This says where the pose lands, not
 * how it gets there — how fast is the caller's transition and the controls'
 * damping, and in this viewer that is one frame.
 *
 * Moving the target alone would swing the camera to look at the new point from
 * the old place, which reads as the part being knocked sideways. Moving the
 * camera alone would not change what anything orbits about, which is the whole
 * request.
 *
 * This is what makes an orthographic viewport navigable. Under a perspective
 * camera the wheel travels toward the target and a mis-aimed pivot is something
 * you can dolly out of; under an orthographic one the wheel scales a frustum,
 * so nothing about zooming ever re-aims the pivot, and F9 measured a cursor
 * zoom leaving it in space off the part's corner.
 *
 * Pure, so the arithmetic is testable without a scene: three vectors in, two
 * out, no camera and no controls.
 */
export function retargetPose(
  cameraPosition: Vec3,
  currentTarget: Vec3,
  hitPoint: Vec3,
): RetargetPose {
  const dx = hitPoint.x - currentTarget.x
  const dy = hitPoint.y - currentTarget.y
  const dz = hitPoint.z - currentTarget.z

  return {
    position: {
      x: cameraPosition.x + dx,
      y: cameraPosition.y + dy,
      z: cameraPosition.z + dz,
    },
    target: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
  }
}
