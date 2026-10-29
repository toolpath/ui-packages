import {
  directionColor,
  explodeLayout,
  featureTypeRank,
  sameDirection,
  type ExplodeAssignment,
  type PartModelFeature,
  type Vec3,
} from '@toolpath/viewer'
import { Vector3 } from 'three'
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
  // The package spaces the pieces: each clears the part along its approach, and pieces
  // sharing surfaces and an approach stack rather than overlap, in this order.
  const pieces = [...grouped].map(([key, readings]) => {
    const active = [...readings].sort(compareReadings)[0]
    const directionIndex = model.candidateDirections.findIndex((way) =>
      sameDirection(way, active.machiningDirection),
    )
    return {
      assignment: {
        id: key,
        regionIdxs: [...new Set(readings.flatMap((feature) => feature.regionIdxs))].sort(
          (a, b) => a - b,
        ),
        direction: active.machiningDirection,
        color: colorFor(key),
        featureTags: readings.map((feature) => feature.tag),
      } satisfies ExplodeAssignment,
      activeFeatureTag: active.tag,
      directionColor:
        directionIndex >= 0
          ? directionColor(directionIndex)
          : colorFor(`direction-${directionKey(active.machiningDirection)}`),
    }
  })
  const placed = explodeLayout(
    model,
    geometry,
    pieces.map((piece) => piece.assignment),
  )
  const details = new Map(pieces.map((piece) => [piece.assignment.id, piece]))
  return placed.map((group) => ({
    ...group,
    featureTags: group.featureTags ?? [],
    activeFeatureTag: details.get(group.id)!.activeFeatureTag,
    directionColor: details.get(group.id)!.directionColor,
  }))
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
