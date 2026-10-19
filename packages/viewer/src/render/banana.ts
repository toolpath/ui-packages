import { Box3, Vector3 } from 'three'

/** The clearance between a part and the banana, as a fraction of part reach. */
export const BANANA_GAP = 0.1

/** Places a banana on the same ground plane, just to the right of a part. */
export function bananaPosition(part: Box3, banana: Box3): Vector3 {
  const size = part.getSize(new Vector3())
  const reach = Math.max(size.x, size.y, size.z)
  const centre = part.getCenter(new Vector3())

  return new Vector3(
    part.max.x + reach * BANANA_GAP - banana.min.x,
    centre.y - (banana.min.y + banana.max.y) / 2,
    part.min.z - banana.min.z,
  )
}

/** The bounds a consumer should frame when showing a banana for scale. */
export function bananaFrameBounds(part: Box3, banana: Box3, position: Vector3): Box3 {
  return part.clone().union(banana.clone().translate(position))
}
