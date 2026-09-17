import * as THREE from 'three'
import {
  buildRegionIndex,
  smoothRegionNormals,
  type PartModel,
  type PartModelFeature,
  type PartModelRegion,
  type Vec3,
} from '@toolpath/viewer'

/**
 * A handful of parts the viewer can render, built by hand rather than fetched,
 * so the example needs no API key and has something with a hole, a chamfer, a
 * pocket and a bore to point the measure tool at.
 *
 * A real part comes from `normalizePartReport(report)`, whose regions are the
 * Engine's analytic faces. These have no Engine behind them, so their regions
 * are read off the mesh instead: triangles are grouped into a region wherever
 * they meet at a shallow angle, which puts every facet of a bore into one
 * curved region and every wall, floor and chamfer into a flat one of its own.
 * That is the same guess `EdgesGeometry` makes and the viewer's README warns
 * against for real parts — on a real part the report already knows — but on
 * these it is exactly right, and it is what gives the measure tool corners and
 * edges to snap to.
 */
export interface ExampleModel {
  readonly id: string
  readonly name: string
  /** What is worth measuring on it. */
  readonly hint: string
  readonly model: PartModel
  readonly geometry: THREE.BufferGeometry
}

/** The six axis directions, so the arrows have something to draw on every part. */
const AXES: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]

/** Facets meeting at less than this are one surface. A 32-segment bore turns 11.25° per facet. */
const SMOOTH_ANGLE_DEGREES = 20

/**
 * The one-inch cube the example has always shown, with its regions and
 * features named by hand: the browser suite is written about these names.
 */
function inchCube(): ExampleModel {
  const faces = [
    { tag: 'right-face', direction: { x: 1, y: 0, z: 0 } },
    { tag: 'left-face', direction: { x: -1, y: 0, z: 0 } },
    { tag: 'top-face', direction: { x: 0, y: 1, z: 0 } },
    { tag: 'bottom-face', direction: { x: 0, y: -1, z: 0 } },
    { tag: 'front-face', direction: { x: 0, y: 0, z: 1 } },
    { tag: 'back-face', direction: { x: 0, y: 0, z: -1 } },
  ]
  const regions = faces.map((_face, idx) => ({
    idx,
    // This example has no analysis splits, so every region is its own origin.
    splitOrigin: idx,
    shapeKind: 'Plane',
    area: 25.4 * 25.4,
    triangles: { start: idx * 2, end: idx * 2 + 2 },
  }))
  const features = faces.map((face, idx) => ({
    tag: face.tag,
    featureType: 'face',
    machiningDirection: face.direction,
    axis: face.direction,
    regionIdxs: [idx],
  }))
  return {
    id: 'cube',
    name: 'One-inch cube',
    hint: 'Corner to corner is 25.40 mm along an edge and 43.99 mm across the body.',
    // Non-indexed on purpose. Highlighting is a per-vertex region attribute,
    // and a vertex shared between two regions has no single value to carry —
    // which is why the Engine mesh loader de-indexes too.
    geometry: new THREE.BoxGeometry(25.4, 25.4, 25.4).toNonIndexed(),
    model: {
      partId: 'one-inch-cube',
      kernelVersion: '0.3.0',
      features,
      regions,
      candidateDirections: faces.map((face) => face.direction),
      mesh: { pointCount: 36, triangleCount: 12, glbUrl: null, stlUrl: null, thumbnailUrl: null },
      regionIndex: buildRegionIndex({ regions, features, triangleCount: 12 }),
      warnings: [],
    },
  }
}

/** A rectangle centred on the origin, as a shape or as a hole. */
function rect(width: number, height: number, into = new THREE.Shape()): THREE.Shape {
  const w = width / 2
  const h = height / 2
  into.moveTo(-w, -h)
  into.lineTo(w, -h)
  into.lineTo(w, h)
  into.lineTo(-w, h)
  into.closePath()
  return into
}

/** A rectangle with rounded corners, the outline a pocket is milled to. */
function roundedRect(width: number, height: number, radius: number): THREE.Path {
  const w = width / 2
  const h = height / 2
  const path = new THREE.Path()
  path.moveTo(-w + radius, -h)
  path.lineTo(w - radius, -h)
  path.absarc(w - radius, -h + radius, radius, -Math.PI / 2, 0, false)
  path.lineTo(w, h - radius)
  path.absarc(w - radius, h - radius, radius, 0, Math.PI / 2, false)
  path.lineTo(-w + radius, h)
  path.absarc(-w + radius, h - radius, radius, Math.PI / 2, Math.PI, false)
  path.lineTo(-w, -h + radius)
  path.absarc(-w + radius, -h + radius, radius, Math.PI, Math.PI * 1.5, false)
  path.closePath()
  return path
}

function circle(radius: number, x = 0, y = 0): THREE.Path {
  const path = new THREE.Path()
  path.absarc(x, y, radius, 0, Math.PI * 2, false)
  return path
}

/** Extrudes a shape from `z0` up by `depth`, along +Z. */
function extrude(
  shape: THREE.Shape,
  depth: number,
  z0: number,
  options: Partial<THREE.ExtrudeGeometryOptions> = {},
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 32,
    ...options,
  })
  geometry.translate(0, 0, z0)
  return geometry
}

/** A 60 × 40 × 8 plate with a Ø12 bore in the middle and four Ø6.35 holes near the corners. */
function drilledPlate(): ExampleModel {
  const shape = rect(60, 40)
  shape.holes.push(circle(6))
  for (const x of [-22, 22]) for (const y of [-13, 13]) shape.holes.push(circle(3.175, x, y))
  return partFromGeometry(
    'plate',
    'Drilled plate',
    'The centre bore is Ø12.00 mm; the corner holes are Ø6.35 mm on 44 × 26 mm centres.',
    [extrude(shape, 8, -4)],
  )
}

/** A 50 × 30 × 16 block with a 3 mm chamfer round the top and bottom edges. */
function chamferedBlock(): ExampleModel {
  // A bevelled extrude grows the outline by the bevel and adds it to the height,
  // so the finished block is 56 × 36 × 22 with 3 mm chamfers at 45°.
  const geometry = new THREE.ExtrudeGeometry(rect(50, 30), {
    depth: 16,
    bevelEnabled: true,
    bevelThickness: 3,
    bevelSize: 3,
    bevelOffset: 0,
    bevelSegments: 1,
  })
  geometry.translate(0, 0, -8)
  return partFromGeometry(
    'chamfer',
    'Chamfered block',
    'Each chamfer is 3.00 mm on both legs and 4.24 mm across; the faces meet it at 135.0°.',
    [geometry],
  )
}

/** A 60 × 40 block, 18 tall, with a 40 × 24 pocket 8 deep and 5 mm corner radii. */
function pocketedBlock(): ExampleModel {
  const walls = rect(60, 40)
  walls.holes.push(roundedRect(40, 24, 5))
  return partFromGeometry(
    'pocket',
    'Pocketed block',
    'The pocket is 40.00 × 24.00 mm, 8.00 mm deep, with 5.00 mm corner radii.',
    // A slab and a ring: the ring's underside is inside the slab, which draws
    // as a seam round the block at the floor's height and nothing worse.
    [new THREE.BoxGeometry(60, 40, 10).translate(0, 0, -5), extrude(walls, 8, 0)],
  )
}

/** A Ø40 disc, 12 tall, with a Ø24 boss 14 tall on it and a Ø8 bore through both. */
function steppedBoss(): ExampleModel {
  const base = new THREE.Shape()
  base.absarc(0, 0, 20, 0, Math.PI * 2, false)
  base.holes.push(circle(4))
  const boss = new THREE.Shape()
  boss.absarc(0, 0, 12, 0, Math.PI * 2, false)
  boss.holes.push(circle(4))
  return partFromGeometry(
    'boss',
    'Stepped boss',
    'The disc is Ø40.00 mm and the boss Ø24.00 mm, 14.00 mm tall; the bore is Ø8.00 mm.',
    [extrude(base, 12, -12, { curveSegments: 48 }), extrude(boss, 14, 0, { curveSegments: 48 })],
  )
}

/**
 * A part from a mesh alone: its triangles grouped into regions where they
 * meet at a shallow angle, reordered so each region is one contiguous run,
 * and named one feature per region.
 */
function partFromGeometry(
  id: string,
  name: string,
  hint: string,
  sources: readonly THREE.BufferGeometry[],
): ExampleModel {
  const positions = concatPositions(sources)
  const triangleCount = positions.length / 9

  const normals: THREE.Vector3[] = []
  const areas: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  for (let t = 0; t < triangleCount; t += 1) {
    a.fromArray(positions, t * 9)
    b.fromArray(positions, t * 9 + 3)
    c.fromArray(positions, t * 9 + 6)
    const cross = ab.subVectors(b, a).cross(ac.subVectors(c, a))
    areas.push(cross.length() / 2)
    normals.push(cross.clone().normalize())
  }

  // Triangles that share an edge, found by the edge's two endpoints.
  const byEdge = new Map<string, number[]>()
  const key = (i: number, j: number) => {
    const p = Array.from(positions.subarray(i * 3, i * 3 + 3), (v) => v.toFixed(5))
    const q = Array.from(positions.subarray(j * 3, j * 3 + 3), (v) => v.toFixed(5))
    const [first, second] = p.join() < q.join() ? [p, q] : [q, p]
    return `${first.join()}|${second.join()}`
  }
  for (let t = 0; t < triangleCount; t += 1) {
    for (let e = 0; e < 3; e += 1) {
      const id = key(t * 3 + e, t * 3 + ((e + 1) % 3))
      const list = byEdge.get(id)
      if (list) list.push(t)
      else byEdge.set(id, [t])
    }
  }

  // Flood from each unassigned triangle across shallow edges.
  const limit = Math.cos((SMOOTH_ANGLE_DEGREES * Math.PI) / 180)
  const neighbours = new Map<number, number[]>()
  for (const list of byEdge.values()) {
    for (const t of list) {
      for (const u of list) {
        if (t !== u && normals[t]!.dot(normals[u]!) >= limit) {
          const held = neighbours.get(t)
          if (held) held.push(u)
          else neighbours.set(t, [u])
        }
      }
    }
  }
  const regionOf = new Int32Array(triangleCount).fill(-1)
  const members: number[][] = []
  for (let seed = 0; seed < triangleCount; seed += 1) {
    if (regionOf[seed] !== -1) continue
    const region = members.length
    const queue = [seed]
    const found: number[] = []
    regionOf[seed] = region
    while (queue.length) {
      const t = queue.pop()!
      found.push(t)
      for (const u of neighbours.get(t) ?? []) {
        if (regionOf[u] !== -1) continue
        regionOf[u] = region
        queue.push(u)
      }
    }
    members.push(found)
  }

  // Each region one contiguous run of triangles, as the viewer requires.
  const ordered = new Float32Array(positions.length)
  const regions: PartModelRegion[] = []
  const features: PartModelFeature[] = []
  let cursor = 0
  let curved = 0
  let flat = 0
  for (const [idx, found] of members.entries()) {
    const start = cursor
    const mean = new THREE.Vector3()
    let area = 0
    let planar = true
    for (const t of found) {
      ordered.set(positions.subarray(t * 9, t * 9 + 9), cursor * 9)
      cursor += 1
      area += areas[t]!
      mean.addScaledVector(normals[t]!, areas[t]!)
      if (normals[t]!.dot(normals[found[0]!]!) < 0.9999) planar = false
    }
    // A bore's facets face every way at once and sum to nothing; it is
    // machined along Z, which is where every part here is held from.
    const direction = mean.lengthSq() > 1e-6 ? mean.normalize() : new THREE.Vector3(0, 0, 1)
    const tag = planar ? `face-${(flat += 1)}` : `round-${(curved += 1)}`
    regions.push({
      idx,
      splitOrigin: idx,
      shapeKind: planar ? 'Plane' : 'Cylinder',
      area,
      triangles: { start, end: cursor },
    })
    features.push({
      tag,
      featureType: 'face',
      machiningDirection: { x: direction.x, y: direction.y, z: direction.z },
      axis: { x: direction.x, y: direction.y, z: direction.z },
      regionIdxs: [idx],
    })
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(ordered, 3))
  geometry.computeVertexNormals()
  // Flat regions stay flat; a bore's facets blend into a cylinder.
  smoothRegionNormals(geometry, regions)

  return {
    id,
    name,
    hint,
    geometry,
    model: {
      partId: `example-${id}`,
      kernelVersion: '0.3.0',
      features,
      regions,
      candidateDirections: AXES,
      mesh: {
        pointCount: triangleCount * 3,
        triangleCount,
        glbUrl: null,
        stlUrl: null,
        thumbnailUrl: null,
      },
      regionIndex: buildRegionIndex({ regions, features, triangleCount }),
      warnings: [],
    },
  }
}

/** Every source's triangles, de-indexed, as one flat position array. */
function concatPositions(sources: readonly THREE.BufferGeometry[]): Float32Array {
  const parts = sources.map((source) => {
    const flat = source.index ? source.toNonIndexed() : source
    return flat.getAttribute('position').array as Float32Array
  })
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const positions = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    positions.set(part, offset)
    offset += part.length
  }
  return positions
}

export const MODELS: readonly ExampleModel[] = [
  inchCube(),
  drilledPlate(),
  chamferedBlock(),
  pocketedBlock(),
  steppedBoss(),
]

/** The model `?model=<id>` asks for, or the cube the browser suite is written about. */
export function modelFromQuery(params: URLSearchParams): ExampleModel {
  const wanted = params.get('model')
  return MODELS.find((entry) => entry.id === wanted) ?? MODELS[0]!
}
