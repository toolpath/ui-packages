import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  GreaterDepth,
  Group,
  KeepStencilOp,
  LessEqualDepth,
  type Matrix4,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  type Plane,
  ReplaceStencilOp,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import type { FeatureTag, PartModel, Vec3 } from '../model/types.js'
import { visualSurfaces } from '../model/surfaces.js'
import { keyFor } from './adjacency.js'
import type { ViewerCamera, ViewportSize } from './camera.js'
import { screenPoint } from './measure.js'
import type { ViewerTheme } from './theme.js'

/**
 * Every place two surfaces of the part meet, with how sharply and which way
 * they fold there, and the two regions either side.
 *
 * This finds edges; it does not judge them. Which corners are a problem is the
 * DFM rules' call, from the Engine's measurements (see
 * {@link SharpCornerOptions.features}) — geometry alone calls every hole's rim
 * and every stud's base sharp, and neither is anything an end mill minds. What
 * the mesh contributes is *where*: the exact edges to draw for a feature the
 * rules have already flagged.
 *
 * The walk is the one `regionEdgesGeometry` makes — an edge between two visual
 * surfaces is a real edge of the part, an edge inside one is tessellation — and
 * then each such edge is measured from the two triangles either side of it:
 *
 * - **The angle** between their normals. A fillet or a blend meets its
 *   neighbours tangentially, so it reads near 0°; a square shoulder reads 90°.
 *   On real Engine parts the two populations do not overlap — creases sit at
 *   60–100°, tangent seams under 10°.
 * - **Which way it folds.** Concave where each triangle's far corner stands in
 *   front of the other's plane: an inside corner.
 *
 * Endpoints are matched by **quantised position** — `keyFor`, the key
 * `regionAdjacency` uses, so the two agree on a shared vertex — not by exact
 * float: the two triangles either side of an edge belong to two
 * surfaces tessellated separately, and the pairing is the whole measurement.
 * The Engine's meshes are watertight — every edge on the parts measured is met
 * by exactly two triangles — so an edge met once is a hole in a mesh from
 * somewhere else and is skipped, and one met a third time keeps the first pair.
 *
 * The mesh must be non-indexed, which `parsePartGeometry` guarantees.
 */
export interface SurfaceCreases {
  /** How many segments. */
  readonly count: number
  /** Each segment's two endpoints, `x y z x y z`, in the geometry's own space. */
  readonly positions: Float32Array
  /** Degrees between the two faces' normals: 0 is smooth, 90 is square. */
  readonly angles: Float32Array
  /** 1 where the surfaces fold inward — an inside corner — and 0 where they fold outward. */
  readonly concave: Uint8Array
  /** The region `idx` either side of each segment, two to a segment; `-1` for a triangle in none. */
  readonly regions: Int32Array
  /**
   * The far corner of the triangle either side of each segment, `x y z x y z`:
   * which way each face runs on from the corner, and how far.
   */
  readonly fars: Float32Array
}

export interface SharpCornerOptions {
  /**
   * The features the DFM rules flag with a sharp corner — those whose
   * `featureSheet(datasheet).sharpCorners` is set, from `@toolpath/dfm/model`.
   * Each one's inside corners that run along its machining direction are
   * drawn: the vertical corners between its walls that no end mill makes.
   * Nothing else is. Tags are matched without regard to case.
   */
  readonly features: readonly FeatureTag[]
}

/*
 * Fixed, not options. Which corners count is the DFM rules' decision, so all
 * that is left here is telling a real corner from a tangent seam — on Engine
 * meshes creases sit at 60–100° and tangent seams under 10°, so neither
 * threshold is a fine judgment — and how the bands look.
 */
/** The least fold that is a corner rather than a tangent seam, in degrees. */
const MIN_FOLD_DEGREES = 20
/** How far off a feature's machining direction a corner may run, in degrees. */
const ALONG_TOLERANCE_DEGREES = 15
/** How wide a corner is drawn, in CSS pixels, half of it on each face, its outline included. */
const BAND_WIDTH = 9
/** The light edge each side of a corner, in CSS pixels; the rest of the band is its colour. */
const OUTLINE_WIDTH = 1.5
/** The outline's colour: light, so the corner stands out on paint of any colour, its own included. */
const OUTLINE_COLOR = 0xffffff
/** How much wider the corner under the pointer is drawn. */
const HOVER_WIDTH = 1.5
/** How strongly a corner shows where it can be seen, and where the part stands in front of it. */
const NEAR_OPACITY = 1
const FAR_OPACITY = 0.35

const DEGREES = 180 / Math.PI

/** Finds and measures every crease between two visual surfaces. See {@link SurfaceCreases}. */
export function surfaceCreases(
  geometry: BufferGeometry,
  model: Pick<PartModel, 'regions'>,
): SurfaceCreases {
  const position = geometry.getAttribute('position')
  if (!position || geometry.index) return emptyCreases()

  const triangleCount = Math.floor(position.count / 3)
  const surfaces = visualSurfaces(model.regions)
  const surfaceOf = new Int32Array(triangleCount).fill(-1)
  const regionOf = new Int32Array(triangleCount).fill(-1)
  for (const region of model.regions) {
    const end = Math.min(region.triangles.end, triangleCount)
    for (let triangle = Math.max(region.triangles.start, 0); triangle < end; triangle += 1) {
      surfaceOf[triangle] = surfaces.get(region.idx) ?? region.idx
      regionOf[triangle] = region.idx
    }
  }

  // Unit face normals from the winding, which the renderer already relies on
  // pointing out of the part. A degenerate triangle keeps a zero normal and
  // measures nothing.
  const normals = new Float32Array(triangleCount * 3)
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const at = triangle * 3
    const ax = position.getX(at)
    const ay = position.getY(at)
    const az = position.getZ(at)
    const ux = position.getX(at + 1) - ax
    const uy = position.getY(at + 1) - ay
    const uz = position.getZ(at + 1) - az
    const vx = position.getX(at + 2) - ax
    const vy = position.getY(at + 2) - ay
    const vz = position.getZ(at + 2) - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz)
    if (length === 0) continue
    normals[at] = nx / length
    normals[at + 1] = ny / length
    normals[at + 2] = nz / length
  }

  const keyOf = (vertex: number): string =>
    keyFor(position.getX(vertex), position.getY(vertex), position.getZ(vertex))

  /** The first triangle corner seen on each edge: `triangle * 3 + corner`, the edge running corner → corner + 1. `-1` once paired. */
  const open = new Map<string, number>()
  const positions: number[] = []
  const angles: number[] = []
  const concave: number[] = []
  const regions: number[] = []
  const fars: number[] = []

  /** How far `vertex` stands in front of `triangle`'s plane, through `on`, a point on the shared edge. */
  const inFront = (triangle: number, vertex: number, on: number): number =>
    normals[triangle * 3]! * (position.getX(vertex) - position.getX(on)) +
    normals[triangle * 3 + 1]! * (position.getY(vertex) - position.getY(on)) +
    normals[triangle * 3 + 2]! * (position.getZ(vertex) - position.getZ(on))

  const measure = (first: number, second: number): void => {
    const t1 = Math.floor(first / 3)
    const t2 = Math.floor(second / 3)
    if (surfaceOf[t1] === surfaceOf[t2]) return

    // A degenerate triangle's zero normal would make the dot 0 and read as a square fold.
    if (normals[t1 * 3]! === 0 && normals[t1 * 3 + 1]! === 0 && normals[t1 * 3 + 2]! === 0) return
    if (normals[t2 * 3]! === 0 && normals[t2 * 3 + 1]! === 0 && normals[t2 * 3 + 2]! === 0) return
    const dot =
      normals[t1 * 3]! * normals[t2 * 3]! +
      normals[t1 * 3 + 1]! * normals[t2 * 3 + 1]! +
      normals[t1 * 3 + 2]! * normals[t2 * 3 + 2]!

    const a = t1 * 3 + (first % 3)
    const b = t1 * 3 + ((first + 1) % 3)
    const far1 = t1 * 3 + ((first + 2) % 3)
    const far2 = t2 * 3 + ((second + 2) % 3)
    // Both sides asked, so a sliver whose far corner sits almost on the edge
    // is outvoted by its neighbour rather than deciding alone.
    const fold = inFront(t1, far2, a) + inFront(t2, far1, a)

    positions.push(
      position.getX(a),
      position.getY(a),
      position.getZ(a),
      position.getX(b),
      position.getY(b),
      position.getZ(b),
    )
    angles.push(Math.acos(Math.min(1, Math.max(-1, dot))) * DEGREES)
    concave.push(fold > 0 ? 1 : 0)
    regions.push(regionOf[t1]!, regionOf[t2]!)
    fars.push(
      position.getX(far1),
      position.getY(far1),
      position.getZ(far1),
      position.getX(far2),
      position.getY(far2),
      position.getZ(far2),
    )
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const keys = [keyOf(triangle * 3), keyOf(triangle * 3 + 1), keyOf(triangle * 3 + 2)]
    for (let corner = 0; corner < 3; corner += 1) {
      const from = keys[corner]!
      const to = keys[(corner + 1) % 3]!
      if (from === to) continue
      const edge = from < to ? `${from}|${to}` : `${to}|${from}`
      const seen = open.get(edge)
      if (seen === undefined) open.set(edge, triangle * 3 + corner)
      else if (seen !== -1) {
        measure(seen, triangle * 3 + corner)
        open.set(edge, -1)
      }
    }
  }

  return {
    count: angles.length,
    positions: new Float32Array(positions),
    angles: new Float32Array(angles),
    concave: new Uint8Array(concave),
    regions: new Int32Array(regions),
    fars: new Float32Array(fars),
  }
}

/** What `options` would draw, as a string: equal keys draw the same lines. */
export function sharpCornerKey(options: SharpCornerOptions): string {
  return options.features
    .map((tag) => tag.toLowerCase())
    .sort()
    .join(',')
}

/**
 * One sharp corner the DFM rules flag, as drawn: a run of crease segments end
 * to end along its feature's machining direction — usually one, more where the
 * mesh splits the corner.
 */
export interface SharpCorner {
  /** Its place among the part's corners, stable while the flagged features are. */
  readonly index: number
  /** The flagged feature it belongs to, as the part model spells the tag. */
  readonly feature: FeatureTag
  /** Its two ends, in the part's own space. */
  readonly start: Vec3
  readonly end: Vec3
  /** How far it runs, mm: as deep as a tool would have to reach to make it. */
  readonly length: number
  /** The angle between the two faces that meet in it, degrees: 90 for a square corner. */
  readonly angle: number
  /** The regions either side of it. */
  readonly regions: readonly number[]
  /** Its segments, as indices into the {@link SurfaceCreases} it was found in. */
  readonly segments: readonly number[]
}

/**
 * The flagged features' corners: each inside crease with a flagged feature's
 * face on either side of it, running along that feature's machining direction,
 * joined end to end into whole corners. A floor meeting a wall square is a
 * flat end mill's ordinary work, and runs across the direction rather than
 * along it.
 */
export function findSharpCorners(
  creases: SurfaceCreases,
  model: Pick<PartModel, 'features' | 'regionIndex'>,
  options: SharpCornerOptions,
): SharpCorner[] {
  const alongCos = Math.cos(ALONG_TOLERANCE_DEGREES / DEGREES)

  // Region → the flagged features it belongs to, with their machining
  // directions. A face can belong to more than one, cut from different sides.
  const flagged = new Set(options.features.map((tag) => tag.toLowerCase()))
  const owners = new Map<number, { tag: FeatureTag; axis: Vec3 }[]>()
  for (const feature of model.features) {
    if (!flagged.has(feature.tag.toLowerCase())) continue
    const axis = unit(feature.machiningDirection)
    if (!axis) continue
    for (const region of model.regionIndex.regionsForFeature(feature.tag)) {
      const held = owners.get(region)
      if (held) held.push({ tag: feature.tag, axis })
      else owners.set(region, [{ tag: feature.tag, axis }])
    }
  }
  if (owners.size === 0) return []

  const { positions } = creases
  const kept: { segment: number; feature: FeatureTag }[] = []
  for (let segment = 0; segment < creases.count; segment += 1) {
    if (creases.concave[segment] !== 1 || creases.angles[segment]! < MIN_FOLD_DEGREES) continue
    const candidates = [
      ...(owners.get(creases.regions[segment * 2]!) ?? []),
      ...(owners.get(creases.regions[segment * 2 + 1]!) ?? []),
    ]
    if (candidates.length === 0) continue

    const at = segment * 6
    const dx = positions[at + 3]! - positions[at]!
    const dy = positions[at + 4]! - positions[at + 1]!
    const dz = positions[at + 5]! - positions[at + 2]!
    const length = Math.hypot(dx, dy, dz)
    if (length === 0) continue
    const owner = candidates.find(
      ({ axis }) => Math.abs(dx * axis.x + dy * axis.y + dz * axis.z) / length >= alongCos,
    )
    if (owner) kept.push({ segment, feature: owner.tag })
  }

  // Segments of one feature that share an end are one corner the mesh split.
  const keyOf = (at: number) => keyFor(positions[at]!, positions[at + 1]!, positions[at + 2]!)
  const parent = kept.map((_, at) => at)
  const root = (at: number): number => {
    while (parent[at] !== at) at = parent[at] = parent[parent[at]!]!
    return at
  }
  const byEnd = new Map<string, number>()
  kept.forEach(({ segment, feature }, at) => {
    for (const end of [segment * 6, segment * 6 + 3]) {
      const key = `${feature.toLowerCase()}|${keyOf(end)}`
      const other = byEnd.get(key)
      if (other === undefined) byEnd.set(key, at)
      else parent[root(at)] = root(other)
    }
  })
  const groups = new Map<number, number[]>()
  kept.forEach((_, at) => {
    const group = groups.get(root(at))
    if (group) group.push(at)
    else groups.set(root(at), [at])
  })

  return [...groups.values()].map((members, index) => {
    const feature = kept[members[0]!]!.feature
    const segments = members.map((at) => kept[at]!.segment)
    // Its ends: the points furthest apart along the first segment's direction.
    const first = segments[0]! * 6
    const axis = unit({
      x: positions[first + 3]! - positions[first]!,
      y: positions[first + 4]! - positions[first + 1]!,
      z: positions[first + 5]! - positions[first + 2]!,
    })!
    let start: Vec3 | null = null
    let end: Vec3 | null = null
    let low = Infinity
    let high = -Infinity
    let length = 0
    let folded = 0
    const regions = new Set<number>()
    for (const segment of segments) {
      const at = segment * 6
      for (const point of [at, at + 3]) {
        const p = { x: positions[point]!, y: positions[point + 1]!, z: positions[point + 2]! }
        const along = p.x * axis.x + p.y * axis.y + p.z * axis.z
        if (along < low) [low, start] = [along, p]
        if (along > high) [high, end] = [along, p]
      }
      const run = Math.hypot(
        positions[at + 3]! - positions[at]!,
        positions[at + 4]! - positions[at + 1]!,
        positions[at + 5]! - positions[at + 2]!,
      )
      length += run
      folded += run * creases.angles[segment]!
      regions.add(creases.regions[segment * 2]!)
      regions.add(creases.regions[segment * 2 + 1]!)
    }
    return {
      index,
      feature,
      start: start!,
      end: end!,
      length,
      // The normals turn by the fold; the faces themselves open by what is left of 180°.
      angle: 180 - folded / length,
      regions: [...regions],
      segments,
    }
  })
}

/** The flagged features' corners, as `x y z x y z` endpoint pairs. See {@link findSharpCorners}. */
export function sharpCornerPositions(
  creases: SurfaceCreases,
  model: Pick<PartModel, 'features' | 'regionIndex'>,
  options: SharpCornerOptions,
): Float32Array {
  const segments = findSharpCorners(creases, model, options).flatMap((corner) => corner.segments)
  const positions = new Float32Array(segments.length * 6)
  segments.forEach((segment, at) =>
    positions.set(creases.positions.subarray(segment * 6, segment * 6 + 6), at * 6),
  )
  return positions
}

/** How near a corner the pointer must be, in CSS pixels, to be on it rather than on the face. */
const SHARP_CORNER_HOVER_PIXELS = 6

/**
 * The corner under the pointer, if any: one whose faces include the face the
 * pointer is on, passing within {@link SHARP_CORNER_HOVER_PIXELS} of it on
 * screen. The band is painted on those faces, so this is the band the pointer
 * is over, a little generously — six pixels is a narrow thing to land on.
 * The nearest wins where two are that close.
 */
export function sharpCornerAt(
  corners: readonly SharpCorner[],
  creases: SurfaceCreases,
  hit: { readonly point: Vector3; readonly region: number },
  camera: ViewerCamera,
  viewport: ViewportSize,
  matrixWorld: Matrix4,
): SharpCorner | null {
  const pointer = screenPoint(camera, hit.point, viewport)
  const a = new Vector3()
  const b = new Vector3()
  const from = new Vector2()
  const to = new Vector2()
  let nearest: SharpCorner | null = null
  let reach = SHARP_CORNER_HOVER_PIXELS
  for (const corner of corners) {
    if (!corner.regions.includes(hit.region)) continue
    for (const segment of corner.segments) {
      a.fromArray(creases.positions, segment * 6).applyMatrix4(matrixWorld)
      b.fromArray(creases.positions, segment * 6 + 3).applyMatrix4(matrixWorld)
      screenPoint(camera, a, viewport, from)
      screenPoint(camera, b, viewport, to)
      const distance = distanceToSegment(pointer, from, to)
      if (distance <= reach) [reach, nearest] = [distance, corner]
    }
  }
  return nearest
}

function distanceToSegment(point: Vector2, from: Vector2, to: Vector2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const span = dx * dx + dy * dy
  const t =
    span === 0
      ? 0
      : Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / span))
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy))
}

/**
 * The bands a corner is drawn as: for each segment, a strip lying flat on each
 * of the two faces that meet there, from the corner a little way onto the face.
 *
 * Painted onto the faces, not floated in front of them. A line is a ribbon at
 * the corner's own depth, and at an inside corner the walls either side come
 * forward of it, so it either loses all but its middle to them or has to be
 * pushed toward the camera to beat them — and pushed, it beats whatever else
 * is just in front too, standing proud of the rim where a corner goes out of
 * sight. A band on the faces is seen exactly where they are, and stops where
 * the corner does.
 *
 * Every vertex sits on the corner; `aSide` 1 marks the two that the vertex
 * shader moves out along `aPerp` — across the face, square to the corner —
 * by the band's width on screen, never more than `aReach`, the triangle's own
 * extent that way, so a band on a narrow face does not run off its far edge.
 * `aCorner` is the corner's index, for drawing the one under the pointer up.
 */
export function sharpCornerBands(
  creases: SurfaceCreases,
  corners: readonly SharpCorner[],
): BufferGeometry {
  const position: number[] = []
  const perp: number[] = []
  const side: number[] = []
  const reach: number[] = []
  const owner: number[] = []
  const index: number[] = []

  for (const { index: corner, segments } of corners) {
    for (const segment of segments) {
      const at = segment * 6
      const a = [creases.positions[at]!, creases.positions[at + 1]!, creases.positions[at + 2]!]
      const b = [creases.positions[at + 3]!, creases.positions[at + 4]!, creases.positions[at + 5]!]
      const edge = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
      const length = Math.hypot(edge[0]!, edge[1]!, edge[2]!)
      if (length === 0) continue
      const along = edge.map((value) => value / length)

      for (let face = 0; face < 2; face += 1) {
        // The far corner's offset from the corner, less its part along it: the
        // way across this face, and how far the triangle goes that way.
        const far = at + face * 3
        const v = [
          creases.fars[far]! - a[0]!,
          creases.fars[far + 1]! - a[1]!,
          creases.fars[far + 2]! - a[2]!,
        ]
        const t = v[0]! * along[0]! + v[1]! * along[1]! + v[2]! * along[2]!
        const across = [v[0]! - t * along[0]!, v[1]! - t * along[1]!, v[2]! - t * along[2]!]
        const extent = Math.hypot(across[0]!, across[1]!, across[2]!)
        if (extent === 0) continue

        const first = position.length / 3
        for (const [point, out] of [
          [a, 0],
          [b, 0],
          [a, 1],
          [b, 1],
        ] as const) {
          position.push(point[0]!, point[1]!, point[2]!)
          perp.push(across[0]! / extent, across[1]! / extent, across[2]! / extent)
          side.push(out)
          reach.push(extent)
          owner.push(corner)
        }
        index.push(first, first + 1, first + 3, first, first + 3, first + 2)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('aPerp', new Float32BufferAttribute(perp, 3))
  geometry.setAttribute('aSide', new Float32BufferAttribute(side, 1))
  geometry.setAttribute('aReach', new Float32BufferAttribute(reach, 1))
  geometry.setAttribute('aCorner', new Float32BufferAttribute(owner, 1))
  geometry.setIndex(new BufferAttribute(new Uint32Array(index), 1))
  return geometry
}

/**
 * The sharp corners as drawn: bands on the faces either side of each corner
 * (see {@link sharpCornerBands}), strong where they can be seen and faint
 * where the part stands in front of them, so a corner on the far side still
 * reads as there without reading as here.
 *
 * Two draws of one geometry, split by the depth test — the near one passes
 * where the band is in front of whatever else is at that pixel, the far one
 * exactly where it is not. A band lies on the very face it marks, so the two
 * tie, and the bands settle the tie themselves: each is pulled a hair toward
 * the camera (`polygonOffset`). Leaning on the part's own offset instead let
 * the near and far draws fight over a focused face, whose material has none.
 *
 * And the test needs the part's depth to be there. A solid part writes it; in
 * wireframe or focus its faded faces do not, and every corner, even one behind
 * the part, read as in view. So in those modes the drawing lays the part's
 * depth down itself, just before the bands: a copy of the part that writes
 * depth and no colour ({@link SharpCornerDrawing.setPartDepth}). It comes after
 * everything else that tests depth and before the measure tool, so it hides
 * nothing but the corners behind the part.
 *
 * And each pixel is drawn **once**, by one stencil bit both draws test and
 * set, so where bands overlap a translucent one does not blend twice. The near
 * draw goes first, so where a corner in view crosses one behind, the one in
 * view is what shows.
 *
 * Each band has a light **outline** along both its edges. A corner lies on the
 * faces of a feature an application has usually painted for the very rule that
 * flagged it — in red, as like as not — and a corner in one colour vanishes
 * into paint of a near one, while a dark one reads as a shadow in the crease.
 * Edged in white, a corner of any colour shows on paint of any colour.
 */
export interface SharpCornerDrawing {
  readonly object: Group
  /** Draws these corners of `creases`. None draws nothing. */
  setCorners(creases: SurfaceCreases, corners: readonly SharpCorner[]): void
  /** Draws one corner up — wider and stronger — as the one under the pointer. `null` for none. */
  setHovered(index: number | null): void
  /** Draws nothing, and keeps what it had for the next time. */
  clear(): void
  setTheme(theme: ViewerTheme): void
  /**
   * Lays the part's depth down before the bands, for a part that is not
   * writing its own: in wireframe, or faded around a focus. Off for a solid one.
   */
  setPartDepth(on: boolean): void
  setClippingPlanes(planes: Plane[] | null): void
  dispose(): void
}

/**
 * The part's depth, then the near draw, then the far one: after everything
 * else on the part that tests depth — the stock (5, 6), the section's plane
 * (5), a tool mark (6) — and before the measure tool (7) and what follows it,
 * none of which tests depth. So the depth laid down for the bands in wireframe
 * hides nothing else.
 */
const SHARP_CORNER_RENDER_ORDER = { depth: 6.25, near: 6.5, far: 6.75 } as const

/**
 * The stencil bit that marks a pixel as drawn. The top one: the section cap
 * counts faces in the low bits and zeroes what it caps, and draws before these
 * — it is opaque, they are not — so nothing it leaves reaches this bit unless
 * the count runs below zero and wraps, which takes a camera inside the part.
 */
export const SHARP_CORNER_STENCIL_BIT = 0x80

/**
 * Moves each `aSide` vertex across its face by half the band's width on
 * screen. `projectionMatrix[1][1]` is `1 / tan(fov / 2)` for a perspective
 * camera and `2 / height` for an orthographic one, which is what turns a
 * pixel into a distance at the vertex's depth either way. A face seen nearly
 * edge on shows little of any step across it, so the step grows to make up —
 * to at most four times, and never past the face.
 */
const BAND_VERTEX = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_vertex>

  attribute vec3 aPerp;
  attribute float aSide;
  attribute float aReach;
  attribute float aCorner;
  uniform float uHalfWidth;
  uniform float uHoverWidth;
  uniform float uHovered;
  uniform vec2 uResolution;
  varying float vHovered;
  varying float vAcross;

  void main() {
    // 0 on the corner, 1 at the band's edge on the face: where the outline is.
    vAcross = aSide;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 across = mat3(modelViewMatrix) * aPerp;
    float reach = aReach * length(across);
    across = normalize(across);

    bool perspective = projectionMatrix[2][3] == -1.0;
    float pixel = 2.0 / (projectionMatrix[1][1] * uResolution.y);
    if (perspective) pixel *= -mvPosition.z;
    vec3 sight = perspective ? normalize(-mvPosition.xyz) : vec3(0.0, 0.0, 1.0);
    float shown = length(across - sight * dot(across, sight));
    vHovered = abs(aCorner - uHovered) < 0.5 ? 1.0 : 0.0;
    float halfWidth = uHalfWidth * mix(1.0, uHoverWidth, vHovered);
    float offset = min(halfWidth * pixel / max(shown, 0.25), reach);

    mvPosition.xyz += across * offset * aSide;
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }
`

const BAND_FRAGMENT = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_fragment>

  uniform vec3 diffuse;
  uniform vec3 outline;
  uniform float opacity;
  uniform float uCore;
  varying float vHovered;
  varying float vAcross;

  void main() {
    #include <clipping_planes_fragment>
    // The corner's colour out to uCore of the way across, the outline past it.
    float soft = fwidth(vAcross);
    vec3 color = mix(diffuse, outline, smoothstep(uCore - soft, uCore + soft, vAcross));
    // The corner under the pointer, twice as strong: plain even where the part hides it.
    gl_FragColor = vec4(color, min(1.0, opacity * mix(1.0, 2.0, vHovered)));
    #include <colorspace_fragment>
  }
`

export function createSharpCornerDrawing(
  theme: ViewerTheme,
  part: BufferGeometry,
): SharpCornerDrawing {
  let geometry = new BufferGeometry()
  // Shared by both draws, and kept to the viewport each frame.
  const resolution = { value: new Vector2(1, 1) }
  const hovered = { value: -1 }
  const viewport = new Vector4()

  const material = (opacity: number, depthFunc: typeof LessEqualDepth | typeof GreaterDepth) => {
    const band = new ShaderMaterial({
      uniforms: {
        diffuse: { value: new Color(theme.sharpCorner) },
        outline: { value: new Color(OUTLINE_COLOR) },
        opacity: { value: opacity },
        uCore: { value: 1 - OUTLINE_WIDTH / (BAND_WIDTH / 2) },
        uHalfWidth: { value: BAND_WIDTH / 2 },
        uHoverWidth: { value: HOVER_WIDTH },
        uHovered: hovered,
        uResolution: resolution,
      },
      vertexShader: BAND_VERTEX,
      fragmentShader: BAND_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      clipping: true,
    })
    band.depthFunc = depthFunc
    // Wins the tie with the face the band lies on, whatever drew that face.
    band.polygonOffset = true
    band.polygonOffsetFactor = -1
    band.polygonOffsetUnits = -1
    band.stencilWrite = true
    band.stencilRef = SHARP_CORNER_STENCIL_BIT
    band.stencilFuncMask = SHARP_CORNER_STENCIL_BIT
    band.stencilWriteMask = SHARP_CORNER_STENCIL_BIT
    band.stencilFunc = NotEqualStencilFunc
    band.stencilFail = KeepStencilOp
    band.stencilZFail = KeepStencilOp
    band.stencilZPass = ReplaceStencilOp
    return band
  }
  const nearMaterial = material(NEAR_OPACITY, LessEqualDepth)
  const farMaterial = material(FAR_OPACITY, GreaterDepth)

  const near = new Mesh(geometry, nearMaterial)
  const far = new Mesh(geometry, farMaterial)
  near.name = 'sharpCornersNear'
  far.name = 'sharpCornersFar'
  near.renderOrder = SHARP_CORNER_RENDER_ORDER.near
  far.renderOrder = SHARP_CORNER_RENDER_ORDER.far
  // Bands must never win a pick: the part's faces are what a click is about.
  near.raycast = () => {}
  far.raycast = () => {}

  // The part's depth and no colour, pushed back as the part's own surface is.
  // Transparent only to be drawn among the transparent things, in its order.
  const depthMaterial = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const depth = new Mesh(part, depthMaterial)
  depth.name = 'sharpCornersDepth'
  depth.renderOrder = SHARP_CORNER_RENDER_ORDER.depth
  depth.visible = false
  depth.raycast = () => {}
  // The band's width is in pixels, so it needs the viewport it is drawn into.
  near.onBeforeRender = (renderer) => {
    renderer.getViewport(viewport)
    resolution.value.set(viewport.z, viewport.w)
  }

  const object = new Group()
  object.add(depth, far, near)
  object.visible = false

  return {
    object,

    clear() {
      object.visible = false
    },

    setHovered(index) {
      hovered.value = index ?? -1
    },

    setCorners(creases, corners) {
      hovered.value = -1
      object.visible = corners.length > 0
      if (corners.length === 0) return
      const next = sharpCornerBands(creases, corners)
      near.geometry = next
      far.geometry = next
      geometry.dispose()
      geometry = next
    },

    setTheme(next) {
      for (const band of [nearMaterial, farMaterial]) {
        ;(band.uniforms['diffuse']!.value as Color).setHex(next.sharpCorner)
      }
    },

    setPartDepth(on) {
      depth.visible = on
    },

    setClippingPlanes(planes) {
      nearMaterial.clippingPlanes = planes
      farMaterial.clippingPlanes = planes
      depthMaterial.clippingPlanes = planes
    },

    dispose() {
      object.clear()
      // Only the bands' own geometry: the part's belongs to the part.
      geometry.dispose()
      nearMaterial.dispose()
      farMaterial.dispose()
      depthMaterial.dispose()
    },
  }
}

function unit(vector: Vec3): Vec3 | null {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  return length === 0 ? null : { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function emptyCreases(): SurfaceCreases {
  return {
    count: 0,
    positions: new Float32Array(0),
    angles: new Float32Array(0),
    concave: new Uint8Array(0),
    regions: new Int32Array(0),
    fars: new Float32Array(0),
  }
}
