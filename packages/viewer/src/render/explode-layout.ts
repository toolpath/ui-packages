import { Box3, Vector3, type BufferGeometry } from 'three'
import { sameDirection } from '../model/directions.js'
import type { ExplodeAssignment, ExplodeGroup } from '../model/explode.js'
import type { PartModel } from '../model/types.js'

/**
 * The most pieces, and copied triangles, one `<ExplodedPart>` draws. Past either, it draws
 * nothing: `explodeFits` says so first, so an application can say why.
 */
export const EXPLODE_LIMITS = { groups: 4096, triangles: 1_000_000 } as const

/** Whether a layout is within `EXPLODE_LIMITS`. Regions the model lacks count for nothing. */
export const explodeFits = (model: PartModel, groups: ReadonlyArray<ExplodeGroup>): boolean => {
  if (groups.length > EXPLODE_LIMITS.groups) {
    return false
  }
  let triangles = 0
  for (const group of groups) {
    for (const region of new Set(group.regionIdxs)) {
      const range = model.regionIndex.rangeForRegion(region)
      triangles += range ? range.end - range.start : 0
    }
  }
  return triangles <= EXPLODE_LIMITS.triangles
}

/** How far a piece travels: past the far side of the part, and clear of others on its way. */
const CLEARANCE = 0.8
const BEYOND_PART = 0.35
const BEYOND_NEIGHBOUR = 0.08

/** The support interval of a box along a unit direction, oblique directions included. */
const project = (box: Box3, direction: Vector3): { min: number; max: number } => {
  let min = 0
  let max = 0
  for (const axis of ['x', 'y', 'z'] as const) {
    const a = box.min[axis] * direction[axis]
    const b = box.max[axis] * direction[axis]
    min += Math.min(a, b)
    max += Math.max(a, b)
  }
  return { min, max }
}

/** Each region's box in the source geometry. Regions with no triangles are left out. */
const regionBounds = (model: PartModel, geometry: BufferGeometry): Map<number, Box3> => {
  const position = geometry.getAttribute('position')
  const point = new Vector3()
  const bounds = new Map<number, Box3>()
  for (const region of model.regions) {
    const range = model.regionIndex.rangeForRegion(region.idx)
    if (!range) {
      continue
    }
    const box = new Box3()
    for (let vertex = range.start * 3; vertex < range.end * 3; vertex += 1) {
      box.expandByPoint(point.fromBufferAttribute(position, vertex))
    }
    bounds.set(region.idx, box)
  }
  return bounds
}

/**
 * Places each piece along its approach: clear of the part, and clear of earlier pieces that
 * share its surfaces and its approach, so two readings of one face never land on each other.
 * Pieces keep their order and identities; a piece with no approach stays where it is.
 * Reads each region's source triangles once, and never moves or copies the geometry.
 */
export const explodeLayout = (
  model: PartModel,
  geometry: BufferGeometry,
  assignments: ReadonlyArray<ExplodeAssignment>,
): Array<ExplodeGroup> => {
  const bounds = regionBounds(model, geometry)
  const whole = new Box3()
  for (const box of bounds.values()) {
    whole.union(box)
  }
  const diagonal = Math.max(whole.getSize(new Vector3()).length(), 1)
  const placed = new Map<number, Array<{ direction: Vector3; bounds: Box3 }>>()
  const groups: Array<ExplodeGroup> = []
  for (const assignment of assignments) {
    const regionIdxs = [...new Set(assignment.regionIdxs)].filter((region) => bounds.has(region))
    const pieceBounds = new Box3()
    for (const region of regionIdxs) {
      pieceBounds.union(bounds.get(region)!)
    }
    if (pieceBounds.isEmpty()) {
      continue
    }
    const approach = assignment.direction
    const direction = approach ? new Vector3(approach.x, approach.y, approach.z).normalize() : null
    const offset = new Vector3()
    if (direction && Number.isFinite(direction.lengthSq()) && direction.lengthSq() > 0) {
      const start = project(pieceBounds, direction).min
      let travel = Math.max(
        diagonal * CLEARANCE,
        project(whole, direction).max - start + diagonal * BEYOND_PART,
      )
      for (const previous of new Set(regionIdxs.flatMap((region) => placed.get(region) ?? []))) {
        if (sameDirection(previous.direction, direction)) {
          travel = Math.max(
            travel,
            project(previous.bounds, direction).max - start + diagonal * BEYOND_NEIGHBOUR,
          )
        }
      }
      offset.copy(direction).multiplyScalar(travel)
      const placedPiece = { direction, bounds: pieceBounds.clone().translate(offset) }
      for (const region of regionIdxs) {
        const pieces = placed.get(region) ?? []
        pieces.push(placedPiece)
        placed.set(region, pieces)
      }
    }
    groups.push({
      id: assignment.id,
      regionIdxs,
      offset: { x: offset.x, y: offset.y, z: offset.z },
      color: assignment.color,
      direction: approach ?? null,
      ...(assignment.featureTags ? { featureTags: assignment.featureTags } : {}),
    })
  }
  return groups
}
