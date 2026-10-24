import type { PartModel, ExplodeGroup } from '@toolpath/viewer'
import { Box3, type BufferGeometry, Vector3 } from 'three'

// Bound layout/picking work independently of the copied triangle budget.
// The PC housing stress sample exercises 307 groups from 403 feature readings.
const MAX_EXPLODE_GROUPS = 512
const MAX_EXPLODE_TRIANGLES = 1_000_000

export const explodeStats = (model: PartModel, groups: readonly ExplodeGroup[]) => {
  let triangles = 0
  for (const group of groups) {
    for (const region of group.regionIdxs) {
      const range = model.regionIndex.rangeForRegion(region)
      if (!range) {
        throw new Error(`Unknown source region ${region}`)
      }
      triangles += range.end - range.start
    }
  }
  return {
    triangles,
    renderable: groups.length <= MAX_EXPLODE_GROUPS && triangles <= MAX_EXPLODE_TRIANGLES,
  }
}

/** Read only the source ranges. Never scan copied geometry or change source triangle order. */
export const regionBounds = (
  model: PartModel,
  geometry: BufferGeometry,
  regions: readonly number[],
): Box3 => {
  const box = new Box3()
  const position = geometry.getAttribute('position')
  const point = new Vector3()
  for (const region of new Set(regions)) {
    const range = model.regionIndex.rangeForRegion(region)
    if (!range) {
      throw new Error(`Unknown source region ${region}`)
    }
    for (let vertex = range.start * 3; vertex < range.end * 3; vertex += 1) {
      box.expandByPoint(point.fromBufferAttribute(position, vertex))
    }
  }
  return box
}
