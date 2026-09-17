import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Raycaster,
  Vector3,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { contentBounds, partBounds } from '../src/render/camera.js'
import { hitUnderRay } from '../src/render/section.js'
import { boxStockBounds, createStock } from '../src/render/stock.js'

describe('stock dimensions', () => {
  it('adds allowance on both sides and offsets from an off-origin part centre', () => {
    const geometry = new BoxGeometry(20, 30, 10).translate(40, -10, 5)
    const positions = geometry.getAttribute('position').array.slice()
    const stock = boxStockBounds(geometry, { x: 2, y: 3, z: 4 }, { x: 1, y: -2, z: 6 })
    expect(stock.getSize(new Vector3()).toArray()).toEqual([24, 36, 18])
    expect(stock.getCenter(new Vector3()).toArray()).toEqual([41, -12, 11])
    expect(geometry.getAttribute('position').array).toEqual(positions)
    expect(geometry.boundingBox).toBeNull()
  })

  it('supports uniform allowance and a tight-fitting blank', () => {
    const geometry = new BoxGeometry(20, 30, 10)
    expect(boxStockBounds(geometry, 3).getSize(new Vector3()).toArray()).toEqual([26, 36, 16])
    expect(boxStockBounds(geometry).getSize(new Vector3()).toArray()).toEqual([20, 30, 10])
  })

  it('rejects invalid inputs before they can produce NaN geometry', () => {
    const geometry = new BoxGeometry(20, 30, 10)
    for (const value of [-1, NaN, Infinity]) {
      expect(() => boxStockBounds(geometry, value)).toThrow(RangeError)
    }
    expect(() => boxStockBounds(geometry, 0, { x: NaN, y: 0, z: 0 })).toThrow(RangeError)
    expect(() => boxStockBounds(new BufferGeometry())).toThrow(RangeError)
    const point = new BufferGeometry().setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0], 3),
    )
    expect(() => boxStockBounds(point)).toThrow(RangeError)
    expect(boxStockBounds(point, 1).getSize(new Vector3()).toArray()).toEqual([2, 2, 2])
  })
})

describe('stock scene integration', () => {
  it('frames stock without changing part-relative bounds or intercepting tool rays', () => {
    const root = new Group()
    const part = new Mesh(new BoxGeometry(10, 10, 10))
    const stock = createStock(new BoxGeometry(30, 40, 50))
    root.add(part, stock.object)
    const framed = new Box3()
    const finished = new Box3()
    contentBounds(root, framed)
    partBounds(root, finished)
    expect(framed.getSize(new Vector3()).toArray()).toEqual([30, 40, 50])
    expect(finished.getSize(new Vector3()).toArray()).toEqual([10, 10, 10])
    const ray = new Raycaster(new Vector3(0, 0, 100), new Vector3(0, 0, -1))
    expect(hitUnderRay(ray, root)?.object).toBe(part)
    expect(hitUnderRay(ray, root)?.point.z).toBe(5)
    root.remove(stock.object)
    expect(contentBounds(root, new Box3()).radius).toBe(partBounds(root, new Box3()).radius)
    stock.dispose()
  })

  it('disposes owned GPU resources while leaving caller geometry reusable', () => {
    const geometry = new BoxGeometry(10, 10, 10)
    const stock = createStock(geometry)
    const inputDisposed = vi.spyOn(geometry, 'dispose')
    const edgesDisposed = vi.spyOn(stock.edges.geometry, 'dispose')
    const materialDisposed = vi.spyOn(stock.material, 'dispose')
    const edgeMaterialDisposed = vi.spyOn(stock.edgeMaterial, 'dispose')
    stock.dispose()
    expect(inputDisposed).not.toHaveBeenCalled()
    expect(edgesDisposed).toHaveBeenCalledOnce()
    expect(materialDisposed).toHaveBeenCalledOnce()
    expect(edgeMaterialDisposed).toHaveBeenCalledOnce()
  })
})
