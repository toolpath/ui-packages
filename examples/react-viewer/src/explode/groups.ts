import {
  directionColor,
  featureTypeRank,
  sameDirection,
  type PartModelFeature,
  type Vec3,
} from '@toolpath/viewer'
import { Box3, Vector3 } from 'three'
import { regionBounds } from './geometry'
import type { ExplodeGroup } from '@toolpath/viewer'
import type { ExampleModel } from '../models'

export interface GroupDetails extends ExplodeGroup {
  readonly featureTags: readonly string[]
  readonly activeFeatureTag: string
  readonly directionColor: number
}

export type ColorBy = 'feature' | 'direction'
const PALETTE = [0x5bd6cb, 0xb59aff, 0xffc27a, 0x77b8ff, 0xe899ce, 0xb4d779]

const faceKey = (regions: readonly number[]): string =>
  [...new Set(regions)].sort((a, b) => a - b).join(',')
const directionVector = (direction: Vec3): Vector3 =>
  new Vector3(direction.x, direction.y, direction.z).normalize()
const directionKey = (direction: Vec3): string => {
  const unit = directionVector(direction)
  return [unit.x, unit.y, unit.z].map((n) => Number(n.toFixed(6))).join(',')
}
const compareReadings = (a: PartModelFeature, b: PartModelFeature): number => {
  const axial = (way: Vec3) => Math.max(Math.abs(way.x), Math.abs(way.y), Math.abs(way.z))
  return (
    axial(b.machiningDirection) - axial(a.machiningDirection) ||
    directionKey(a.machiningDirection).localeCompare(directionKey(b.machiningDirection)) ||
    a.tag.localeCompare(b.tag)
  )
}
const colorFor = (id: string): number => {
  let hash = 0
  for (const letter of id) {
    hash = (hash * 31 + letter.charCodeAt(0)) | 0
  }
  return PALETTE[(hash >>> 0) % PALETTE.length]
}

/** Support interval of a box along a unit direction, including oblique approaches. */
const projectBounds = (box: Box3, direction: Vector3): { min: number; max: number } => {
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

/** App policy: one piece per distinct feature surface set, with a chosen approach. */
export const makeGroups = (part: ExampleModel): Array<GroupDetails> => {
  const { model, geometry } = part
  const features = model.features.filter(
    (feature) => feature.featureType !== 'profile' && feature.regionIdxs.length > 0,
  )
  const grouped = new Map<string, Array<PartModelFeature>>()
  const firstRegion = new Map(
    features.map((feature) => [
      feature.tag,
      feature.regionIdxs.reduce((min, region) => Math.min(min, region), Infinity),
    ]),
  )
  for (const feature of [...features].sort(
    (a, b) =>
      featureTypeRank(a.featureType) - featureTypeRank(b.featureType) ||
      Number(a.featureType === 'face') - Number(b.featureType === 'face') ||
      a.featureType.localeCompare(b.featureType) ||
      firstRegion.get(a.tag)! - firstRegion.get(b.tag)! ||
      compareReadings(a, b),
  )) {
    const key = `faces-${faceKey(feature.regionIdxs)}`
    const held = grouped.get(key)
    if (held) {
      held.push(feature)
    } else {
      grouped.set(key, [feature])
    }
  }
  // Scan each source region once, even when hundreds of readings share its triangles.
  const byRegion = new Map<number, Box3>()
  const boundsFor = (regions: readonly number[]): Box3 => {
    const box = new Box3()
    for (const region of regions) {
      let bounds = byRegion.get(region)
      if (!bounds) {
        bounds = regionBounds(model, geometry, [region])
        byRegion.set(region, bounds)
      }
      box.union(bounds)
    }
    return box
  }
  const whole = boundsFor(model.regions.map((region) => region.idx))
  const diagonal = Math.max(whole.getSize(new Vector3()).length(), 1)
  const occupied = new Map<number, Array<{ direction: Vector3; bounds: Box3 }>>()
  return [...grouped].map(([key, readings]) => {
    const regionIdxs = [...new Set(readings.flatMap((feature) => feature.regionIdxs))].sort(
      (a, b) => a - b,
    )
    const active = [...readings].sort(compareReadings)[0]
    const approach = active.machiningDirection
    const offset = directionVector(approach)
    const bounds = boundsFor(regionIdxs)
    if (offset.lengthSq() > 0) {
      const original = projectBounds(whole, offset)
      const patch = projectBounds(bounds, offset)
      // Inner walls can travel through the entire part before emerging on the approach side.
      // Preserve the default travel where it already clears the part; otherwise extend it
      // enough for a visible gap. Making every patch end on one plane would overlap faces.
      let travel = Math.max(diagonal * 0.8, original.max - patch.min + diagonal * 0.35)
      // Two interpretations sharing surfaces must not place the same triangles on top of
      // each other. Pack their depth intervals along the approach, in stable group order.
      const prior = new Set(regionIdxs.flatMap((region) => occupied.get(region) ?? []))
      for (const previous of prior) {
        if (sameDirection(previous.direction, offset)) {
          const interval = projectBounds(previous.bounds, offset)
          travel = Math.max(travel, interval.max - patch.min + diagonal * 0.08)
        }
      }
      const direction = offset.clone()
      offset.multiplyScalar(travel)
      const placed = { direction, bounds: bounds.clone().translate(offset) }
      for (const region of regionIdxs) {
        const copies = occupied.get(region) ?? []
        copies.push(placed)
        occupied.set(region, copies)
      }
    }
    const directionIndex = model.candidateDirections.findIndex((way) =>
      sameDirection(way, approach),
    )
    return {
      id: key,
      regionIdxs,
      offset: { x: offset.x, y: offset.y, z: offset.z },
      color: colorFor(key),
      directionColor:
        directionIndex >= 0
          ? directionColor(directionIndex)
          : colorFor(`direction-${directionKey(approach)}`),
      featureTags: readings.map((feature) => feature.tag),
      activeFeatureTag: active.tag,
    }
  })
}

/** Color is presentation only: identities, region arrays and offsets remain shared. */
export const colorGroups = (
  groups: readonly GroupDetails[],
  colorBy: ColorBy,
): Array<ExplodeGroup> =>
  groups.map(({ id, regionIdxs, offset, color, directionColor }) => ({
    id,
    regionIdxs,
    offset,
    color: colorBy === 'direction' ? directionColor : color,
  }))
