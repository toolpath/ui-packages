import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Vec3 } from '../model/types.js'

/**
 * The 26 standard views: the six faces of the cube, the twelve edges between
 * them, and its eight corners.
 *
 * Ordered top/bottom, then front/back, then left/right, all the way through, so
 * a caller has a rule to rely on.
 */
export const VIEW_NAMES = [
  // The six faces.
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',

  // The twelve edges.
  'top-front',
  'top-back',
  'top-left',
  'top-right',
  'bottom-front',
  'bottom-back',
  'bottom-left',
  'bottom-right',
  'front-left',
  'front-right',
  'back-left',
  'back-right',

  // The eight corners.
  'top-front-left',
  'top-front-right',
  'top-back-left',
  'top-back-right',
  'bottom-front-left',
  'bottom-front-right',
  'bottom-back-left',
  'bottom-back-right',
] as const

export type ViewName = (typeof VIEW_NAMES)[number]

/** A face, one of the chamfers between two faces, or a corner chamfer. */
export type ViewKind = 'face' | 'edge' | 'corner'

/**
 * Which way each view lies, as the sign of each axis in the Z-up frame the part
 * data is authored in: **+Z is the top, −Y is the front, +X is the right**.
 *
 * Signs rather than unit vectors because these are numbers a reader can check.
 * `top-front-left` is three components of ±1/√3 and nobody proofreads those.
 */
export const VIEW_SIGNS: Record<ViewName, readonly [number, number, number]> = {
  top: [0, 0, 1],
  bottom: [0, 0, -1],
  front: [0, -1, 0],
  back: [0, 1, 0],
  left: [-1, 0, 0],
  right: [1, 0, 0],

  'top-front': [0, -1, 1],
  'top-back': [0, 1, 1],
  'top-left': [-1, 0, 1],
  'top-right': [1, 0, 1],
  'bottom-front': [0, -1, -1],
  'bottom-back': [0, 1, -1],
  'bottom-left': [-1, 0, -1],
  'bottom-right': [1, 0, -1],
  'front-left': [-1, -1, 0],
  'front-right': [1, -1, 0],
  'back-left': [-1, 1, 0],
  'back-right': [1, 1, 0],

  'top-front-left': [-1, -1, 1],
  'top-front-right': [1, -1, 1],
  'top-back-left': [-1, 1, 1],
  'top-back-right': [1, 1, 1],
  'bottom-front-left': [-1, -1, -1],
  'bottom-front-right': [1, -1, -1],
  'bottom-back-left': [-1, 1, -1],
  'bottom-back-right': [1, 1, -1],
}

/** How many axes a view is off: one for a face, two for an edge, three for a corner. */
export function viewKind(name: ViewName): ViewKind {
  const off = VIEW_SIGNS[name].filter((sign) => sign !== 0).length
  if (off === 1) return 'face'
  if (off === 2) return 'edge'
  return 'corner'
}

const DIRECTIONS = new Map<ViewName, Vec3>(
  VIEW_NAMES.map((name) => {
    const [x, y, z] = VIEW_SIGNS[name]
    const length = Math.hypot(x, y, z)

    return [name, { x: x / length, y: y / length, z: z / length }]
  }),
)

/** The unit direction the camera sits in for a view. */
export function viewVector(name: ViewName): Vec3 {
  return DIRECTIONS.get(name) ?? { x: 0, y: 0, z: 1 }
}

/**
 * Which way is up when looking from `direction`.
 *
 * Z is up for every view except the two that look straight down it, where an up
 * vector parallel to the view is degenerate and the camera would have no
 * defined roll. Those get ±Y, so the top view puts the front edge at the bottom
 * of the screen and the bottom view mirrors it — the convention every CAD
 * package uses, and the one the cube's own face labels are drawn to, since both
 * come from here.
 */
export function viewUp(direction: Vec3): Vec3 {
  if (direction.x === 0 && direction.y === 0) {
    return { x: 0, y: direction.z > 0 ? 1 : -1, z: 0 }
  }

  return { x: 0, y: 0, z: 1 }
}

/**
 * The squared up vector nearest to the one the camera already has.
 *
 * A view has four square orientations, not one: {@link viewUp} rolled by 0°,
 * 90°, 180° and 270° about the view direction. Snapping to the canonical one
 * would spin the part on the way to a view somebody asked for because it was
 * already nearly in front of them — arrive at the bottom view from the right
 * and the part turns a quarter of a turn for no reason they can see.
 *
 * So the roll is chosen, not imposed: of the four, the one closest to where the
 * camera is looking from now. The view still lands square — Bottom simply lands
 * square in whichever of its four ways was already nearest, which is how the
 * Fusion cube behaves and what somebody arriving from it will expect.
 */
export function squaredUp(direction: Vec3, currentUp: Vec3): Vec3 {
  const forward = new Vector3(direction.x, direction.y, direction.z).normalize()
  const canonical = viewUp(direction)

  // The canonical up with any component along the view removed, which is the
  // 0° roll. `viewUp` never returns a vector parallel to its own direction, so
  // this cannot collapse to zero.
  const zero = new Vector3(canonical.x, canonical.y, canonical.z)
  zero.addScaledVector(forward, -forward.dot(zero)).normalize()

  const quarter = new Vector3().crossVectors(forward, zero)
  const current = new Vector3(currentUp.x, currentUp.y, currentUp.z)

  const rolls = [zero, quarter, zero.clone().negate(), quarter.clone().negate()]
  // Ties go to the earlier roll, so a camera with no up to speak of gets the
  // canonical orientation rather than an arbitrary quarter turn.
  const nearest = rolls.reduce((best, roll) =>
    roll.dot(current) > best.dot(current) ? roll : best,
  )

  return vec(nearest)
}

/**
 * Half-width of a face panel, where the cube's half-extent is 1 — so the
 * chamfer taken off each edge is the remaining `1 - CHAMFER`.
 */
export const CHAMFER = 0.5834

/** One clickable panel of the cube: a face, an edge chamfer, or a corner. */
export interface CubeZone {
  readonly name: ViewName
  readonly kind: ViewKind
  /** The panel's outward normal, and the direction the camera moves to. */
  readonly direction: Vec3
  /** Its polygon in cube space, wound counter-clockwise seen from outside. */
  readonly polygon: readonly Vec3[]
}

function vec(v: Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

/**
 * The chamfered cube, one planar polygon per view — a square for each face, a
 * rectangle for each edge, a triangle for each corner. Pure, and the only
 * description of the cube's shape: the panels, the outline and the hit test are
 * all built from what this returns.
 */
export function cubeZones(chamfer = CHAMFER): CubeZone[] {
  const AXES = [0, 1, 2]

  return VIEW_NAMES.map((name) => {
    const kind = viewKind(name)
    const direction = viewVector(name)
    const [sx, sy, sz] = VIEW_SIGNS[name]
    /** The sign on one axis, by index rather than by name. */
    const sign = (axis: number) => VIEW_SIGNS[name][axis] ?? 0
    const normal = new Vector3(direction.x, direction.y, direction.z)

    let polygon: Vector3[]

    if (kind === 'face') {
      // Built from the same basis the camera will use, so the panel's own axes
      // are the screen axes once you are looking at it — which is what lets the
      // label be drawn the right way up by construction.
      const up = viewUp(direction)
      const upVector = new Vector3(up.x, up.y, up.z)
      const right = normal.clone().negate().cross(upVector).normalize()

      const square: ReadonlyArray<readonly [number, number]> = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]

      polygon = square.map(([u, v]) =>
        normal
          .clone()
          .addScaledVector(right, u * chamfer)
          .addScaledVector(upVector, v * chamfer),
      )
    } else if (kind === 'edge') {
      // The two axes the edge lies between, and the one it runs along.
      const a = AXES.find((axis) => sign(axis) !== 0) ?? 0
      // `findLast` would need lib ES2023, which is a higher floor than a
      // published package should ask for.
      const b = [...AXES].reverse().find((axis) => sign(axis) !== 0) ?? 0
      const c = AXES.find((axis) => sign(axis) === 0) ?? 0

      // Proud on one of the two axes and inset on the other, then the reverse:
      // the rectangle bridging the two faces, running the full width of the
      // cube on the third.
      const rectangle: ReadonlyArray<readonly [number, number, number]> = [
        [1, chamfer, -chamfer],
        [1, chamfer, chamfer],
        [chamfer, 1, chamfer],
        [chamfer, 1, -chamfer],
      ]

      polygon = rectangle.map(([onA, onB, onC]) =>
        new Vector3()
          .setComponent(a, sign(a) * onA)
          .setComponent(b, sign(b) * onB)
          .setComponent(c, onC),
      )
    } else {
      // Proud on each axis in turn: the triangle cutting the corner off.
      const triangle: ReadonlyArray<readonly [number, number, number]> = [
        [1, chamfer, chamfer],
        [chamfer, 1, chamfer],
        [chamfer, chamfer, 1],
      ]

      polygon = triangle.map(([onX, onY, onZ]) => new Vector3(sx * onX, sy * onY, sz * onZ))
    }

    // Every branch above is meant to wind counter-clockwise from outside, and
    // two of the three take it on trust. Checking it here is a few lines and
    // removes the whole class of "one panel is invisible from the front and
    // solid from behind".
    const [first, second, third] = polygon

    if (first && second && third) {
      const facing = new Vector3()
        .subVectors(second, first)
        .cross(new Vector3().subVectors(third, first))

      if (facing.dot(normal) < 0) polygon.reverse()
    }

    return { name, kind, direction, polygon: polygon.map(vec) }
  })
}

/** A zone's polygon as a flat, outward-facing triangle fan. */
export function panelGeometry(zone: CubeZone): BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const [first] = zone.polygon

  const geometry = new BufferGeometry()
  if (!first) return geometry

  for (let index = 1; index + 1 < zone.polygon.length; index += 1) {
    const b = zone.polygon[index]
    const c = zone.polygon[index + 1]
    if (!b || !c) continue

    positions.push(first.x, first.y, first.z, b.x, b.y, b.z, c.x, c.y, c.z)
    // The panel is planar, so every vertex shares the zone's own normal.
    for (let vertex = 0; vertex < 3; vertex += 1) {
      normals.push(zone.direction.x, zone.direction.y, zone.direction.z)
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))

  return geometry
}

/** The outline around every panel, as line segments. */
export function cubeOutlineGeometry(zones: readonly CubeZone[]): BufferGeometry {
  const positions: number[] = []

  for (const zone of zones) {
    for (let index = 0; index < zone.polygon.length; index += 1) {
      const from = zone.polygon[index]
      const to = zone.polygon[(index + 1) % zone.polygon.length]
      if (!from || !to) continue
      positions.push(from.x, from.y, from.z, to.x, to.y, to.z)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))

  return geometry
}

/**
 * A face's name on a quad floating just proud of it.
 *
 * The quad is built from the face's own polygon in its stored order, which
 * {@link cubeZones} lays out as (−right, −up), (+right, −up), (+right, +up),
 * (−right, +up) — so mapping UVs onto it in that order puts the text the right
 * way up for the camera pose {@link viewUp} chooses for the same view.
 */
export function labelGeometry(zone: CubeZone): BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const corners = [0, 1, 2, 0, 2, 3]
  const corner = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]

  for (const index of corners) {
    const point = zone.polygon[index]
    const uv = corner[index]
    if (!point || !uv) continue

    // Pushed out along the normal by a hair. Coplanar with the face it would
    // z-fight, and the panel's polygon offset pushes the face *back*, so the
    // two are moving apart rather than fighting.
    positions.push(
      point.x + zone.direction.x * 0.004,
      point.y + zone.direction.y * 0.004,
      point.z + zone.direction.z * 0.004,
    )
    uvs.push(uv[0] ?? 0, uv[1] ?? 0)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))

  return geometry
}

/** A face name, drawn on a transparent canvas and sized to fit. */
export function labelTexture(label: string, color: number): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (context) {
    const text = label.toUpperCase()
    const hex = `#${color.toString(16).padStart(6, '0')}`

    context.font = `600 ${size / 4}px system-ui, sans-serif`
    // `BOTTOM` is half again as wide as `TOP`, and a cube whose labels are set
    // in six different sizes looks like a mistake — so measure the widest at a
    // reference size and let the rest of them use it.
    const width = context.measureText('BOTTOM').width || 1
    const scale = Math.min(1, (size * 0.78) / width)

    context.font = `600 ${(size / 4) * scale}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = hex
    context.fillText(text, size / 2, size / 2)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true

  return texture
}
