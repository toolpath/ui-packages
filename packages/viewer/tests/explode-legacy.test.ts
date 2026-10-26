import { Color, Matrix4, Vector3 } from 'three'
import { expect, it, vi } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { createExplodeBatch } from '../src/render/explode.js'
import { resolveExplodeTheme } from '../src/render/explode-theme.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

// r159 appends a geometry and its instance together and uses vertex colors.
// Exercise that API shape without installing a second renderer into the workspace.
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>()
  class LegacyBatchedMesh extends three.BatchedMesh {
    constructor(...args: ConstructorParameters<typeof three.BatchedMesh>) {
      super(...args)
      Object.defineProperty(this, 'addInstance', { value: undefined })
      Object.defineProperty(this, 'setColorAt', { value: undefined })
    }
    override addGeometry(geometry: import('three').BufferGeometry): number {
      const id = super.addGeometry(geometry)
      three.BatchedMesh.prototype.addInstance.call(this, id)
      return id
    }
  }
  return { ...three, BatchedMesh: LegacyBatchedMesh }
})

it('keeps separate identities, translations, and colors on the earlier batching API', async () => {
  const model = cubeModel()
  const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
  const region = model.regions[0]!.idx
  const groups = [
    { id: 'one', regionIdxs: [region], offset: { x: 15, y: 0, z: 0 }, color: 0x34d399 },
    { id: 'two', regionIdxs: [region], offset: { x: -15, y: 0, z: 0 }, color: 0xa78bfa },
  ]
  const batch = createExplodeBatch(model, geometry, groups)
  batch.setAppearance({ selected: 'two' })
  batch.setAmount(0.5)
  expect(batch.pieces).toHaveLength(2)
  for (const piece of batch.pieces) {
    const matrix = new Matrix4()
    batch.mesh.getMatrixAt(piece.instanceId, matrix)
    expect(new Vector3().setFromMatrixPosition(matrix).x).toBeCloseTo(piece.group.offset.x * 0.5)
    const color = new Color().fromBufferAttribute(
      batch.mesh.geometry.getAttribute('color'),
      piece.range.start,
    )
    const expected = new Color(piece.group.color).lerp(
      new Color(0xffffff),
      piece.group.id === 'two' ? 0.45 : 0,
    )
    expect(color.r).toBeCloseTo(expected.r)
    expect(color.g).toBeCloseTo(expected.g)
    expect(color.b).toBeCloseTo(expected.b)
    expect(batch.hit(piece.instanceId, piece.range.start / 3)?.group.id).toBe(piece.group.id)
  }
  const attribute = batch.mesh.geometry.getAttribute('color')
  const themed = resolveExplodeTheme({ highlight: 0x0088aa, edge: 0x223344 })
  batch.setAppearance({ selected: 'two', theme: themed })
  const selected = batch.pieces[1]!
  const painted = new Color().fromBufferAttribute(attribute, selected.range.start)
  const expected = new Color(selected.group.color).lerp(new Color(themed.selected), 0.45)
  expect(painted.r).toBeCloseTo(expected.r)
  expect(painted.g).toBeCloseTo(expected.g)
  expect(painted.b).toBeCloseTo(expected.b)
  expect(batch.mesh.geometry.getAttribute('color')).toBe(attribute)
  batch.dispose()
  geometry.dispose()
})
