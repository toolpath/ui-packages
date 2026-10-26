import { Box3, type BufferGeometry } from 'three'

/** Measures a complete collection without moving or taking ownership of its geometry. */
export const collectionBounds = (
  items: ReadonlyArray<{ id: string; geometry: BufferGeometry }>,
): Box3 => {
  const box = new Box3()
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate collection item id: ${item.id}`)
    }
    ids.add(item.id)
    if (!item.geometry.boundingBox) {
      item.geometry.computeBoundingBox()
    }
    if (item.geometry.boundingBox) {
      box.union(item.geometry.boundingBox)
    }
  }
  return box
}
