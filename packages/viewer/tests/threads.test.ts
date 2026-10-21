import {
  BufferGeometry,
  Float32BufferAttribute,
  type MeshLambertMaterial,
  ShaderLib,
  type DataTexture,
  Vector3,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three'
import { describe, expect, it } from 'vitest'
import { threadMark } from '../src/engine/threads.js'
import { buildRegionIndex } from '../src/model/region-index.js'
import type { PartModel, PartModelFeature, PartModelRegion } from '../src/model/types.js'
import { buildRegionTexels, createPart } from '../src/render/part.js'
import { DEFAULT_THEME } from '../src/render/theme.js'
import { type ThreadOptions, fitBore, threadKey, writeThreadTexels } from '../src/render/threads.js'

/**
 * A tapped hole arrives as a plain bore, so the thread is drawn from a fit of
 * the bore's own facets. What is checked here is that fit, which regions of a
 * hole it accepts, what reaches the texture the shader reads, and how a
 * datasheet becomes a mark.
 */

const SEGMENTS = 12
const FACET_MIDPOINT = Math.cos(Math.PI / SEGMENTS)

/** Triangles round an axis, in the frame `axis`, `u`, `v` placed at `origin`. */
function revolve(
  origin: Vector3,
  axis: Vector3,
  profile: (
    step: number,
  ) => readonly [radiusA: number, radiusB: number, lengthA: number, lengthB: number],
  turn = 1,
): number[] {
  const u = new Vector3()
    .crossVectors(axis, Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0))
    .normalize()
  const v = new Vector3().crossVectors(axis, u)
  const at = (radius: number, length: number, angle: number) =>
    new Vector3()
      .copy(origin)
      .addScaledVector(axis, length)
      .addScaledVector(u, radius * Math.cos(angle))
      .addScaledVector(v, radius * Math.sin(angle))

  const values: number[] = []
  const steps = Math.round(SEGMENTS * turn)
  for (let step = 0; step < steps; step += 1) {
    const [ra, rb, la, lb] = profile(step)
    const a0 = (step / SEGMENTS) * Math.PI * 2
    const a1 = ((step + 1) / SEGMENTS) * Math.PI * 2
    for (const point of [
      at(ra, la, a0),
      at(rb, lb, a0),
      at(rb, lb, a1),
      at(ra, la, a0),
      at(rb, lb, a1),
      at(ra, la, a1),
    ]) {
      values.push(point.x, point.y, point.z)
    }
  }
  return values
}

const cylinder = (
  origin: Vector3,
  axis: Vector3,
  radius: number,
  from: number,
  to: number,
  turn = 1,
) => revolve(origin, axis, () => [radius, radius, from, to], turn)

const cone = (origin: Vector3, axis: Vector3, radius: number, from: number, to: number) =>
  revolve(origin, axis, () => [radius, 0, from, to])

function geometryOf(...parts: number[][]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(parts.flat(), 3))
  return geometry
}

const ORIGIN = new Vector3(10, -4, 2)
const AXIS = new Vector3(1, 2, 2).normalize()

/**
 * A tapped M6 hole: the bore (region 0), its drill point (1), and a 10 mm
 * counterbore over it (2) — one feature over all three.
 */
function tappedHole(): { model: PartModel; geometry: BufferGeometry; feature: PartModelFeature } {
  const bore = cylinder(ORIGIN, AXIS, 2.5, 0, 12)
  const point = cone(ORIGIN, AXIS, 2.5, 0, -1.5)
  const counterbore = cylinder(ORIGIN, AXIS, 5, 12, 16)
  const triangles = (values: number[]) => values.length / 9

  let start = 0
  const table: PartModelRegion[] = [bore, point, counterbore].map((values, idx) => {
    const range = { start, end: start + triangles(values) }
    start = range.end
    return { idx, splitOrigin: idx, shapeKind: 'Cylinder', area: 1, triangles: range }
  })
  const feature: PartModelFeature = {
    tag: '00000000000000aa',
    featureType: 'ThreadedBlindHole',
    machiningDirection: { x: 0, y: 0, z: 1 },
    axis: null,
    regionIdxs: [0, 1, 2],
  }
  const model: PartModel = {
    partId: 'tapped',
    kernelVersion: '0.28.0',
    features: [feature],
    regions: table,
    candidateDirections: [],
    mesh: {
      pointCount: start * 3,
      triangleCount: start,
      glbUrl: null,
      stlUrl: null,
      thumbnailUrl: null,
    },
    regionIndex: buildRegionIndex({ regions: table, features: [feature], triangleCount: start }),
    warnings: [],
  }

  return { model, geometry: geometryOf(bore, point, counterbore), feature }
}

const M6: ThreadOptions = { threads: [{ regions: [0, 1, 2], pitch: 1, majorDiameter: 6 }] }

function distanceToAxis(point: Vector3): number {
  const offset = new Vector3().subVectors(point, ORIGIN)
  return offset.sub(AXIS.clone().multiplyScalar(offset.dot(AXIS))).length()
}

describe('fitBore', () => {
  const rangeOf = (geometry: BufferGeometry) => [
    { start: 0, end: geometry.getAttribute('position').count / 3 },
  ]

  it('finds a tilted bore’s axis, a point on it, and its radius', () => {
    const geometry = geometryOf(cylinder(ORIGIN, AXIS, 3, 0, 8))
    const bore = fitBore(geometry.getAttribute('position'), rangeOf(geometry))

    expect(bore).not.toBeNull()
    expect(Math.abs(bore!.axis.dot(AXIS))).toBeCloseTo(1, 5)
    expect(distanceToAxis(bore!.origin)).toBeCloseTo(0, 4)
    // Through the triangles' centres: inside the circle, outside its facets' midpoints.
    expect(bore!.radius).toBeLessThan(3)
    expect(bore!.radius).toBeGreaterThan(3 * FACET_MIDPOINT)
  })

  it('fits half a cylinder, as a split bore face comes', () => {
    const geometry = geometryOf(cylinder(ORIGIN, AXIS, 3, 0, 8, 0.5))
    const bore = fitBore(geometry.getAttribute('position'), rangeOf(geometry))

    expect(Math.abs(bore!.axis.dot(AXIS))).toBeCloseTo(1, 5)
    expect(distanceToAxis(bore!.origin)).toBeCloseTo(0, 4)
  })

  it('refuses a cone and a flat face', () => {
    const point = geometryOf(cone(ORIGIN, AXIS, 3, 0, -2))
    const floor = geometryOf([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])

    expect(fitBore(point.getAttribute('position'), rangeOf(point))).toBeNull()
    expect(fitBore(floor.getAttribute('position'), rangeOf(floor))).toBeNull()
  })

  it('reads nothing from no triangles', () => {
    const geometry = geometryOf([])
    expect(fitBore(geometry.getAttribute('position'), [{ start: 0, end: 0 }])).toBeNull()
  })
})

describe('writeThreadTexels', () => {
  function texels(options: ThreadOptions | null): { data: Float32Array; width: number } {
    const { model, geometry } = tappedHole()
    const width = model.regions.length + 1
    const data = new Float32Array(width * 2 * 4).fill(7)
    writeThreadTexels(data, width, geometry, model, buildRegionTexels(model), options)
    return { data, width }
  }

  it('threads the bore only: not the drill point, and not a counterbore wider than the thread', () => {
    const { data, width } = texels(M6)

    expect(data[3]).toBe(1)
    expect(data[1 * 4 + 3]).toBe(0)
    expect(data[2 * 4 + 3]).toBe(0)
    expect(distanceToAxis(new Vector3(data[0], data[1], data[2]))).toBeCloseTo(0, 4)
    const axis = new Vector3(data[width * 4], data[width * 4 + 1], data[width * 4 + 2])
    expect(Math.abs(axis.dot(AXIS))).toBeCloseTo(1, 5)
  })

  it('keeps the sign of a left-hand pitch', () => {
    const { data } = texels({ threads: [{ regions: [0], pitch: -1.5, majorDiameter: 6 }] })
    expect(data[3]).toBe(-1.5)
  })

  it('clears everything for no threads, and skips a mark with no pitch or an unknown region', () => {
    expect(texels(null).data.every((value) => value === 0)).toBe(true)
    expect(
      texels({
        threads: [
          { regions: [0], pitch: 0, majorDiameter: 6 },
          { regions: [99], pitch: 1, majorDiameter: 6 },
        ],
      }).data.every((value) => value === 0),
    ).toBe(true)
  })
})

describe('threadKey', () => {
  it('is equal for equal threads and differs when one changes', () => {
    expect(threadKey(M6)).toBe(threadKey({ threads: [{ ...M6.threads[0]! }] }))
    expect(threadKey(M6)).not.toBe(threadKey({ threads: [{ ...M6.threads[0]!, pitch: -1 }] }))
    expect(threadKey(null)).toBe('')
  })
})

describe('PartObject.setThreads', () => {
  function compiled(material: MeshLambertMaterial): WebGLProgramParametersWithUniforms {
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.lambert.vertexShader,
      fragmentShader: ShaderLib.lambert.fragmentShader,
    } as unknown as WebGLProgramParametersWithUniforms
    material.onBeforeCompile(shader, {} as WebGLRenderer)
    return shader
  }

  it('patches the part shader and fills the texture it reads', () => {
    const { model, geometry } = tappedHole()
    const part = createPart(model, geometry, DEFAULT_THEME)
    const shader = compiled(part.mesh.material as MeshLambertMaterial)
    const texture = shader.uniforms['uThreads']!.value as DataTexture
    const data = texture.image.data as Float32Array

    expect(shader.vertexShader).toContain('vThreadOrigin = texelFetch(uThreads')
    expect(shader.fragmentShader).toContain('float threadPhase')

    const version = texture.version
    part.setThreads(M6)
    expect(data[3]).toBe(1)
    expect(texture.version).toBeGreaterThan(version)

    // The same threads again, in a fresh object, is no upload.
    const after = texture.version
    part.setThreads({ threads: [{ regions: [0, 1, 2], pitch: 1, majorDiameter: 6 }] })
    expect(texture.version).toBe(after)

    part.setThreads(null)
    expect(data.every((value) => value === 0)).toBe(true)
    part.dispose()
  })
})

describe('threadMark', () => {
  const { feature } = tappedHole()
  const hole = (threading: unknown) => ({
    featureType: 'ThreadedBlindHole',
    facts: { kind: 'Hole', threading },
  })
  const spec = { basicDiameter: 6, threadPitch: 1, minMinorDiameter: 4.917 }

  it('reads a tapped hole’s catalog thread', () => {
    expect(threadMark(feature, hole({ spec, process: 'CutTap' }))).toEqual({
      regions: [0, 1, 2],
      pitch: 1,
      majorDiameter: 6,
    })
  })

  it('reads a left-hand thread as a negative pitch', () => {
    const left = { ...spec, handedness: 'Left' }
    expect(threadMark(feature, hole({ spec: left, process: 'ThreadMill' }))?.pitch).toBe(-1)
  })

  it('reads nothing from a plain hole, another feature, or an unexpected shape', () => {
    expect(threadMark(feature, hole(undefined))).toBeNull()
    expect(threadMark(feature, { facts: { kind: 'Pocket' } })).toBeNull()
    expect(threadMark(feature, hole({ spec: { ...spec, threadPitch: -1 } }))).toBeNull()
    expect(threadMark(feature, null)).toBeNull()
    expect(threadMark(feature, 'hole')).toBeNull()
  })
})
