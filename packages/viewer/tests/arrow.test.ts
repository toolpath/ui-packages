import { AlwaysDepth, type BufferGeometry, Color, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyArrowColor,
  createArrowDepthMaterial,
  createArrowMaterial,
  createDepthResetMaterial,
} from '../src/render/arrow-material.js'
import {
  HANDLE_BEAD_RADIUS,
  HANDLE_TIP,
  HEAD_LENGTH,
  HEAD_RADIUS,
  SHAFT_RADIUS,
  arrowGeometry,
  arrowProfile,
  handleGeometry,
  handleProfile,
} from '../src/render/arrow.js'

/**
 * An arrow is drawn front faces only, so the one way to lose it entirely is a
 * triangle wound inward — and nothing about a turned outline makes that
 * obvious from the outline itself.
 */
const everyTriangleFacesOut = (geometry: BufferGeometry): boolean => {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()
  if (!index) return false
  const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()]
  const face = new Vector3()
  const vertex = new Vector3()

  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const corners = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
    a.fromBufferAttribute(position, corners[0] ?? 0)
    b.fromBufferAttribute(position, corners[1] ?? 0)
    c.fromBufferAttribute(position, corners[2] ?? 0)
    face.subVectors(b, a).cross(c.clone().sub(a))
    // The poles are rings of coincident points; their triangles have no area
    // and no side to face.
    if (face.lengthSq() < 1e-16) continue

    vertex.set(0, 0, 0)
    for (const corner of corners) vertex.add(new Vector3().fromBufferAttribute(normal, corner ?? 0))
    if (face.dot(vertex) <= 0) return false
  }
  return true
}

/**
 * The volume a closed mesh encloses, signed by its winding: positive when its
 * triangles face out. Agreement between each triangle and its normals says
 * nothing when both are turned inside out together; this does.
 */
const signedVolume = (geometry: BufferGeometry): number => {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()]
  let volume = 0
  for (let triangle = 0; index && triangle < index.count; triangle += 3) {
    a.fromBufferAttribute(position, index.getX(triangle))
    b.fromBufferAttribute(position, index.getX(triangle + 1))
    c.fromBufferAttribute(position, index.getX(triangle + 2))
    volume += a.dot(b.clone().cross(c)) / 6
  }
  return volume
}

/**
 * Whether an outline only ever moves away from where it starts. One that turns
 * back toward its tip has barbs or a hollow behind its head, and an arrow like
 * that seen from behind is a dish on a stick — a drawing pin, not an arrow.
 */
const neverDoublesBack = (profile: readonly { y: number }[]): boolean =>
  profile.every((point, index) => index === 0 || point.y >= (profile[index - 1]?.y ?? 0) - 1e-9)

const normalsAreUnit = (geometry: BufferGeometry): boolean => {
  const normal = geometry.getAttribute('normal')
  const vector = new Vector3()
  for (let index = 0; index < normal.count; index++) {
    vector.fromBufferAttribute(normal, index)
    if (!Number.isFinite(vector.x + vector.y + vector.z)) return false
    if (Math.abs(vector.length() - 1) > 1e-6) return false
  }
  return true
}

describe('arrowProfile', () => {
  const profile = arrowProfile()

  it('runs from a tip on the axis at the origin to a tail on the axis one along', () => {
    expect(profile[0]?.x).toBe(0)
    expect(profile[0]?.y).toBe(0)
    expect(profile.at(-1)?.x).toBe(0)
    expect(profile.at(-1)?.y).toBeCloseTo(1, 9)
    expect(profile.every((point) => point.x >= 0)).toBe(true)
  })

  it('widens to its head a third of the way along, and never turns back', () => {
    const widest = profile.reduce((best, point) => (point.x > best.x ? point : best))

    // Rounded off a hair short of the head's full radius, never past it.
    expect(widest.x).toBeLessThanOrEqual(HEAD_RADIUS)
    expect(widest.x).toBeGreaterThan(HEAD_RADIUS * 0.95)
    expect(widest.y).toBeLessThanOrEqual(HEAD_LENGTH)
    expect(widest.y).toBeGreaterThan(HEAD_LENGTH - 0.01)
    expect(neverDoublesBack(profile)).toBe(true)
  })

  it('has a slim shaft behind its head', () => {
    const shaft = profile.filter((point) => point.y > HEAD_LENGTH + 0.01)

    expect(shaft.length).toBeGreaterThan(0)
    for (const point of shaft) expect(point.x).toBeLessThanOrEqual(SHAFT_RADIUS + 1e-9)
    expect(SHAFT_RADIUS).toBeLessThan(HEAD_RADIUS / 2.5)
  })
})

describe('arrowGeometry', () => {
  const geometry = arrowGeometry()
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox

  it('is one long, tip at the origin, and no wider than its head', () => {
    expect(bounds?.min.y).toBeCloseTo(0, 9)
    expect(bounds?.max.y).toBeCloseTo(1, 9)
    expect(Math.max(-(bounds?.min.x ?? 0), bounds?.max.x ?? 0)).toBeLessThanOrEqual(
      HEAD_RADIUS + 1e-9,
    )
    expect(Math.max(-(bounds?.min.z ?? 0), bounds?.max.z ?? 0)).toBeLessThanOrEqual(
      HEAD_RADIUS + 1e-9,
    )
  })

  it('carries finite unit normals', () => {
    expect(normalsAreUnit(geometry)).toBe(true)
  })

  it('faces outward everywhere', () => {
    expect(signedVolume(geometry)).toBeGreaterThan(0)
    expect(everyTriangleFacesOut(geometry)).toBe(true)
  })
})

describe('handleGeometry', () => {
  const profile = handleProfile()
  const geometry = handleGeometry()
  geometry.computeBoundingBox()

  it('is the same at both ends, tips at the handle length', () => {
    expect(profile[0]?.y).toBeCloseTo(-HANDLE_TIP, 9)
    expect(profile.at(-1)?.y).toBeCloseTo(HANDLE_TIP, 9)
    profile.forEach((point, index) => {
      const mirror = profile[profile.length - 1 - index]
      expect(point.x).toBeCloseTo(mirror?.x ?? Number.NaN, 9)
      expect(point.y).toBeCloseTo(-(mirror?.y ?? Number.NaN), 9)
    })
  })

  it('never turns back toward the tip it starts from', () => {
    expect(neverDoublesBack(profile)).toBe(true)
  })

  it('has a bead at its middle to take hold of', () => {
    const middle = profile.find((point) => Math.abs(point.y) < 1e-9)
    expect(middle?.x).toBeCloseTo(HANDLE_BEAD_RADIUS, 9)
  })

  it('faces outward everywhere, with finite unit normals', () => {
    expect(normalsAreUnit(geometry)).toBe(true)
    expect(signedVolume(geometry)).toBeGreaterThan(0)
    expect(everyTriangleFacesOut(geometry)).toBe(true)
  })
})

describe('arrow materials', () => {
  it('re-colours an arrow in place', () => {
    const material = createArrowMaterial()

    applyArrowColor(material, 0x3366ff, 0.9)

    expect(material.uniforms.uColor.value.equals(new Color(0x3366ff))).toBe(true)
    expect(material.uniforms.uOpacity.value).toBe(0.9)
    // In the same render list as its reset pass, whatever its opacity.
    expect(material.transparent).toBe(true)
  })

  /**
   * The colour pass only covers what the depth pass laid down, so the two have
   * to compute the same depth: one vertex shader, not two that agree.
   */
  it("lays down an arrow's front with the colour pass's own shaders", () => {
    const colour = createArrowMaterial()
    const depth = createArrowDepthMaterial()

    expect(depth.colorWrite).toBe(false)
    expect(depth.depthWrite).toBe(true)
    expect(depth.vertexShader).toBe(colour.vertexShader)
    expect(depth.transparent).toBe(colour.transparent)
  })

  it('resets depth under an arrow without drawing anything', () => {
    const reset = createDepthResetMaterial()

    expect(reset.colorWrite).toBe(false)
    expect(reset.depthWrite).toBe(true)
    expect(reset.depthFunc).toBe(AlwaysDepth)
    expect(reset.transparent).toBe(createArrowMaterial().transparent)
  })
})
