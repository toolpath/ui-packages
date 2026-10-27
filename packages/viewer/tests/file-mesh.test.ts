import { describe, expect, it, vi } from 'vitest'
import { displayMeshModel } from '../src/engine/display-mesh.js'
import { loadFileMesh, parseFileMesh } from '../src/engine/file-mesh.js'
import { PartMeshError } from '../src/engine/geometry.js'
import { PartReportFormatError } from '../src/model/errors.js'

/** A unit cube at `offset`: 8 points, 12 triangles. */
const cube = (offset: number) => ({
  points: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1].map(
    (value, i) => (i % 3 === 0 ? value + offset : value),
  ),
  triangles: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0,
    4, 3, 4, 7,
  ],
})

interface Node {
  name?: string
  points: Array<number>
  triangles: Array<number>
  translation?: [number, number, number]
}

/** A GLB laid out as the Engine writes a file's mesh: one named node per body, one buffer. */
const glbOf = (nodes: Array<Node>): ArrayBuffer => {
  const bufferViews: Array<object> = []
  const accessors: Array<object> = []
  const ranges: Array<Uint8Array> = []
  let length = 0
  nodes.forEach(({ points, triangles }, i) => {
    const positions = Float32Array.from(points)
    const indices = Uint32Array.from(triangles)
    bufferViews.push(
      { buffer: 0, byteOffset: length, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: length + positions.byteLength, byteLength: indices.byteLength },
    )
    const min = [0, 1, 2].map((axis) => Math.min(...points.filter((_, at) => at % 3 === axis)))
    const max = [0, 1, 2].map((axis) => Math.max(...points.filter((_, at) => at % 3 === axis)))
    accessors.push(
      { bufferView: 2 * i, componentType: 5126, count: points.length / 3, type: 'VEC3', min, max },
      { bufferView: 2 * i + 1, componentType: 5125, count: triangles.length, type: 'SCALAR' },
    )
    ranges.push(new Uint8Array(positions.buffer), new Uint8Array(indices.buffer))
    length += positions.byteLength + indices.byteLength
  })
  const json = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ byteLength: length }],
      bufferViews,
      accessors,
      meshes: nodes.map((_, i) => ({
        primitives: [{ attributes: { POSITION: 2 * i }, indices: 2 * i + 1, mode: 4 }],
      })),
      nodes: nodes.map(({ name, translation }, i) => ({
        mesh: i,
        ...(name === undefined ? {} : { name }),
        ...(translation ? { translation } : {}),
      })),
      scenes: [{ nodes: nodes.map((_, i) => i) }],
      scene: 0,
    }),
  )
  const pad = (n: number) => (n + 3) & ~3
  const glb = new Uint8Array(12 + 8 + pad(json.length) + 8 + pad(length))
  const view = new DataView(glb.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, glb.length, true)
  view.setUint32(12, pad(json.length), true)
  view.setUint32(16, 0x4e4f534a, true)
  glb.set(json, 20)
  glb.fill(0x20, 20 + json.length, 20 + pad(json.length))
  const bin = 20 + pad(json.length)
  view.setUint32(bin, pad(length), true)
  view.setUint32(bin + 4, 0x004e4942, true)
  let offset = bin + 8
  for (const range of ranges) {
    glb.set(range, offset)
    offset += range.byteLength
  }
  return glb.buffer
}

const lowestX = (bodies: Awaited<ReturnType<typeof parseFileMesh>>, index: number) => {
  const geometry = bodies.get(index)!.geometry
  geometry.computeBoundingBox()
  return geometry.boundingBox!.min.x
}

describe('file meshes', () => {
  it('splits a file mesh into its bodies by index, in the file’s coordinates', async () => {
    // Body 1 faceted to nothing, so the Engine left it out.
    const bodies = await parseFileMesh(
      glbOf([
        { name: 'body-2', ...cube(20) },
        { name: 'body-0', ...cube(0) },
      ]),
    )
    expect([...bodies.keys()]).toEqual([0, 2])
    expect(lowestX(bodies, 0)).toBe(0)
    expect(lowestX(bodies, 2)).toBe(20)
    const { index, model, geometry } = bodies.get(2)!
    expect(index).toBe(2)
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('position').count).toBe(36)
    expect(geometry.hasAttribute('normal')).toBe(true)
    expect(model.mesh).toMatchObject({ pointCount: 8, triangleCount: 12, glbUrl: null })
    expect(model.features).toEqual([])
    // The body is one region, so it can be picked and hovered as one.
    expect(model.regions).toEqual([
      { splitOrigin: 0, idx: 0, shapeKind: 'Body', area: 0, triangles: { start: 0, end: 12 } },
    ])
    expect(model.regionIndex.regionForTriangle(11)).toBe(0)
  })

  it('applies a node’s transform, and ignores nodes that are not bodies', async () => {
    const bodies = await parseFileMesh(
      glbOf([
        { name: 'body-0', ...cube(0), translation: [5, 0, 0] },
        { name: 'stock', ...cube(50) },
      ]),
    )
    expect([...bodies.keys()]).toEqual([0])
    expect(lowestX(bodies, 0)).toBe(5)
  })

  it('refuses bytes that are not a file mesh', async () => {
    await expect(parseFileMesh(new ArrayBuffer(8))).rejects.toThrow(PartMeshError)
    await expect(parseFileMesh(glbOf([{ ...cube(0) }]))).rejects.toThrow(/no `body-<index>` nodes/)
  })

  it('fetches through the fetch given, and names the status when that fails', async () => {
    const request = vi.fn(async () => new Response(glbOf([{ name: 'body-0', ...cube(0) }])))
    const bodies = await loadFileMesh('https://test/bodies.glb', { fetch: request })
    expect([...bodies.keys()]).toEqual([0])
    expect(request).toHaveBeenCalledWith('https://test/bodies.glb', undefined)

    const expired = async () => new Response(null, { status: 403, statusText: 'Forbidden' })
    await expect(loadFileMesh('https://test/bodies.glb', { fetch: expired })).rejects.toThrow(
      /403 Forbidden.*expires 15 minutes/,
    )
  })

  it('rejects once aborted, even after the mesh arrived', async () => {
    const controller = new AbortController()
    const request = vi.fn(async () => {
      controller.abort()
      return new Response(glbOf([{ name: 'body-0', ...cube(0) }]))
    })
    await expect(
      loadFileMesh('https://test/bodies.glb', { fetch: request, signal: controller.signal }),
    ).rejects.toThrow()
  })
})

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
    expect(model.mesh.glbUrl).toBe('https://test/mesh.glb')
    expect(model.regions.map((region) => region.triangles)).toEqual(
      [0, 2, 4, 6, 8, 10].map((start) => ({ start, end: start + 2 })),
    )
    expect(model.regionIndex.regionForTriangle(11)).toBe(5)
  })

  it('refuses faces that do not tile the mesh', () => {
    expect(() =>
      displayMeshModel({ meshPointCount: 8, meshTriangleCount: 12, faceTriangleCounts: [2, 2] }),
    ).toThrow(PartReportFormatError)
  })
})
