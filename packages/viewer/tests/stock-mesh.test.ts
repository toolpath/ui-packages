import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it, vi } from 'vitest'
import fixture from '../fixtures/mesh/stock-box.json'
import { parseStockGlb, stockMeshGeometries } from '../src/render/stock-mesh.js'

describe('GLB stock geometry', () => {
  it('loads the services encoder output in millimetres without a report or decoder', async () => {
    const bytes = Uint8Array.from(Buffer.from(fixture.base64, 'base64'))
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const source = scene.children[0] as Mesh
    expect(source.geometry.hasAttribute('normal')).toBe(false)

    const [geometry] = await parseStockGlb(bytes.buffer)
    expect(geometry!.index?.count).toBe(36)
    expect(geometry!.getAttribute('position').count).toBe(8)
    expect(geometry!.hasAttribute('normal')).toBe(true)
    geometry!.computeBoundingBox()
    expect(geometry!.boundingBox!.min.toArray()).toEqual([-20, -20, -20])
    expect(geometry!.boundingBox!.max.toArray()).toEqual([20, 20, 20])
    expect(source.geometry.hasAttribute('normal')).toBe(false)
    geometry!.dispose()
  })

  it('applies nested transforms to every mesh without changing shared source geometry', () => {
    const source = new BoxGeometry(10, 20, 30)
    const material = new MeshBasicMaterial()
    const scene = new Group()
    scene.position.set(5, 7, 9)
    const nested = new Group()
    nested.rotation.z = Math.PI / 2
    const first = new Mesh(source, material)
    first.position.x = 20
    nested.add(first)
    const second = new Mesh(source, material)
    second.position.z = 50
    scene.add(nested, second)
    const original = source.getAttribute('position').array.slice()
    const sourceDisposed = vi.spyOn(source, 'dispose')
    const materialDisposed = vi.spyOn(material, 'dispose')

    const geometries = stockMeshGeometries(scene)
    const centers = geometries.map((geometry) => {
      geometry.computeBoundingBox()
      return geometry.boundingBox!.getCenter(new Vector3()).toArray()
    })
    expect(centers).toEqual([
      [5, 27, 9],
      [5, 7, 59],
    ])
    expect(geometries[0]!.boundingBox!.getSize(new Vector3()).toArray()).toEqual([20, 10, 30])
    geometries.forEach((geometry) => geometry.dispose())
    expect(source.getAttribute('position').array).toEqual(original)
    expect(sourceDisposed).not.toHaveBeenCalled()
    expect(materialDisposed).not.toHaveBeenCalled()
    source.dispose()
    material.dispose()
  })

  it('rejects a GLB scene without stock geometry', () => {
    expect(() => stockMeshGeometries(new Group())).toThrow('The stock GLB contains no mesh.')
  })

  it('rejects unreadable GLB bytes', async () => {
    await expect(parseStockGlb(new ArrayBuffer(12))).rejects.toThrow()
  })
})
