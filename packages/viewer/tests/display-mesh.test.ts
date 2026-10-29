import { describe, expect, it } from 'vitest'
import { displayMeshModel } from '../src/engine/display-mesh.js'
import { PartReportFormatError } from '../src/model/errors.js'

describe('display mesh models', () => {
  it('makes each face of a display mesh one region', () => {
    const model = displayMeshModel({
      partId: 'part',
      meshGlbUrl: 'https://test/mesh.glb',
      meshPointCount: 8,
      meshTriangleCount: 12,
      faceTriangleCounts: [2, 2, 2, 2, 2, 2],
    })
    expect(model.partId).toBe('part')
    expect(model.features).toEqual([])
    expect(model.mesh).toMatchObject({
      pointCount: 8,
      triangleCount: 12,
      glbUrl: 'https://test/mesh.glb',
    })
    expect(model.regions.map((region) => region.triangles)).toEqual(
      [0, 2, 4, 6, 8, 10].map((start) => ({ start, end: start + 2 })),
    )
    expect(model.regionIndex.regionForTriangle(11)).toBe(5)
  })

  it('gives a mesh without face spans no regions, and answers no lookup', () => {
    for (const faceTriangleCounts of [null, undefined, []]) {
      const model = displayMeshModel({
        meshPointCount: 8,
        meshTriangleCount: 12,
        faceTriangleCounts,
      })
      expect(model.regions).toEqual([])
      expect(model.regionIndex.regionForTriangle(0)).toBeNull()
    }
  })

  it('refuses faces that do not tile the mesh', () => {
    expect(() =>
      displayMeshModel({ meshPointCount: 8, meshTriangleCount: 12, faceTriangleCounts: [2, 2] }),
    ).toThrow(PartReportFormatError)
  })
})
