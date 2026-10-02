import {
  Box3,
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
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

/** How explicit fixed stock is positioned relative to the part's Z bounds. */
export type StockPosition = 'model_centered' | 'offset_from_top' | 'offset_from_bottom'

/**
 * Round stock in part coordinates, in millimetres: the centre of its base, the
 * direction from the base toward its far end, and its size. The Engine's
 * resolved `StockCylinder` carries the same four figures.
 */
export interface CylinderStockFigure {
  origin: Vec3
  axis: Vec3
  diameter: number
  length: number
}

/**
 * A block squared to a frame of its own rather than to the part, in
 * millimetres. `lower` and `upper` are corners in `frame`, whose point
 * `(x, y, z)` sits at `location + x·refDirection + y·(axis × refDirection) + z·axis`
 * in part coordinates, with `axis` normalised and `refDirection` projected
 * square to it and normalised. This is the shape of the Engine's plan
 * `StockBox`, which is squared to the setup.
 */
export interface BoxStockFigure {
  /** Omit for a box whose corners are already in part coordinates. */
  frame?: { location: Vec3; axis: Vec3; refDirection: Vec3 }
  lower: Vec3
  upper: Vec3
}

/** Box preview around the part: explicit dimensions or per-side allowance. */
export type BoxStockPreview = {
  partGeometry: BufferGeometry
  offset?: Vec3
} & (
  | { dimensions: Vec3; position?: StockPosition; positionOffset?: number; allowance?: never }
  | { allowance?: StockAllowance; dimensions?: never; position?: never; positionOffset?: never }
)

/** Resolved corners or part-relative preview options, never both. */
export type BoxStockInput =
  | (BoxStockFigure & {
      partGeometry?: never
      offset?: never
      allowance?: never
      dimensions?: never
      position?: never
      positionOffset?: never
    })
  | (BoxStockPreview & { lower?: never; upper?: never; frame?: never })

/** Upright cylinder preview centered on the part's bounding box. */
export interface CylinderStockPreview {
  partGeometry: BufferGeometry
  diameter: number
  length: number
  position?: StockPosition
  positionOffset?: number
}

/** Resolved cylinder placement or part-relative preview options, never both. */
export type CylinderStockInput =
  | (CylinderStockFigure & { partGeometry?: never; position?: never; positionOffset?: never })
  | (CylinderStockPreview & { origin?: never; axis?: never })

function boxFigure(bounds: Box3): BoxStockFigure {
  return {
    lower: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
    upper: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
  }
}

/**
 * Sides on a cylinder's rings. Adjacent sides meet at under 6°, well inside the
 * outline's 15° crease, so the outline draws the two rims and no facet lines.
 */
const CYLINDER_SEGMENTS = 64

/** three.js builds a cylinder about +Y, centred on the origin. */
const CYLINDER_AXIS = new Vector3(0, 1, 0)

/**
 * Bounds for an explicit fixed box. X/Y are centered on the part's bounding
 * box; Z is centered, offset from the top, or offset from the bottom. `offset`
 * then translates the complete box in part coordinates.
 */
export function fixedBoxStockBounds(
  geometry: BufferGeometry,
  dimensions: Vec3,
  position: StockPosition = 'model_centered',
  positionOffset = 0,
  offset: Vec3 = { x: 0, y: 0, z: 0 },
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
  if (![offset.x, offset.y, offset.z].every(Number.isFinite)) {
    throw new RangeError('Fixed stock offset must be finite.')
  }
  const part = partBounds(geometry)
  const center = part.getCenter(new Vector3())
  const z = fixedStockLowerZ(part, dimensions.z, position, positionOffset)
  return new Box3(
    new Vector3(center.x - dimensions.x / 2, center.y - dimensions.y / 2, z),
    new Vector3(center.x + dimensions.x / 2, center.y + dimensions.y / 2, z + dimensions.z),
  ).translate(new Vector3(offset.x, offset.y, offset.z))
}

/**
 * A preview of fixed round stock: `diameter` across and `length` long, standing
 * along the part's Z, centred on the part's bounding box across it, and placed
 * along it by the same position rule as {@link fixedBoxStockBounds}.
 *
 * It is a preview, as the legacy app's was. The kernel stands fixed round stock
 * along the first setup's cutting direction and centres it on the part's
 * smallest enclosing circle, which the bounding-box centre only approximates.
 * Once a job is planned, render the stock it resolved instead.
 */
function fixedCylinderStock(
  geometry: BufferGeometry,
  size: { diameter: number; length: number },
  position: StockPosition = 'model_centered',
  positionOffset = 0,
): CylinderStockFigure {
  if (![size.diameter, size.length].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Fixed stock diameter and length must be finite and positive.')
  }
  if (!Number.isFinite(positionOffset)) {
    throw new RangeError('Fixed stock position offset must be finite.')
  }
  const part = partBounds(geometry)
  const center = part.getCenter(new Vector3())
  return {
    origin: {
      x: center.x,
      y: center.y,
      z: fixedStockLowerZ(part, size.length, position, positionOffset),
    },
    axis: { x: 0, y: 0, z: 1 },
    diameter: size.diameter,
    length: size.length,
  }
}

/**
 * Where fixed stock `length` long starts along Z. Centred splits the extra
 * length evenly and ignores the offset; from the top puts the stock's top
 * `positionOffset` above the part's; from the bottom puts its bottom
 * `positionOffset` below the part's. The kernel places both fixed shapes by
 * this one rule, so both previews share it too.
 */
function fixedStockLowerZ(
  part: Box3,
  length: number,
  position: StockPosition,
  positionOffset: number,
): number {
  if (position === 'offset_from_top') return part.max.z + positionOffset - length
  if (position === 'offset_from_bottom') return part.min.z - positionOffset
  return (part.min.z + part.max.z - length) / 2
}

/** A closed cylinder for `figure`, in part coordinates. */
export function cylinderStockGeometry(input: CylinderStockInput): BufferGeometry {
  const figure: CylinderStockFigure = input.partGeometry
    ? fixedCylinderStock(input.partGeometry, input, input.position, input.positionOffset)
    : input
  const { origin, diameter, length } = figure
  if (![origin.x, origin.y, origin.z].every(Number.isFinite)) {
    throw new RangeError('Cylinder stock origin must be finite.')
  }
  if (![diameter, length].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Cylinder stock diameter and length must be finite and positive.')
  }
  const axis = new Vector3(figure.axis.x, figure.axis.y, figure.axis.z)
  const norm = axis.length()
  if (!Number.isFinite(norm) || norm === 0) {
    throw new RangeError('Cylinder stock axis must be finite and non-zero.')
  }
  axis.divideScalar(norm)
  const center = axis
    .clone()
    .multiplyScalar(length / 2)
    .add(new Vector3(origin.x, origin.y, origin.z))
  return new CylinderGeometry(diameter / 2, diameter / 2, length, CYLINDER_SEGMENTS)
    .applyQuaternion(new Quaternion().setFromUnitVectors(CYLINDER_AXIS, axis))
    .translate(center.x, center.y, center.z)
}

/** Resolve preview options when supplied, then build a box in part coordinates. */
export function boxStockGeometry(input: BoxStockInput): BufferGeometry {
  const figure: BoxStockFigure = input.partGeometry
    ? boxFigure(
        input.dimensions
          ? fixedBoxStockBounds(
              input.partGeometry,
              input.dimensions,
              input.position,
              input.positionOffset,
              input.offset,
            )
          : boxStockBounds(input.partGeometry, input.allowance, input.offset),
      )
    : input
  return orientedBoxStockGeometry(figure)
}

/** A closed block for `figure`, in part coordinates. */
export function orientedBoxStockGeometry(figure: BoxStockFigure): BufferGeometry {
  const { lower, upper } = figure
  const frame = figure.frame ?? {
    location: { x: 0, y: 0, z: 0 },
    axis: { x: 0, y: 0, z: 1 },
    refDirection: { x: 1, y: 0, z: 0 },
  }
  const { location, axis, refDirection } = frame
  if (
    ![location, axis, refDirection, lower, upper].every((vector) =>
      [vector.x, vector.y, vector.z].every(Number.isFinite),
    )
  ) {
    throw new RangeError('Box stock frame and corners must be finite.')
  }
  const size = new Vector3(upper.x - lower.x, upper.y - lower.y, upper.z - lower.z)
  if (size.toArray().some((value) => !(value > 0))) {
    throw new RangeError('Box stock upper corner must be above its lower corner on every axis.')
  }
  // Directions, not lengths: as in a STEP placement, the axis is normalised and
  // the reference direction is projected square to it, so a non-unit or
  // slightly skewed frame neither scales nor shears the block.
  const z = new Vector3(axis.x, axis.y, axis.z).normalize()
  const x = new Vector3(refDirection.x, refDirection.y, refDirection.z)
  const reference = x.length()
  x.addScaledVector(z, -x.dot(z))
  // Projection leaves float noise, not zero, when the two are parallel.
  if (!(z.lengthSq() > 0 && x.length() > 1e-9 * reference)) {
    throw new RangeError(
      'Box stock frame axis and reference direction must be non-zero and not parallel.',
    )
  }
  x.normalize()
  const y = new Vector3().crossVectors(z, x)
  return new BoxGeometry(size.x, size.y, size.z)
    .translate((lower.x + upper.x) / 2, (lower.y + upper.y) / 2, (lower.z + upper.z) / 2)
    .applyMatrix4(new Matrix4().makeBasis(x, y, z).setPosition(location.x, location.y, location.z))
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
export function createStock(geometry: BufferGeometry, legacyWorkpiece = false) {
  const material = new MeshLambertMaterial({ transparent: true, depthWrite: false })
  const edgeMaterial = new LineBasicMaterial({ transparent: true, depthWrite: false })
  const mesh = new Mesh(geometry, material)
  const object = new Group()
  object.userData[STOCK_OBJECT] = true
  mesh.renderOrder = legacyWorkpiece ? 2 : 5
  mesh.raycast = () => {}
  object.add(mesh)
  if (legacyWorkpiece) {
    // Legacy Workpiece draws stock and stockShadow with the same material.
    // Share geometry/material rather than allocating a second copy of the GLB.
    const shadow = mesh.clone()
    shadow.raycast = () => {}
    object.add(shadow)
    edgeMaterial.depthWrite = true
  }
  let edges: LineSegments<EdgesGeometry, LineBasicMaterial> | null = null
  return {
    object,
    material,
    edgeMaterial,
    /**
     * Shows or hides the outline, building it the first time it is shown: the
     * edge pass reads every triangle, and stock cut by a toolpath has a great
     * many of them.
     */
    showEdges(show: boolean) {
      if (show && !edges) {
        edges = new LineSegments(new EdgesGeometry(geometry, 15), edgeMaterial)
        edges.renderOrder = legacyWorkpiece ? 1 : 6
        edges.raycast = () => {}
        object.add(edges)
      }
      if (edges) edges.visible = show
    },
    dispose() {
      material.dispose()
      edgeMaterial.dispose()
      edges?.geometry.dispose()
    },
  }
}
