import { buildRegionIndex } from '../model/region-index.js'
import type { PartModel, PartModelRegion } from '../model/types.js'

/**
 * A display mesh as **Get part mesh** (`GET /v1/parts/{id}/mesh`) returns it,
 * so the response can be passed as it is.
 */
export interface DisplayMesh {
  partId?: string
  /** Presigned and short-lived; `null` where the caller supplies the geometry. */
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
 * The shape kind of the one region of a mesh whose faces are not known: the
 * whole body, which `smoothRegionNormals` shades flat.
 */
export const WHOLE_BODY = 'Body'

/**
 * A `PartModel` of a display mesh: no features, and each face of the body as
 * one region, which is what draws its edges and shades each face on its own.
 * Without face spans the whole mesh is one region, of shape kind `'Body'`: it
 * is picked and hovered as one, shaded flat, and drawn without edges. The faces
 * must tile the mesh, or this throws `PartReportFormatError`.
 */
export const displayMeshModel = (mesh: DisplayMesh): PartModel => {
  const regions = mesh.faceTriangleCounts?.length
    ? regionsFromFaces(mesh.faceTriangleCounts)
    : [
        {
          splitOrigin: 0,
          idx: 0,
          shapeKind: WHOLE_BODY,
          area: 0,
          triangles: { start: 0, end: mesh.meshTriangleCount },
        },
      ]
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
    regionIndex: buildRegionIndex({
      regions,
      features: [],
      triangleCount: mesh.meshTriangleCount,
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
