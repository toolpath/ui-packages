/*
 * Small parts for the measuring tests, made the way a display mesh is: one
 * non-indexed geometry whose faces are contiguous spans of triangles, and a
 * model with one region for each span.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  RingGeometry,
} from 'three'
import { buildRegionIndex } from '../src/model/region-index.js'
import type { PartModel, PartModelRegion } from '../src/model/types.js'

export interface TestPart {
  geometry: BufferGeometry
  model: PartModel
}

/** One region per face, in mesh order, each its own `splitOrigin`. */
const regionsOf = (counts: readonly number[]): PartModelRegion[] => {
  let start = 0
  return counts.map((count, idx) => {
    const triangles = { start, end: start + count }
    start = triangles.end
    return { idx, splitOrigin: idx, shapeKind: 'plane', area: 0, triangles }
  })
}

/** One geometry of `faces`, in order, each one region of the model. */
const partOf = (faces: ReadonlyArray<BufferGeometry>): TestPart => {
  const positions: Array<number> = []
  const counts: Array<number> = []
  for (const face of faces) {
    const flat = face.index ? face.toNonIndexed() : face
    const array = flat.getAttribute('position').array
    positions.push(...array)
    counts.push(array.length / 9)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const triangleCount = positions.length / 9
  const regions = regionsOf(counts)
  const model = {
    partId: 'test-part',
    kernelVersion: 'test',
    features: [],
    regions,
    candidateDirections: [],
    mesh: {
      pointCount: positions.length / 3,
      triangleCount,
      glbUrl: null,
      stlUrl: null,
      thumbnailUrl: null,
    },
    regionIndex: buildRegionIndex({ regions, features: [], triangleCount }),
    warnings: [],
  } as unknown as PartModel
  return { geometry, model }
}

/** BoxGeometry's six faces, in its own order: +X, −X, +Y, −Y, +Z, −Z. */
export const BOX_FACE = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 } as const

/** A box `width` by `height` by `depth` about the origin, each side a face of two triangles. */
export const box = (width = 20, height = 10, depth = 6): TestPart => {
  const whole = new BoxGeometry(width, height, depth).toNonIndexed()
  const array = whole.getAttribute('position').array
  const faces = Array.from({ length: 6 }, (_, side) => {
    const face = new BufferGeometry()
    face.setAttribute(
      'position',
      new Float32BufferAttribute(array.slice(side * 18, side * 18 + 18), 3),
    )
    return face
  })
  return partOf(faces)
}

/** The drilled cylinder's faces: its wall, the hole as two halves (as CAD often splits one), its ends. */
export const DRILLED_FACE = { wall: 0, holeA: 1, holeB: 2, top: 3, bottom: 4 } as const

/**
 * A round bar `2 × radius` across and `height` long on the Y axis, drilled
 * through on its axis with a hole of `holeRadius`.
 */
export const drilledCylinder = (radius = 10, holeRadius = 3, height = 10): TestPart => {
  const SEGMENTS = 32
  const wall = new CylinderGeometry(radius, radius, height, SEGMENTS, 1, true)
  const half = (start: number) =>
    new CylinderGeometry(holeRadius, holeRadius, height, SEGMENTS / 2, 1, true, start, Math.PI)
  const top = new RingGeometry(holeRadius, radius, SEGMENTS)
    .rotateX(-Math.PI / 2)
    .translate(0, height / 2, 0)
  const bottom = new RingGeometry(holeRadius, radius, SEGMENTS)
    .rotateX(Math.PI / 2)
    .translate(0, -height / 2, 0)
  return partOf([wall, half(0), half(Math.PI), top, bottom])
}

/** `count` faces, each one small triangle of its own, side by side along X. */
export const manyFaces = (count: number): TestPart =>
  partOf(
    Array.from({ length: count }, (_, at) => {
      const face = new BufferGeometry()
      face.setAttribute(
        'position',
        new Float32BufferAttribute([at, 0, 0, at + 1, 0, 0, at, 1, 0], 3),
      )
      return face
    }),
  )

/** Lengths as the tests read them: three places, no units. */
export const mm = (value: number): string => value.toFixed(3)
