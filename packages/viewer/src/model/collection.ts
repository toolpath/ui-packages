import { Box3, type BufferGeometry, Vector3 } from 'three'
import type { Vec3 } from './types.js'

interface CollectionBody {
  id: string
  geometry: BufferGeometry
}

export interface CollectionBoundsOptions {
  /**
   * Each item's full displacement, as `<PartCollection explode>` takes it. Given, the bounds
   * hold every item wherever an explode amount from 0 to 1 puts it: each item's box both where
   * it is and moved by its offset. Items without an offset count where they are.
   */
  offsets?: ReadonlyMap<string, Vec3>
}

/** Measures a complete collection without moving or taking ownership of its geometry. */
export const collectionBounds = (
  items: ReadonlyArray<CollectionBody>,
  { offsets }: CollectionBoundsOptions = {},
): Box3 => {
  const box = new Box3()
  for (const { id, bounds } of measureBodies(items)) {
    box.union(bounds)
    const offset = offsets?.get(id)
    if (offset) {
      box.union(bounds.translate(new Vector3(offset.x, offset.y, offset.z)))
    }
  }
  return box
}

export interface CollectionExplodeOptions {
  /**
   * The space left between bodies' bounding boxes once apart, as a fraction of the whole
   * collection's bounding-box diagonal. 0.05 by default.
   */
  gap?: number
}

const DEFAULT_GAP = 0.05

/** Bodies centred within this fraction of the collection's diagonal of its centre have no line. */
const CENTRED = 1e-6

/** The direction for bodies with no line of their own: up, in the viewer's Z-up frame. */
const FALLBACK = new Vector3(0, 0, 1)

const ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 })

/**
 * How far each body of a collection moves to be pulled apart from the others, by item id: the
 * full displacement in world units, as `<PartCollection explode>` takes it.
 *
 * Each body moves along the line from the collection's centre to its own bounds' centre, by the
 * least distance that leaves its bounding box clear of the boxes of the bodies already placed,
 * `gap` apart. Bodies are placed nearest the centre first, ties in `items` order, so the
 * innermost body stays where it is and bodies already clear of the others do not move. A body
 * centred on the collection's centre, as nested bodies often are, has no line of its own and
 * moves up (+Z) instead, so several of them stack. Hidden items count like any other.
 *
 * A single body, and a body with no geometry, gets a zero offset. The result depends only on
 * the bodies' bounds and order. Pure: no React, DOM or GPU.
 */
export const collectionExplodeOffsets = (
  items: ReadonlyArray<CollectionBody>,
  { gap = DEFAULT_GAP }: CollectionExplodeOptions = {},
): Map<string, Vec3> => {
  const bodies = measureBodies(items)
  const offsets = new Map<string, Vec3>()
  const whole = new Box3()
  for (const body of bodies) {
    offsets.set(body.id, ZERO)
    whole.union(body.bounds)
  }
  if (whole.isEmpty()) {
    return offsets
  }
  const centre = whole.getCenter(new Vector3())
  const diagonal = whole.getSize(new Vector3()).length()
  const space = Math.max(0, gap) * diagonal
  const placing = bodies
    .filter((body) => !body.bounds.isEmpty())
    .map((body) => {
      const away = body.bounds.getCenter(new Vector3()).sub(centre)
      const distance = away.length()
      return {
        ...body,
        distance,
        direction: distance > CENTRED * diagonal ? away.divideScalar(distance) : FALLBACK,
      }
    })
    // Stable: ties keep `items` order.
    .sort((a, b) => a.distance - b.distance)
  const placed: Array<Box3> = []
  for (const body of placing) {
    const offset = body.direction
      .clone()
      .multiplyScalar(clearDistance(body.bounds, body.direction, placed, space))
    placed.push(body.bounds.clone().translate(offset))
    if (offset.lengthSq() > 0) {
      offsets.set(body.id, { x: offset.x, y: offset.y, z: offset.z })
    }
  }
  return offsets
}

/**
 * The least distance along `direction` at which `box` overlaps none of `placed`, each grown by
 * `space`. Moving along a line, a box overlaps another box over one interval of distance at
 * most, so the answer is the first distance outside all of them.
 */
const clearDistance = (
  box: Box3,
  direction: Vector3,
  placed: ReadonlyArray<Box3>,
  space: number,
): number => {
  const blocked: Array<readonly [number, number]> = []
  for (const other of placed) {
    const interval = overlapInterval(box, direction, other, space)
    if (interval) {
      blocked.push(interval)
    }
  }
  blocked.sort((a, b) => a[0] - b[0])
  let at = 0
  for (const [from, to] of blocked) {
    if (from > at) {
      break
    }
    at = Math.max(at, to)
  }
  return at
}

const AXES = ['x', 'y', 'z'] as const

/** The open interval of distances along `direction` at which `box` overlaps `other` grown by `space`. */
const overlapInterval = (
  box: Box3,
  direction: Vector3,
  other: Box3,
  space: number,
): readonly [number, number] | null => {
  let from = -Infinity
  let to = Infinity
  for (const axis of AXES) {
    const step = direction[axis]
    const low = other.min[axis] - space
    const high = other.max[axis] + space
    if (step === 0) {
      // It never moves on this axis, so it overlaps on it always or never.
      if (box.max[axis] <= low || box.min[axis] >= high) {
        return null
      }
      continue
    }
    const enter = (low - box.max[axis]) / step
    const leave = (high - box.min[axis]) / step
    from = Math.max(from, Math.min(enter, leave))
    to = Math.min(to, Math.max(enter, leave))
  }
  return from < to ? [from, to] : null
}

/** Each item's own bounds, in order, refusing two items with one id. */
const measureBodies = (
  items: ReadonlyArray<CollectionBody>,
): Array<{ id: string; bounds: Box3 }> => {
  const ids = new Set<string>()
  return items.map((item) => {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate collection item id: ${item.id}`)
    }
    ids.add(item.id)
    if (!item.geometry.boundingBox) {
      item.geometry.computeBoundingBox()
    }
    return { id: item.id, bounds: item.geometry.boundingBox?.clone() ?? new Box3() }
  })
}
