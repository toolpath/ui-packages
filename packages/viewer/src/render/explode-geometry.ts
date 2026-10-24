import type { PartModel } from '../model/types.js'
import type { ExplodeGroup } from '../model/explode.js'
import { BufferGeometry, Float32BufferAttribute } from 'three'

/** Validate before allocating GPU resources. Group identity and membership belong to the caller. */
export const explodeTriangleCount = (
  model: PartModel,
  geometry: BufferGeometry,
  groups: readonly ExplodeGroup[],
): number => {
  if (geometry.index) {
    throw new Error('ExplodedPart requires non-indexed source geometry.')
  }
  const position = geometry.getAttribute('position')
  if (!position || position.itemSize !== 3 || position.count !== model.mesh.triangleCount * 3) {
    throw new Error('ExplodedPart source geometry must match the model triangle ranges.')
  }
  const ids = new Set<string>()
  let triangles = 0
  for (const group of groups) {
    if (!group.id || ids.has(group.id)) {
      throw new Error('ExplodedPart group IDs must be nonempty and unique.')
    }
    ids.add(group.id)
    if (![group.offset.x, group.offset.y, group.offset.z].every(Number.isFinite)) {
      throw new Error(`ExplodedPart group ${group.id} has a nonfinite offset.`)
    }
    if (group.regionIdxs.length === 0) {
      throw new Error(`ExplodedPart group ${group.id} has no regions.`)
    }
    for (const region of new Set(group.regionIdxs)) {
      const range = model.regionIndex.rangeForRegion(region)
      if (!range) {
        throw new Error(`Unknown source region ${region}`)
      }
      triangles += range.end - range.start
    }
  }
  return triangles
}

/** Amount is a fraction of the supplied translations, never inferred from the model. */
export { readExplodeAmount as explodeAmount } from '../model/explode-amount.js'

/** Compact geometry for one copy, with an explicit map back to report triangle identities. */
export const extractExplodeGroup = (
  source: Pick<PartModel, 'regions'>,
  geometry: BufferGeometry,
  group: Pick<ExplodeGroup, 'regionIdxs'>,
) => {
  const regions = [...new Set(group.regionIdxs)].map((idx) => {
    const region = source.regions.find((region) => region.idx === idx)
    if (!region) {
      throw new Error(`Unknown source region ${idx}`)
    }
    return region
  })
  const triangles = regions.reduce(
    (count, region) => count + region.triangles.end - region.triangles.start,
    0,
  )
  const positions = new Float32Array(triangles * 9)
  const normals = new Float32Array(triangles * 9)
  const sourceTriangles = new Uint32Array(triangles)
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (geometry.index) {
    throw new Error('Explode requires the viewer’s non-indexed input geometry.')
  }
  let cursor = 0
  const compact = regions.map((region) => {
    const start = cursor
    for (let t = region.triangles.start; t < region.triangles.end; t += 1) {
      sourceTriangles[cursor] = t
      for (let corner = 0; corner < 3; corner += 1) {
        const v = t * 3 + corner
        const at = cursor * 9 + corner * 3
        positions.set([position.getX(v), position.getY(v), position.getZ(v)], at)
        if (normal) {
          normals.set([normal.getX(v), normal.getY(v), normal.getZ(v)], at)
        }
      }
      cursor += 1
    }
    return { ...region, triangles: { start, end: cursor } }
  })
  const copy = new BufferGeometry()
  copy.setAttribute('position', new Float32BufferAttribute(positions, 3))
  if (normal) {
    copy.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  } else {
    copy.computeVertexNormals()
  }
  return { regions: compact, geometry: copy, sourceTriangles }
}
