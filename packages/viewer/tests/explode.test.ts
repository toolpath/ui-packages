import {
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Raycaster,
  Vector3,
  type LineBasicMaterial,
  type LineSegments,
  type Mesh,
  type MeshLambertMaterial,
} from 'three'
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
import { regionEdgesGeometry } from '../src/render/edges.js'
import { resolveExplodeTheme } from '../src/render/explode-theme.js'
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
  it('paints regions within whole pieces, keeping repeated surfaces independent and buffers stable', async () => {
    const { model, geometry, groups, region } = await source()
    const other = model.regions.find((r) => r.idx !== region)!.idx
    const layout = groups.map((g) => ({ ...g, regionIdxs: [region, other] }))
    const batch = createExplodeBatch(model, geometry, layout)
    const buffers = { ...batch.mesh.geometry.attributes }
    const colors = new Map([
      [
        'left-piece',
        new Map([
          [region, 0xff0000],
          [other, 0x0000ff],
        ]),
      ],
      ['right-piece', new Map([[region, 0x00ff00]])],
    ])
    const vertexColor = (id: string, idx: number) => {
      const piece = batch.pieces.find((p) => p.group.id === id)!
      const start = piece.regions.find((r) => r.idx === idx)!.start
      const attribute = batch.mesh.geometry.getAttribute('color')
      return new Color().fromBufferAttribute(attribute, start)
    }
    batch.setAppearance(undefined, null, null, undefined, colors)
    expect(vertexColor('left-piece', region).getHex()).toBe(0xff0000)
    expect(vertexColor('right-piece', region).getHex()).toBe(0x00ff00)
    expect(vertexColor('left-piece', other).getHex()).toBe(0x0000ff)
    expect(vertexColor('right-piece', other).getHex()).toBe(layout[1]!.color)
    for (const kind of ['hover', 'select'] as const) {
      batch.setAppearance(
        undefined,
        kind === 'select' ? 'left-piece' : null,
        kind === 'hover' ? 'left-piece' : null,
        undefined,
        colors,
      )
      const tint = kind === 'select' ? 0.45 : 0.25
      for (const [idx, base] of [
        [region, 0xff0000],
        [other, 0x0000ff],
      ]) {
        expect(vertexColor('left-piece', idx!).getHex()).toBe(
          new Color(base).lerp(new Color(0xffffff), tint).getHex(),
        )
      }
      expect(vertexColor('right-piece', region).getHex()).toBe(0x00ff00)
    }
    batch.setAppearance(new Map([['left-piece', 0xffff00]]), null, null)
    expect(vertexColor('left-piece', region).getHex()).toBe(0xffffff)
    const instance = new Color()
    batch.mesh.getColorAt(0, instance)
    expect(instance.getHex()).toBe(0xffff00)
    batch.setAppearance(undefined, 'left-piece', null, undefined, colors)
    const origin = batch.object.getObjectByName('explode-origin') as Mesh
    expect(origin.geometry.drawRange.count).toBe(batch.pieces[0]!.range.count)
    batch.setAmount(0.5)
    batch.setAmount(1)
    expect(batch.mesh.geometry.attributes).toEqual(buffers)
    for (const piece of batch.pieces) {
      for (let local = 0; local < piece.sourceTriangles.length; local += 1) {
        expect(batch.hit(piece.instanceId, piece.range.start / 3 + local)?.group.id).toBe(
          piece.group.id,
        )
      }
    }
    batch.dispose()
    geometry.dispose()
  })

  it('selects and hovers multiple chunks with the complete source overlay, retaining buffers', async () => {
    const { model, geometry, groups } = await source()
    const batch = createExplodeBatch(model, geometry, [
      groups[0]!,
      { ...groups[0]!, id: 'other', offset: { x: 0, y: 40, z: 0 } },
      groups[1]!,
    ])
    const origin = batch.object.getObjectByName('explode-origin') as Mesh
    const positions = batch.mesh.geometry.getAttribute('position')
    const indices = origin.geometry.index!
    const ids = ['left-piece', 'right-piece']
    const theme = resolveExplodeTheme({ highlight: 0xffa31a, hover: 0xffb066 })
    batch.setAppearance(undefined, null, ids, theme)
    for (const piece of batch.pieces) {
      const actual = new Color()
      batch.mesh.getColorAt(piece.instanceId, actual)
      const expected = new Color(piece.group.color)
      if (ids.includes(piece.group.id)) {
        expected.lerp(new Color(theme.hovered), 0.25)
      }
      expect(actual.r).toBeCloseTo(expected.r)
      expect(actual.g).toBeCloseTo(expected.g)
      expect(actual.b).toBeCloseTo(expected.b)
    }
    batch.setAppearance(undefined, ids, null, theme)
    batch.setAmount(1)
    const selected = batch.pieces.filter((piece) => ids.includes(piece.group.id))
    const count = selected.reduce((sum, piece) => sum + piece.range.count, 0)
    expect(origin.visible).toBe(true)
    expect(origin.geometry.drawRange).toEqual({ start: 0, count })
    expect(Array.from(indices.array.slice(0, count))).toEqual(
      selected.flatMap((piece) =>
        Array.from({ length: piece.range.count }, (_, i) => piece.range.start + i),
      ),
    )
    for (const piece of batch.pieces) {
      const actual = new Color()
      batch.mesh.getColorAt(piece.instanceId, actual)
      const expected = new Color(piece.group.color)
      if (ids.includes(piece.group.id)) {
        expected.lerp(new Color(theme.selected), 0.45)
      }
      expect(actual.r).toBeCloseTo(expected.r)
      expect(actual.g).toBeCloseTo(expected.g)
      expect(actual.b).toBeCloseTo(expected.b)
    }
    batch.setAppearance(undefined, ['right-piece'], null, theme)
    expect(origin.geometry.index).toBe(indices)
    expect(batch.mesh.geometry.getAttribute('position')).toBe(positions)
    expect(origin.geometry.drawRange.count).toBe(selected[1]!.range.count)
    batch.setAppearance(undefined, [], null, theme)
    expect(origin.visible).toBe(false)
    expect(origin.geometry.drawRange.count).toBe(0)
    batch.dispose()
    geometry.dispose()
  })
  it('outlines compact regions without feature data and preserves split-surface lineage', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
    )
    const regions = [
      { idx: 3, splitOrigin: 7, shapeKind: 'Plane', area: 0.5, triangles: { start: 0, end: 1 } },
      { idx: 9, splitOrigin: 7, shapeKind: 'Plane', area: 0.5, triangles: { start: 1, end: 2 } },
    ]
    const copy = extractExplodeGroup({ regions }, geometry, { regionIdxs: [9, 3, 9] })
    expect(Array.from(copy.sourceTriangles)).toEqual([1, 0])
    expect(copy.regions.map((region) => region.idx)).toEqual([9, 3])
    const edges = regionEdgesGeometry(copy.geometry, copy)
    // The shared diagonal is an analysis split, not an edge of either copy.
    expect(edges.getAttribute('position').count).toBe(8)
    expect(copy.geometry.getAttribute('normal').count).toBe(6)
    expect(regions.map((region) => region.triangles)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ])
    edges.dispose()
    copy.geometry.dispose()
    geometry.dispose()
  })

  it('updates theme colors and opacity without replacing geometry, materials, or pick identities', async () => {
    const { model, geometry, groups } = await source()
    const batch = createExplodeBatch(model, geometry, groups)
    batch.setAppearance(undefined, 'right-piece', 'left-piece')
    batch.setAmount(0.4)
    const positions = batch.mesh.geometry.getAttribute('position')
    const material = batch.mesh.material as MeshLambertMaterial
    const outline = batch.object.getObjectByName('explode-edges') as LineSegments<
      BufferGeometry,
      LineBasicMaterial
    >
    const edgePositions = outline.geometry.getAttribute('position')
    const origin = batch.object.getObjectByName('explode-origin') as Mesh<
      BufferGeometry,
      MeshLambertMaterial
    >
    const theme = resolveExplodeTheme({
      part: 0xd5dae2,
      partEmissive: 0x101820,
      edge: 0x224466,
      edgeOpacity: 0.25,
      highlight: 0x007799,
      hover: 0xbb3300,
    })
    batch.setAppearance(undefined, 'right-piece', 'left-piece', theme)
    const color = new Color()
    for (const piece of batch.pieces) {
      batch.mesh.getColorAt(piece.instanceId, color)
      const selected = piece.group.id === 'right-piece'
      const expected = new Color(piece.group.color).lerp(
        new Color(selected ? theme.selected : theme.hovered),
        selected ? 0.45 : 0.25,
      )
      expect(color.r).toBeCloseTo(expected.r)
      expect(color.g).toBeCloseTo(expected.g)
      expect(color.b).toBeCloseTo(expected.b)
      expect(batch.hit(piece.instanceId, piece.range.start / 3)?.group.id).toBe(piece.group.id)
    }
    expect(material.emissive.getHex()).toBe(theme.emissive)
    expect(outline.material.color.getHex()).toBe(theme.edge)
    expect(outline.material.opacity).toBe(0.25)
    expect(
      origin.material.color.equals(new Color(theme.source).lerp(new Color(0xffffff), 0.45)),
    ).toBe(true)
    batch.setAmount(0.05)
    expect(outline.material.opacity).toBe(0.125)
    batch.setAppearance(undefined, null, null)
    batch.mesh.getColorAt(0, color)
    expect(color.getHex()).toBe(groups[0]!.color)
    expect(outline.material.color.getHex()).toBe(0x182535)
    expect(outline.material.opacity).toBe(0.45)
    expect(batch.mesh.geometry.getAttribute('position')).toBe(positions)
    expect(outline.geometry.getAttribute('position')).toBe(edgePositions)
    expect(batch.mesh.material).toBe(material)
    batch.dispose()
    geometry.dispose()
  })

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
    expect(copy.regions[0]!.idx).toBe(group.regionIdxs[0])
    expect(copy.sourceTriangles[0]).toBe(
      model.regionIndex.rangeForRegion(group.regionIdxs[0]!)!.start,
    )
    copy.geometry.dispose()
    geometry.dispose()
  })
})
