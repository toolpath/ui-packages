import {
  Box3,
  type BufferGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three'
import type { Vec3 } from '../model/types.js'
import { STOCK_OBJECT } from './camera.js'

/**
 * Per-side stock left in millimetres, in the part's coordinates.
 *
 * `wall` is radial stock on X/Y and `floor` is axial stock on Z. The number
 * and `{ x, y, z }` forms remain accepted for callers using the original
 * uniform/axis-specific box-stock API.
 */
export type StockAllowance = number | Vec3 | { wall: number; floor: number }

/** How an explicit box is positioned relative to the part's Z bounds. */
export type StockPosition = 'model_centered' | 'offset_from_top' | 'offset_from_bottom'

/**
 * Bounds for an explicit fixed box. X/Y are centered on the part's bounding
 * box; Z is centered, offset from the top, or offset from the bottom.
 */
export function fixedBoxStockBounds(
  geometry: BufferGeometry,
  dimensions: Vec3,
  position: StockPosition = 'model_centered',
  positionOffset = 0,
): Box3 {
  if (
    ![dimensions.x, dimensions.y, dimensions.z].every(Number.isFinite) ||
    [dimensions.x, dimensions.y, dimensions.z].some((value) => value <= 0)
  ) {
    throw new RangeError('Fixed stock dimensions must be finite and positive.')
  }
  if (!Number.isFinite(positionOffset)) {
    throw new RangeError('Fixed stock position offset must be finite.')
  }
  const part = partBounds(geometry)
  const center = part.getCenter(new Vector3())
  const z =
    position === 'offset_from_top'
      ? part.max.z + positionOffset - dimensions.z / 2
      : position === 'offset_from_bottom'
        ? part.min.z - positionOffset + dimensions.z / 2
        : center.z
  const half = new Vector3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2)
  return new Box3(
    new Vector3(center.x, center.y, z).sub(half),
    new Vector3(center.x, center.y, z).add(half),
  )
}

/** Per-side allowance and centre offset in millimetres, in the part's coordinates. */
export function boxStockBounds(
  geometry: BufferGeometry,
  allowance: StockAllowance = 0,
  offset: Vec3 = { x: 0, y: 0, z: 0 },
): Box3 {
  const padding =
    typeof allowance === 'number'
      ? new Vector3(allowance, allowance, allowance)
      : 'wall' in allowance
        ? new Vector3(allowance.wall, allowance.wall, allowance.floor)
        : new Vector3(allowance.x, allowance.y, allowance.z)
  if (padding.toArray().some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Stock allowance must be finite and non-negative.')
  }
  if (![offset.x, offset.y, offset.z].every(Number.isFinite)) {
    throw new RangeError('Stock offset must be finite.')
  }
  const box = partBounds(geometry)
  box.expandByVector(padding).translate(new Vector3(offset.x, offset.y, offset.z))
  const size = box.getSize(new Vector3())
  if (size.toArray().some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Stock dimensions must be finite and positive.')
  }
  return box
}

function partBounds(geometry: BufferGeometry): Box3 {
  const position = geometry.getAttribute('position')
  if (!position || position.count === 0)
    throw new RangeError('Stock needs non-empty part geometry.')
  const box = new Box3()
  const point = new Vector3()
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index)
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      throw new RangeError('Stock needs finite part coordinates.')
    }
    box.expandByPoint(point)
  }
  return box
}

/** Owns the stock materials and outline, never the caller's geometry. */
export function createStock(geometry: BufferGeometry) {
  const material = new MeshLambertMaterial({ transparent: true, depthWrite: false })
  const edgeMaterial = new LineBasicMaterial({ transparent: true, depthWrite: false })
  const mesh = new Mesh(geometry, material)
  const edgeGeometry = new EdgesGeometry(geometry, 15)
  const edges = new LineSegments(edgeGeometry, edgeMaterial)
  const object = new Group()
  object.userData[STOCK_OBJECT] = true
  mesh.renderOrder = 5
  edges.renderOrder = 6
  mesh.raycast = () => {}
  edges.raycast = () => {}
  object.add(mesh, edges)
  return {
    object,
    material,
    edgeMaterial,
    edges,
    dispose() {
      material.dispose()
      edgeMaterial.dispose()
      edgeGeometry.dispose()
    },
  }
}
