import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildRegionIndex } from '../src/model/region-index.js'
import type { PartModel, PartModelFeature, Vec3 } from '../src/model/types.js'
import { faceAxesOf, faceAxisOf, featureAxesAt } from '../src/render/face-axis.js'
import { type FaceSurface, faceNormal } from '../src/render/face-measure.js'
import { BOX_FACE, box, DRILLED_FACE, drilledCylinder, type TestPart } from './measure-parts.js'

const plane = (x: number, y: number, z: number): FaceSurface => ({
  kind: 'plane',
  normal: new Vector3(x, y, z),
  centroid: new Vector3(),
})
const cylinder = (x: number, y: number, z: number): FaceSurface => ({
  kind: 'cylinder',
  axis: new Vector3(x, y, z),
  origin: new Vector3(),
  radius: 3,
  from: 0,
  to: 10,
  sweep: 360,
})
const fromAbove = { x: 0, y: 0, z: 1 }
const fromBelow = { x: 0, y: 0, z: -1 }

describe('faceAxisOf', () => {
  it('gives a flat face its outward normal, wherever the camera is', () => {
    expect(faceAxisOf(plane(0, 0, -1), 'Plane', [], fromAbove)).toEqual({
      kind: 'plane',
      direction: { x: 0, y: 0, z: -1 },
    })
  })

  it('turns a round face’s axis to the end facing the camera', () => {
    expect(faceAxisOf(cylinder(0, 0, -1), 'Cylinder', [], fromAbove)?.direction).toEqual({
      x: 0,
      y: 0,
      z: 1,
    })
    expect(faceAxisOf(cylinder(0, 0, -1), 'Cylinder', [], fromBelow)?.direction).toEqual({
      x: 0,
      y: 0,
      z: -1,
    })
  })

  it('takes the hole feature’s exact axis over a fit within half a degree', () => {
    const exact = { x: 1e-17, y: 0, z: -1 }
    const fitted = cylinder(Math.sin(0.004), 0, Math.cos(0.004))
    expect(faceAxisOf(fitted, 'Cylinder', [exact], fromAbove)).toEqual({
      kind: 'round',
      direction: { x: -1e-17, y: 0, z: 1 },
    })
  })

  it('keeps the fit when no feature’s axis lies along it', () => {
    const across = { x: 1, y: 0, z: 0 }
    expect(faceAxisOf(cylinder(0, 0, 1), 'Cylinder', [across], fromAbove)?.direction).toEqual({
      x: 0,
      y: 0,
      z: 1,
    })
  })

  it('reads a cone by its feature’s axis, which the fit does not give', () => {
    const other: FaceSurface = { kind: 'other' }
    expect(faceAxisOf(other, 'Cone', [{ x: 0, y: 1, z: 0 }], { x: 0, y: -1, z: 0 })).toEqual({
      kind: 'round',
      direction: { x: 0, y: -1, z: 0 },
    })
  })

  it('reads a face the report calls a plane by its normal, though the fit makes it a vast cylinder', () => {
    // A flat face whose facets a mesh leaves a little apart: fitted, a cylinder 2,879 mm across
    // a degree of sweep, whose axis lies in the face — 90° from the way it faces.
    const vast: FaceSurface = { ...cylinder(0.6, 0.07, 0.8), radius: 2879, sweep: 1 } as FaceSurface
    const normal = { x: 0.978, y: 0.007, z: 0.208 }
    expect(faceAxisOf(vast, 'Plane', [], fromAbove, normal)).toEqual({
      kind: 'plane',
      direction: normal,
    })
  })

  it('gives nothing for a freeform face the fit reads as a cylinder', () => {
    expect(faceAxisOf(cylinder(0, 0, 1), 'Freeform', [], fromAbove)).toBeNull()
  })

  it('gives nothing for a face with no axis: a fillet, a freeform face, a featureless cone', () => {
    const other: FaceSurface = { kind: 'other' }
    expect(faceAxisOf(other, 'Torus', [{ x: 0, y: 0, z: 1 }], fromAbove)).toBeNull()
    expect(faceAxisOf(other, 'BSplineSurface', [], fromAbove)).toBeNull()
    expect(faceAxisOf(other, 'Cone', [], fromAbove)).toBeNull()
  })
})

/** A test part's model as a report would give it: each region's kind, and features owning regions. */
const reported = (
  { model, geometry }: TestPart,
  kinds: Record<number, string>,
  features: ReadonlyArray<Pick<PartModelFeature, 'tag' | 'axis' | 'regionIdxs'>> = [],
): TestPart => {
  const regions = model.regions.map((region) => ({
    ...region,
    shapeKind: kinds[region.idx] ?? region.shapeKind,
  }))
  const full = features.map((feature) => ({
    featureType: 'hole',
    machiningDirection: { x: 0, y: 1, z: 0 },
    ...feature,
  })) as Array<PartModelFeature>
  const regionIndex = buildRegionIndex({
    regions,
    features: full,
    triangleCount: model.mesh.triangleCount,
  })
  return { geometry, model: { ...model, regions, features: full, regionIndex } as PartModel }
}

const near = (actual: Vec3 | null | undefined, expected: Vec3): void => {
  expect(actual).toBeTruthy()
  expect(actual!.x).toBeCloseTo(expected.x, 6)
  expect(actual!.y).toBeCloseTo(expected.y, 6)
  expect(actual!.z).toBeCloseTo(expected.z, 6)
}

describe('faceNormal', () => {
  const { model, geometry } = box(20, 10, 6)

  it('reads each side of a box as its outward normal', () => {
    near(faceNormal(model, geometry, BOX_FACE.pz), { x: 0, y: 0, z: 1 })
    near(faceNormal(model, geometry, BOX_FACE.nz), { x: 0, y: 0, z: -1 })
    near(faceNormal(model, geometry, BOX_FACE.nx), { x: -1, y: 0, z: 0 })
  })
})

describe('faceAxesOf', () => {
  it('gives a box’s top and bottom their outward normals, wherever the camera is', () => {
    const { model, geometry } = box(20, 10, 6)
    const axisOf = faceAxesOf(model, geometry)
    const top = axisOf(BOX_FACE.pz, fromBelow)
    expect(top?.kind).toBe('plane')
    near(top?.direction, { x: 0, y: 0, z: 1 })
    const bottom = axisOf(BOX_FACE.nz, fromAbove)
    expect(bottom?.kind).toBe('plane')
    near(bottom?.direction, { x: 0, y: 0, z: -1 })
  })

  // The hole's fitted axis is +Y; `stray` lies within `PARALLEL_DEG` of it but belongs to a feature
  // that does not own the hole, and comes first in the report.
  const exact = { x: 0, y: 1, z: 0 }
  const stray = { x: Math.sin(0.003), y: Math.cos(0.003), z: 0 }
  const tilted = { x: 1, y: 0, z: 0 }
  const drilled = (kind: string): TestPart =>
    reported(drilledCylinder(10, 3, 10), { [DRILLED_FACE.holeA]: kind }, [
      { tag: 'stray', axis: stray, regionIdxs: [DRILLED_FACE.top] },
      { tag: 'across', axis: tilted, regionIdxs: [DRILLED_FACE.wall] },
      { tag: 'hole', axis: exact, regionIdxs: [DRILLED_FACE.holeA, DRILLED_FACE.holeB] },
    ])

  it('takes the axes of the features owning a region only, in report order', () => {
    const { model } = drilled('Cylinder')
    expect(featureAxesAt(model, DRILLED_FACE.holeA)).toEqual([exact])
    expect(featureAxesAt(model, DRILLED_FACE.top)).toEqual([stray])
    expect(featureAxesAt(model, DRILLED_FACE.bottom)).toEqual([])
  })

  it('gives a hole its own feature’s axis, turned to the camera', () => {
    const { model, geometry } = drilled('Cylinder')
    const axisOf = faceAxesOf(model, geometry)
    expect(axisOf(DRILLED_FACE.holeA, { x: 0, y: -1, z: 0 })).toEqual({
      kind: 'round',
      direction: { x: 0, y: -1, z: 0 },
    })
    expect(axisOf(DRILLED_FACE.holeA, { x: 0, y: 1, z: 0 })).toEqual({
      kind: 'round',
      direction: exact,
    })
  })

  it('gives a cone its own feature’s axis, not another feature’s', () => {
    // A cone is read by its feature alone: the mesh is not fitted for one.
    const { model, geometry } = drilled('Cone')
    expect(faceAxesOf(model, geometry)(DRILLED_FACE.holeA, { x: 0, y: 1, z: 0 })).toEqual({
      kind: 'round',
      direction: exact,
    })
  })
})
