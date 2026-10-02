import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Mesh,
  Raycaster,
  Vector3,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Vec3 } from '../src/model/types.js'
import { contentBounds, partBounds } from '../src/render/camera.js'
import { hitUnderRay } from '../src/render/section.js'
import {
  boxStockBounds,
  boxStockGeometry,
  createStock,
  cylinderStockGeometry,
  fixedBoxStockBounds,
  orientedBoxStockGeometry,
  type StockPosition,
} from '../src/render/stock.js'

const bounds = (geometry: BufferGeometry) => {
  geometry.computeBoundingBox()
  return geometry.boundingBox!
}

/**
 * Where every vertex of a cylinder mesh sits relative to the figure: how far
 * along the axis from the base, and how far out from the axis.
 */
function cylinderSpan(geometry: BufferGeometry, origin: Vec3, axis: Vec3) {
  const base = new Vector3(origin.x, origin.y, origin.z)
  const direction = new Vector3(axis.x, axis.y, axis.z).normalize()
  const position = geometry.getAttribute('position')
  const point = new Vector3()
  let along = { min: Infinity, max: -Infinity }
  let radius = 0
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).sub(base)
    const t = point.dot(direction)
    along = { min: Math.min(along.min, t), max: Math.max(along.max, t) }
    radius = Math.max(radius, point.addScaledVector(direction, -t).length())
  }
  return { along, radius }
}

describe('stock dimensions', () => {
  it('renders allowance and fixed-dimension preview options in part coordinates', () => {
    const part = new BoxGeometry(20, 30, 10).translate(40, -10, 5)
    const padded = bounds(
      boxStockGeometry({
        partGeometry: part,
        allowance: { wall: 2, floor: 3 },
        offset: { x: 1, y: 2, z: 3 },
      }),
    )
    expect(padded.min.toArray()).toEqual([29, -25, 0])
    expect(padded.max.toArray()).toEqual([53, 9, 16])
    const fixed = bounds(
      boxStockGeometry({
        partGeometry: part,
        dimensions: { x: 40, y: 50, z: 20 },
        position: 'offset_from_top',
        positionOffset: 2,
      }),
    )
    expect(fixed.min.toArray()).toEqual([20, -35, -8])
    expect(fixed.max.toArray()).toEqual([60, 15, 12])
  })
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

  it('maps wall leave to X/Y and floor leave to Z', () => {
    const geometry = new BoxGeometry(20, 30, 10)
    expect(
      boxStockBounds(geometry, { wall: 0.254, floor: 0.508 }).getSize(new Vector3()).toArray(),
    ).toEqual([20.508, 30.508, 11.016])
  })

  it('positions fixed box stock from the model center or top/bottom', () => {
    const geometry = new BoxGeometry(20, 30, 10)
    const dimensions = { x: 40, y: 50, z: 20 }
    expect(fixedBoxStockBounds(geometry, dimensions).getCenter(new Vector3()).toArray()).toEqual([
      0, 0, 0,
    ])
    expect(
      fixedBoxStockBounds(geometry, dimensions, 'offset_from_top', 2)
        .getCenter(new Vector3())
        .toArray(),
    ).toEqual([0, 0, -3])
    expect(
      fixedBoxStockBounds(geometry, dimensions, 'offset_from_bottom', 2)
        .getCenter(new Vector3())
        .toArray(),
    ).toEqual([0, 0, 3])
    expect(
      fixedBoxStockBounds(geometry, dimensions, 'model_centered', 0, { x: 4, y: -2, z: 3 })
        .getCenter(new Vector3())
        .toArray(),
    ).toEqual([4, -2, 3])
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

describe('fixed cylinder stock', () => {
  const part = () => new BoxGeometry(20, 30, 10).translate(40, -10, 5)

  it('stands on the part Z and centres on its bounding box', () => {
    const box = bounds(cylinderStockGeometry({ partGeometry: part(), diameter: 50, length: 20 }))
    expect(box.min.toArray()).toEqual([15, -35, -5])
    expect(box.max.toArray()).toEqual([65, 15, 15])
  })

  it('places its ends by the same rule as a fixed box', () => {
    const cases: [StockPosition, number, number][] = [
      ['model_centered', 3, -5],
      ['offset_from_top', 2, -8],
      ['offset_from_bottom', 2, -2],
      ['offset_from_top', -1, -11],
    ]
    for (const [position, offset, bottom] of cases) {
      const cylinder = bounds(
        cylinderStockGeometry({
          partGeometry: part(),
          diameter: 50,
          length: 20,
          position,
          positionOffset: offset,
        }),
      )
      const box = fixedBoxStockBounds(part(), { x: 50, y: 50, z: 20 }, position, offset)
      expect(cylinder.min.z).toBe(bottom)
      expect(cylinder.min.z).toBe(box.min.z)
      expect(cylinder.max.z).toBe(box.max.z)
    }
  })

  it('rejects sizes and offsets that would build NaN geometry', () => {
    for (const value of [0, -1, NaN, Infinity]) {
      expect(() =>
        cylinderStockGeometry({ partGeometry: part(), diameter: value, length: 20 }),
      ).toThrow(RangeError)
      expect(() =>
        cylinderStockGeometry({ partGeometry: part(), diameter: 20, length: value }),
      ).toThrow(RangeError)
    }
    expect(() =>
      cylinderStockGeometry({
        partGeometry: part(),
        diameter: 20,
        length: 20,
        position: 'offset_from_top',
        positionOffset: NaN,
      }),
    ).toThrow(RangeError)
    expect(() =>
      cylinderStockGeometry({ partGeometry: new BufferGeometry(), diameter: 20, length: 20 }),
    ).toThrow(RangeError)
  })
})

describe('cylinder stock geometry', () => {
  it('runs from the base centre along the axis, whichever way the axis points', () => {
    const origin = { x: 4, y: -7, z: 2 }
    const axes: Vec3[] = [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 2, y: 2, z: 1 },
    ]
    for (const axis of axes) {
      const geometry = cylinderStockGeometry({ origin, axis, diameter: 30, length: 80 })
      const { along, radius } = cylinderSpan(geometry, origin, axis)
      // Positions are float32, so a micron is as close as they can agree.
      expect(along.min).toBeCloseTo(0, 4)
      expect(along.max).toBeCloseTo(80, 4)
      expect(radius).toBeCloseTo(15, 4)
    }
  })

  it('lies along X as round stock lying down does', () => {
    const box = bounds(
      cylinderStockGeometry({
        origin: { x: -5, y: 1, z: 2 },
        axis: { x: 1, y: 0, z: 0 },
        diameter: 20,
        length: 60,
      }),
    )
    expect(box.min.x).toBeCloseTo(-5, 9)
    expect(box.max.x).toBeCloseTo(55, 9)
    expect(box.min.y).toBeCloseTo(-9, 9)
    expect(box.max.y).toBeCloseTo(11, 9)
    expect(box.min.z).toBeCloseTo(-8, 9)
    expect(box.max.z).toBeCloseTo(12, 9)
  })

  it('outlines only its two rims', () => {
    const geometry = cylinderStockGeometry({
      origin: { x: 0, y: 0, z: 0 },
      axis: { x: 1, y: 1, z: 0 },
      diameter: 300,
      length: 40,
    })
    // Two vertices per edge, one edge per side on each of the two rims.
    expect(new EdgesGeometry(geometry, 15).getAttribute('position').count).toBe(2 * 2 * 64)
  })

  it('rejects figures that would build NaN geometry', () => {
    const figure = {
      origin: { x: 0, y: 0, z: 0 },
      axis: { x: 0, y: 0, z: 1 },
      diameter: 10,
      length: 10,
    }
    expect(() => cylinderStockGeometry({ ...figure, axis: { x: 0, y: 0, z: 0 } })).toThrow(
      RangeError,
    )
    expect(() => cylinderStockGeometry({ ...figure, axis: { x: NaN, y: 0, z: 1 } })).toThrow(
      RangeError,
    )
    expect(() => cylinderStockGeometry({ ...figure, origin: { x: Infinity, y: 0, z: 0 } })).toThrow(
      RangeError,
    )
    expect(() => cylinderStockGeometry({ ...figure, diameter: 0 })).toThrow(RangeError)
    expect(() => cylinderStockGeometry({ ...figure, length: -1 })).toThrow(RangeError)
  })
})

describe('oriented box stock geometry', () => {
  it('uses part-coordinate corners when no frame is supplied', () => {
    const box = bounds(
      orientedBoxStockGeometry({
        lower: { x: -5, y: 10, z: 20 },
        upper: { x: 15, y: 40, z: 60 },
      }),
    )
    expect(box.min.toArray()).toEqual([-5, 10, 20])
    expect(box.max.toArray()).toEqual([15, 40, 60])
  })
  const frame = {
    location: { x: 5, y: 5, z: 5 },
    axis: { x: 0, y: 0, z: 1 },
    refDirection: { x: 1, y: 0, z: 0 },
  }

  it('places the corners in an unrotated frame at its location', () => {
    const box = bounds(
      orientedBoxStockGeometry({
        frame,
        lower: { x: -1, y: -2, z: -3 },
        upper: { x: 10, y: 20, z: 30 },
      }),
    )
    expect(box.min.toArray()).toEqual([4, 3, 2])
    expect(box.max.toArray()).toEqual([15, 25, 35])
  })

  it('reads corners along refDirection, axis × refDirection and axis', () => {
    const box = bounds(
      orientedBoxStockGeometry({
        // x runs along part Y, y along part Z (axis × refDirection), z along part X.
        frame: { ...frame, axis: { x: 1, y: 0, z: 0 }, refDirection: { x: 0, y: 1, z: 0 } },
        lower: { x: 0, y: 0, z: 0 },
        upper: { x: 10, y: 20, z: 30 },
      }),
    )
    expect(box.min.toArray()).toEqual([5, 5, 5])
    expect(box.max.toArray()).toEqual([35, 15, 25])
  })

  it('reads the frame as directions, so a non-unit or skewed frame neither scales nor shears', () => {
    const box = bounds(
      orientedBoxStockGeometry({
        // A long axis, and a long reference direction tilted toward it.
        frame: { ...frame, axis: { x: 0, y: 0, z: 3 }, refDirection: { x: 2, y: 0, z: 0.5 } },
        lower: { x: -1, y: -2, z: -3 },
        upper: { x: 10, y: 20, z: 30 },
      }),
    )
    expect(box.min.toArray()).toEqual([4, 3, 2])
    expect(box.max.toArray()).toEqual([15, 25, 35])
  })

  it('rejects degenerate frames and inverted corners', () => {
    const lower = { x: 0, y: 0, z: 0 }
    const upper = { x: 1, y: 1, z: 1 }
    expect(() =>
      orientedBoxStockGeometry({
        frame: { ...frame, refDirection: { x: 0, y: 0, z: 2 } },
        lower,
        upper,
      }),
    ).toThrow(RangeError)
    expect(() =>
      orientedBoxStockGeometry({ frame: { ...frame, axis: { x: 0, y: 0, z: 0 } }, lower, upper }),
    ).toThrow(RangeError)
    expect(() =>
      orientedBoxStockGeometry({
        frame: { ...frame, refDirection: { x: 0, y: 0, z: 0 } },
        lower,
        upper,
      }),
    ).toThrow(RangeError)
    expect(() =>
      orientedBoxStockGeometry({ frame, lower: upper, upper: { x: 2, y: 1, z: 2 } }),
    ).toThrow(RangeError)
    expect(() => orientedBoxStockGeometry({ frame, lower, upper: { x: 1, y: NaN, z: 1 } })).toThrow(
      RangeError,
    )
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

  it('builds its outline once, and only when it is first shown', () => {
    const stock = createStock(new BoxGeometry(10, 10, 10))
    stock.showEdges(false)
    expect(stock.object.children).toHaveLength(1)
    stock.showEdges(true)
    const [, edges] = stock.object.children
    expect(edges).toBeInstanceOf(LineSegments)
    stock.showEdges(false)
    expect(edges!.visible).toBe(false)
    stock.showEdges(true)
    expect(stock.object.children).toEqual([stock.object.children[0], edges])
    expect(edges!.visible).toBe(true)
    stock.dispose()
  })

  it('matches legacy surface passes and edge ordering without copying the source geometry', () => {
    const geometry = new BoxGeometry(10, 20, 30)
    const stock = createStock(geometry, true)
    stock.showEdges(true)
    const surfaces = stock.object.children.filter((child) => child instanceof Mesh)
    expect(surfaces).toHaveLength(2)
    for (const surface of surfaces) {
      expect((surface as Mesh).geometry).toBe(geometry)
      expect((surface as Mesh).material).toBe(stock.material)
      expect(surface.renderOrder).toBe(2)
    }
    const edges = stock.object.children.find((child) => child instanceof LineSegments)!
    expect(edges.renderOrder).toBe(1)
    expect(stock.edgeMaterial.depthWrite).toBe(true)
    expect(stock.material.depthTest).toBe(true)
    const root = new Group()
    const part = new Mesh(new BoxGeometry(1, 1, 1))
    root.add(stock.object, part)
    const ray = new Raycaster(new Vector3(0, 0, 100), new Vector3(0, 0, -1))
    expect(ray.intersectObject(root, true)[0]?.object).toBe(part)
    const dispose = vi.spyOn(geometry, 'dispose')
    stock.dispose()
    expect(dispose).not.toHaveBeenCalled()
    geometry.dispose()
  })

  it('disposes owned GPU resources while leaving caller geometry reusable', () => {
    const geometry = new BoxGeometry(10, 10, 10)
    const stock = createStock(geometry)
    stock.showEdges(true)
    const inputDisposed = vi.spyOn(geometry, 'dispose')
    const edges = stock.object.children[1] as LineSegments
    const edgesDisposed = vi.spyOn(edges.geometry, 'dispose')
    const materialDisposed = vi.spyOn(stock.material, 'dispose')
    const edgeMaterialDisposed = vi.spyOn(stock.edgeMaterial, 'dispose')
    stock.dispose()
    expect(inputDisposed).not.toHaveBeenCalled()
    expect(edgesDisposed).toHaveBeenCalledOnce()
    expect(materialDisposed).toHaveBeenCalledOnce()
    expect(edgeMaterialDisposed).toHaveBeenCalledOnce()
  })
})
