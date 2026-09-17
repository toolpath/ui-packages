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

/** Per-side allowance and centre offset in millimetres, in the part's coordinates. */
export function boxStockBounds(
  geometry: BufferGeometry,
  allowance: number | Vec3 = 0,
  offset: Vec3 = { x: 0, y: 0, z: 0 },
): Box3 {
  const padding =
    typeof allowance === 'number'
      ? new Vector3(allowance, allowance, allowance)
      : new Vector3(allowance.x, allowance.y, allowance.z)
  if (padding.toArray().some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Stock allowance must be finite and non-negative.')
  }
  if (![offset.x, offset.y, offset.z].every(Number.isFinite)) {
    throw new RangeError('Stock offset must be finite.')
  }
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
  box.expandByVector(padding).translate(new Vector3(offset.x, offset.y, offset.z))
  const size = box.getSize(new Vector3())
  if (size.toArray().some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Stock dimensions must be finite and positive.')
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
