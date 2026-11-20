import { type BufferGeometry, Vector3 } from 'three'
import type { PartModel, Vec3 } from '../model/types.js'
import {
  type FaceSurface,
  faceNormal,
  lineAngle,
  PARALLEL_DEG,
  surfaceCache,
} from './face-measure.js'

/**
 * A face's own axis, in the part's coordinates: how somebody names a way to hold the part by
 * pointing at it. A flat face gives its outward normal — the tool comes down onto it. A round face
 * (a hole, a boss, a cone) gives its axis, from the end facing the camera.
 */
export interface FaceAxis {
  readonly kind: 'plane' | 'round'
  readonly direction: Vec3
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
// Taken from 0, so a zero stays 0 rather than -0.
const negate = (v: Vec3): Vec3 => ({ x: 0 - v.x, y: 0 - v.y, z: 0 - v.z })
const plain = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z })

/**
 * A face's axis, by what the report says the face is (`shapeKind`), with the numbers read off the
 * mesh: the report's kind is the kernel's, while a fit to the facets can read a flat face as a
 * cylinder thousands of millimetres across. `toward` is the way to the camera, in the part's
 * coordinates: a round face's axis is turned to face it.
 *
 * - A plane gives `plane`, its area-weighted normal (`faceNormal`), else its fitted one.
 * - A cylinder gives an owning feature's axis where one lies within `PARALLEL_DEG` of the fitted
 *   one — the report's numbers are exact — else the fitted axis, else its feature's.
 * - A cone gives its feature's axis, which the fit does not read.
 * - Any other face — a fillet, a freeform face — gives nothing, whatever the fit made of it; but a
 *   face of no kind the report names, which the fit finds flat, gives that.
 */
export const faceAxisOf = (
  surface: FaceSurface,
  shapeKind: string,
  featureAxes: ReadonlyArray<Vec3>,
  toward: Vec3,
  plane: Vec3 | null = null,
): FaceAxis | null => {
  if (/^plane$/i.test(shapeKind) || (shapeKind === '' && surface.kind === 'plane')) {
    const normal = plane ?? (surface.kind === 'plane' ? surface.normal : null)
    return normal ? { kind: 'plane', direction: plain(normal) } : null
  }
  const axis = /^cylinder$/i.test(shapeKind)
    ? surface.kind === 'cylinder'
      ? (featureAxes.find(
          (each) => lineAngle(new Vector3(each.x, each.y, each.z), surface.axis) <= PARALLEL_DEG,
        ) ?? plain(surface.axis))
      : featureAxes[0]
    : /cone/i.test(shapeKind)
      ? featureAxes[0]
      : undefined
  if (!axis) return null
  return { kind: 'round', direction: dot(axis, toward) < 0 ? negate(axis) : plain(axis) }
}

/** The axes of the features owning a region, in report order, those with one. */
export const featureAxesAt = (model: PartModel, region: number): Array<Vec3> => {
  const owners = new Set(model.regionIndex.featuresForRegion(region))
  return model.features.flatMap((feature) =>
    owners.has(feature.tag) && feature.axis ? [feature.axis] : [],
  )
}

/**
 * Each face's axis by region: a plane's normal read once per region, any other face's surface
 * fitted once per face (`surfaceCache`), and a plane never fitted. Make a new one for a new model
 * or geometry.
 */
export const faceAxesOf = (
  model: PartModel,
  geometry: BufferGeometry,
): ((region: number, toward: Vec3) => FaceAxis | null) => {
  const surfaceFor = surfaceCache(model, geometry)
  const normals = new Map<number, Vector3 | null>()
  const normalOf = (region: number): Vector3 | null => {
    if (!normals.has(region)) normals.set(region, faceNormal(model, geometry, region))
    return normals.get(region) ?? null
  }
  return (region, toward) => {
    const shapeKind = model.regions.find((each) => each.idx === region)?.shapeKind ?? ''
    const plane = /^plane$/i.test(shapeKind)
    return faceAxisOf(
      plane ? { kind: 'other' } : surfaceFor(region),
      shapeKind,
      featureAxesAt(model, region),
      toward,
      plane ? normalOf(region) : null,
    )
  }
}
