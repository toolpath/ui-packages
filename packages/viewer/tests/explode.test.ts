import { Box3, Color, Group, Matrix4, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { ExplodeGroup } from '../src/model/explode.js'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { createExplodeBatch } from '../src/render/explode.js'
import {
  explodeAmount,
  explodeTriangleCount,
  extractExplodeGroup,
} from '../src/render/explode-geometry.js'
import { partBounds } from '../src/render/camera.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

const source = async () => {
  const model = cubeModel()
  const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
  // Neither IDs nor translations describe a feature or an analyzed direction.
  const region = model.features.find(
    (f) => f.featureType === 'face' && f.machiningDirection.z === 1,
  )!.regionIdxs[0]!
  const groups: Array<ExplodeGroup> = [
    {
      id: 'left-piece',
      regionIdxs: [region, region],
      offset: { x: -30, y: 0, z: 0 },
      color: 0x34d399,
    },
    { id: 'right-piece', regionIdxs: [region], offset: { x: 30, y: 0, z: 0 }, color: 0xa78bfa },
  ]
  return { model, geometry, groups, region }
}

describe('explode rendering primitives', () => {
  it('keeps caller groups separate, deduplicates membership only within a group, and maps every triangle to its source', async () => {
    const { model, geometry, groups, region } = await source()
    // No feature interpretation is needed to render or pick a supplied surface set.
    const generic = { ...model, features: [], candidateDirections: [] }
    const batch = createExplodeBatch(generic, geometry, groups)
    const range = model.regionIndex.rangeForRegion(region)!
    expect(batch.pieces.map((p) => p.group.id)).toEqual(['left-piece', 'right-piece'])
    expect(explodeTriangleCount(model, geometry, groups)).toBe((range.end - range.start) * 2)
    const positions = batch.mesh.geometry.getAttribute('position')
    const original = geometry.getAttribute('position')
    for (const piece of batch.pieces) {
      for (const [local, triangle] of piece.sourceTriangles.entries()) {
        expect(batch.hit(piece.instanceId, piece.range.start / 3 + local)).toEqual({
          group: piece.group,
          triangleIndex: triangle,
        })
        for (let corner = 0; corner < 9; corner += 1) {
          expect(positions.array[piece.range.start * 3 + local * 9 + corner]).toBe(
            original.array[triangle * 9 + corner],
          )
        }
      }
    }
    expect(batch.hit(undefined, 0)).toBeNull()
    expect(batch.hit(0, undefined)).toBeNull()
    expect(batch.hit(99, 0)).toBeNull()
    expect(batch.hit(0, -1)).toBeNull()
    batch.dispose()
    geometry.dispose()
  })

  it('picks the correct repeated surface after caller translations and parent transforms', async () => {
    const { model, geometry, groups, region } = await source()
    const batch = createExplodeBatch(model, geometry, groups)
    batch.setAppearance(undefined, null, null)
    batch.setAmount(0.5)
    const root = new Group()
    root.position.set(7, -3, 5)
    root.rotation.z = 0.3
    root.scale.setScalar(2)
    root.add(batch.object)
    root.updateMatrixWorld(true)
    for (const piece of batch.pieces) {
      const matrix = new Matrix4()
      batch.mesh.getMatrixAt(piece.instanceId, matrix)
      expect(new Vector3().setFromMatrixPosition(matrix).x).toBeCloseTo(piece.group.offset.x * 0.5)
      const sourcePoint = piece.centre.clone()
      const point = sourcePoint.clone().applyMatrix4(matrix).applyMatrix4(batch.mesh.matrixWorld)
      const ray = new Raycaster(point.clone().add(new Vector3(0, 0, 100)), new Vector3(0, 0, -1))
      const hit = ray.intersectObject(batch.mesh)[0]!
      expect(hit).toBeDefined()
      const mapped = batch.hit(hit.batchId, hit.faceIndex ?? undefined)!
      expect(mapped.group.id).toBe(piece.group.id)
      expect(model.regionIndex.regionForTriangle(mapped.triangleIndex)).toBe(region)
      const restored = hit.point
        .clone()
        .applyMatrix4(batch.mesh.matrixWorld.clone().invert())
        .applyMatrix4(matrix.clone().invert())
      expect(restored.distanceTo(sourcePoint)).toBeLessThan(0.00001)
    }
    batch.dispose()
    geometry.dispose()
  })

  it('reuses buffers for motion and appearance, frames translated bounds, and disposes only owned resources', async () => {
    const { model, geometry, groups } = await source()
    const original = { ...geometry.attributes }
    const batch = createExplodeBatch(model, geometry, groups)
    const positions = batch.mesh.geometry.getAttribute('position')
    const normal = batch.mesh.geometry.getAttribute('normal')
    const colors = new Map([
      ['left-piece', 0x7dd3fc],
      ['right-piece', 0xf472b6],
    ])
    batch.setAppearance(colors, 'right-piece', 'left-piece')
    const painted = new Color()
    batch.mesh.getColorAt(1, painted)
    const expected = new Color(0xf472b6).lerp(new Color(0xffffff), 0.45)
    expect(painted.r).toBeCloseTo(expected.r)
    expect(painted.g).toBeCloseTo(expected.g)
    expect(painted.b).toBeCloseTo(expected.b)
    batch.setAmount(1)
    const firstBounds = batch.mesh.boundingBox!.clone()
    const framed = new Box3()
    partBounds(batch.object, framed)
    expect(framed.equals(firstBounds)).toBe(true)
    batch.setAmount(0)
    expect(batch.mesh.visible).toBe(false)
    batch.setAmount(1)
    expect(batch.mesh.visible).toBe(true)
    expect(batch.mesh.boundingBox!.equals(firstBounds)).toBe(true)
    expect(batch.mesh.geometry.getAttribute('position')).toBe(positions)
    expect(batch.mesh.geometry.getAttribute('normal')).toBe(normal)
    const sourceDisposals: Array<string> = []
    geometry.addEventListener('dispose', () => sourceDisposals.push('source'))
    batch.dispose()
    expect(sourceDisposals).toEqual([])
    expect(geometry.attributes).toEqual(original)
    geometry.dispose()
  })

  it('validates primitive inputs before allocation and bounds the interpolation fraction', async () => {
    const { model, geometry, groups } = await source()
    const group = groups[0]!
    expect(() => createExplodeBatch(model, geometry, [group, group])).toThrow('unique')
    expect(() => createExplodeBatch(model, geometry, [{ ...group, regionIdxs: [9000] }])).toThrow(
      'Unknown source region',
    )
    expect(() => createExplodeBatch(model, geometry, [{ ...group, regionIdxs: [] }])).toThrow(
      'no regions',
    )
    expect(() =>
      createExplodeBatch(model, geometry, [{ ...group, offset: { x: NaN, y: 0, z: 0 } }]),
    ).toThrow('nonfinite')
    expect(() => createExplodeBatch(model, geometry, [])).toThrow('at least one')
    const indexed = geometry.clone().setIndex([0, 1, 2])
    expect(() => createExplodeBatch(model, indexed, groups)).toThrow('non-indexed')
    indexed.dispose()
    expect([-1, 0.3, 2, NaN, Infinity].map(explodeAmount)).toEqual([0, 0.3, 1, 0, 0])
    const copy = extractExplodeGroup(model, geometry, group)
    expect(copy.model.regionIndex.regionForTriangle(0)).toBe(group.regionIdxs[0])
    copy.geometry.dispose()
    geometry.dispose()
  })
})
