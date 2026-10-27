import { buildRegionIndex } from '../model/region-index.js'
import type { PartModel, PartModelRegion } from '../model/types.js'

/**
 * A display mesh as **Get part mesh** (`GET /v1/parts/{id}/mesh`) returns it,
 * so the response can be passed as it is.
 */
export interface DisplayMesh {
  partId?: string
  /** Presigned and short-lived. */
  meshGlbUrl?: string | null
  meshPointCount: number
  meshTriangleCount: number
  /**
   * How many triangles each face of the body became, in mesh order. Null or
   * absent for a mesh without face spans.
   */
  faceTriangleCounts?: ReadonlyArray<number> | null
}

/**
 * A `PartModel` of a display mesh: no features, and each face of the body as
 * one region, which is what draws its edges and shades each face on its own.
 * A mesh without face spans has no regions: it is drawn without edges, shaded
 * flat, and offers nothing to pick. The faces must tile the mesh, or this
 * throws `PartReportFormatError`.
 */
export const displayMeshModel = (mesh: DisplayMesh): PartModel => {
  const regions = regionsFromFaces(mesh.faceTriangleCounts ?? [])
  return {
    partId: mesh.partId ?? '',
    kernelVersion: '',
    features: [],
    regions,
    candidateDirections: [],
    mesh: {
      pointCount: mesh.meshPointCount,
      triangleCount: mesh.meshTriangleCount,
      glbUrl: mesh.meshGlbUrl ?? null,
      stlUrl: null,
      thumbnailUrl: null,
    },
    // Over no triangles when there are no faces, so that every lookup answers null.
    regionIndex: buildRegionIndex({
      regions,
      features: [],
      triangleCount: regions.length > 0 ? mesh.meshTriangleCount : 0,
    }),
    warnings: [],
  }
}

/** One region per face, in mesh order. A face was never split, so it is its own `splitOrigin`. */
const regionsFromFaces = (faceTriangleCounts: ReadonlyArray<number>): Array<PartModelRegion> => {
  let start = 0
  return faceTriangleCounts.map((count, idx) => {
    const triangles = { start, end: start + count }
    start = triangles.end
    return { splitOrigin: idx, idx, shapeKind: 'Face', area: 0, triangles }
  })
}
