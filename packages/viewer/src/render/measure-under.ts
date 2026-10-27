import type { PartModel } from '../model/types.js'
import { type ViewerCamera, type ViewportSize } from './camera.js'
import { screenPoint } from './measure.js'
import {
  Matrix4,
  type Plane,
  type Ray,
  Sphere,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Intersection,
  type Mesh,
  type Raycaster,
} from 'three'
import { toVector, type HoleIndex, type Point, type SurfaceFor } from './face-measure.js'
import type { OnFace, SnapReach, Snapped, Under } from './measure-picks.js'
import {
  cornersNear,
  edgeCorners,
  edgeLines,
  edgesNear,
  type EdgeCorner,
  type EdgeLines,
  type ScreenAt,
} from './edge-corners.js'
import { capHit, clipSegments, sectionContour } from './resample.js'

/**
 * What is under the measure tool's pointer, read with rays of its own at the
 * part (`underPointer`): the face, and with Alt where a point snaps.
 */

/** The part's edges to snap to: its corners and straight edges' middles, and its edges whole. */
export interface EdgeSnaps {
  corners: readonly EdgeCorner[]
  lines: EdgeLines
  /**
   * Each edge line in world space, made once when first snapped to, so a
   * read along the same edge gives the same points and nothing is drawn
   * again. The part does not move, so they hold for as long as it does.
   */
  worldLines: Map<number, readonly Point[]>
}

/** The snaps on edges given as segments, six floats each, the layout `regionEdgesGeometry` draws. */
export const edgeSnaps = (positions: ArrayLike<number>): EdgeSnaps => ({
  corners: edgeCorners(positions),
  lines: edgeLines(positions),
  worldLines: new Map(),
})

/** Where a section plane passes through solid material, in the mesh's own space. */
interface CutFace {
  plane: Plane
  /** Its outline, six floats per segment (`sectionContour`). */
  contour: Float32Array
}

/**
 * A cut part, re-sampled for measuring (`render/resample.ts`). A clipping
 * plane hides half of the part without changing a triangle, so its own edges
 * still describe the whole of it: these are the edges left, and the faces the
 * cut made, which are solid on screen and have corners of their own.
 */
interface CutPart {
  /** The edges left after the cut, with each cut face's outline. */
  snaps: EdgeSnaps
  faces: readonly CutFace[]
}

/** The cut on a surface of the part as it is now, or null where nothing cuts it. */
export type CutSampler = (surface: Mesh) => CutPart | null

/**
 * Re-samples the part each time its cut moves, and only then: the sample is
 * kept by the planes' numbers, as a drag writes new numbers into one `Plane`.
 * `edges` are the part's own (`regionEdgesGeometry`), in the mesh's space.
 */
export const cutSampler = (
  geometry: BufferGeometry,
  model: PartModel,
  edges: ArrayLike<number> | null,
): CutSampler => {
  let triangles: { positions: ArrayLike<number>; regionOf: Int32Array } | null = null
  const held = new Map<Mesh, { key: string; part: CutPart }>()
  return (surface) => {
    const planes = clippingPlanesOf(surface)
    if (planes.length === 0) return null
    const key = planes
      .map(({ normal: n, constant }) => `${n.x},${n.y},${n.z},${constant}`)
      .join('|')
    const known = held.get(surface)
    if (known?.key === key) return known.part
    triangles ??= trianglesOf(geometry, model)
    const toLocal = new Matrix4().copy(surface.matrixWorld).invert()
    const part = cutPart(
      triangles,
      edges ?? [],
      planes.map((plane) => plane.clone().applyMatrix4(toLocal)),
    )
    held.set(surface, { key, part })
    return part
  }
}

/** The part's triangles, nine floats each, and the region each is in. */
const trianglesOf = (
  geometry: BufferGeometry,
  model: PartModel,
): { positions: ArrayLike<number>; regionOf: Int32Array } => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  const positions = flat.getAttribute('position').array
  const regionOf = new Int32Array(Math.floor(positions.length / 9)).fill(-1)
  for (const { idx, triangles } of model.regions) regionOf.fill(idx, triangles.start, triangles.end)
  return { positions, regionOf }
}

/** Each plane's face, trimmed by the others; the part's edges, trimmed by all, with the faces' outlines. */
const cutPart = (
  { positions, regionOf }: { positions: ArrayLike<number>; regionOf: Int32Array },
  edges: ArrayLike<number>,
  planes: readonly Plane[],
): CutPart => {
  const faces = planes.map((plane, index) => ({
    plane,
    contour: planes.reduce(
      (outline, other, at) => (at === index ? outline : clipSegments(outline, other)),
      sectionContour(positions, regionOf, plane),
    ),
  }))
  const kept = planes.reduce<ArrayLike<number>>((left, plane) => clipSegments(left, plane), edges)
  const all = [...Array.from(kept), ...faces.flatMap((face) => Array.from(face.contour))]
  return { snaps: edgeSnaps(all), faces }
}

const clippingPlanesOf = (surface: Mesh): readonly Plane[] => {
  const materials = Array.isArray(surface.material) ? surface.material : [surface.material]
  return materials[0]?.clippingPlanes ?? []
}

/** What `underPointer` needs of the part. */
export interface PartAt {
  model: PartModel
  surfaceFor: SurfaceFor
  holes: HoleIndex
  /** The part's edges whole, for when nothing cuts it. */
  snaps: EdgeSnaps | null
  cut: CutSampler
  surfaces: readonly Mesh[]
  raycaster: Raycaster
}

/** With Alt: how far each kind of snap reaches, and the edge line the pointer last had (`edgesNear`). */
export interface AltSnap {
  reach: SnapReach
  heldLine: number | null
}

/** What is under the pointer, and the edge line an Alt point is on, to hold it the next time. */
export interface Found {
  under: Under
  line: number | null
}

/**
 * What is under the pointer: the face of the part its ray first meets, past
 * anything a section cut has taken away, and, with Alt, where a point snaps
 * (`snapNear`). Null where the ray misses the part and nothing snaps. A face
 * a cut made is no face of the part's: where the ray meets one first, the
 * pointer is on the part but on no face, and the face behind it is not offered.
 */
export const underPointer = (part: PartAt, screen: ScreenAt, alt: AltSnap | null): Found | null => {
  const { surfaces, raycaster } = part
  raycaster.setFromCamera(toDevice(screen.pointer, screen.viewport), screen.camera)
  const hit = firstHit(raycaster, surfaces)
  const cap = cutFaceHit(raycaster.ray, part)
  const onCap = cap !== null && (!hit || cap.distance < hit.distance)
  const on = hit && !onCap ? faceAt(hit, part) : null
  const landing = onCap ? cap : hit && { point: hit.point, surface: hit.object as Mesh }
  const near = alt ? snapNear(part, screen, alt, landing) : null
  const snap = near?.snap ?? null
  return on || snap || onCap ? { under: { on, snap }, line: near?.line ?? null } : null
}

/** The first face a ray meets that a section cut has not taken away. */
const firstHit = (raycaster: Raycaster, surfaces: readonly Mesh[]): Intersection | undefined =>
  raycaster
    .intersectObjects([...surfaces], false)
    .find(
      ({ object, face, faceIndex, point }) =>
        face && faceIndex != null && !clippedAway(object as Mesh, point),
    )

/** A point on a face a cut made, the surface it cuts, and how far along the ray it is. */
interface CutFaceHit {
  point: Vector3
  surface: Mesh
  distance: number
}

/** How far, mm, a point may sit on the removed side of a plane and still be on it. */
const ON_PLANE = 1e-7

/**
 * Where a ray first meets a face a cut made. Where two planes cut, a point
 * on one's face must be on the other's kept side too, or it is a face in the air.
 */
const cutFaceHit = (ray: Ray, { surfaces, cut }: PartAt): CutFaceHit | null => {
  let nearest: CutFaceHit | null = null
  for (const surface of surfaces) {
    const faces = cut(surface)?.faces ?? []
    const local = ray.clone().applyMatrix4(new Matrix4().copy(surface.matrixWorld).invert())
    for (const face of faces) {
      const point = capHit(local, face.plane, face.contour)
      const kept = (other: CutFace): boolean =>
        other === face || (point !== null && other.plane.distanceToPoint(point) >= -ON_PLANE)
      if (!point || !faces.every(kept)) continue
      point.applyMatrix4(surface.matrixWorld)
      const distance = point.distanceTo(ray.origin)
      if (!nearest || distance < nearest.distance) nearest = { point, surface, distance }
    }
  }
  return nearest
}

/** The face a ray hit, as the tool measures it: a hole's face stands for its whole hole. */
const faceAt = (hit: Intersection, { model, surfaceFor, holes }: PartAt): OnFace | null => {
  const found = hit.faceIndex == null ? null : model.regionIndex.regionForTriangle(hit.faceIndex)
  if (found === null) return null
  const region = holes.faceOf(found)
  return { face: { kind: 'face', region, point: asPoint(hit.point) }, surface: surfaceFor(region) }
}

/** Where the pointer's ray lands on the part: on a face of its own, or on a face a cut made. */
interface Landing {
  point: Vector3
  surface: Mesh
}

/** How many of the edges in reach are looked past for one the camera can see: each look is a ray. */
const EDGES_TRIED = 4

/**
 * Where an Alt point snaps. A corner or a straight edge's middle within
 * reach comes first, on the part or just off its outline, if the camera can
 * see it (`canSee`): every one in reach is tried, nearest first, as the
 * nearest may be round the back. Then the nearest point on an edge within
 * reach, the edge whole (`edgesNear`). Then the face under the pointer.
 * On a cut part, the edges are those the cut left, with its faces' outlines.
 */
const snapNear = (
  part: PartAt,
  screen: ScreenAt,
  { reach, heldLine }: AltSnap,
  landing: Landing | null | undefined,
): { snap: Snapped; line: number | null } | null => {
  const { surfaces, raycaster } = part
  const surface = landing?.surface ?? surfaces[0]
  const onFace = landing ? { snap: faceSnap(landing.point), line: null } : null
  const snaps = surface ? (part.cut(surface)?.snaps ?? part.snaps) : null
  if (!snaps || !surface) return onFace
  // Taken before `canSee` aims the raycaster elsewhere.
  const ray = raycaster.ray.clone()
  const visible = (point: Vector3): boolean => canSee(point, part, screen.camera, surface)
  const corner = cornersNear(snaps.corners, surface.matrixWorld, screen, reach).find((each) =>
    visible(each.point),
  )
  if (corner) {
    const edge = corner.edge ? corner.edge.map(asPoint) : null
    return { snap: { kind: corner.kind, point: asPoint(corner.point), edge }, line: null }
  }
  const edge = edgesNear(snaps.lines, surface.matrixWorld, ray, screen, reach.edge, heldLine)
    .slice(0, EDGES_TRIED)
    .find((each) => visible(each.point))
  if (!edge) return onFace
  const line = worldLine(snaps, edge.line, surface)
  return { snap: { kind: 'edge', point: asPoint(edge.point), edge: line }, line: edge.line }
}

const worldLine = (snaps: EdgeSnaps, line: number, surface: Mesh): readonly Point[] => {
  const known = snaps.worldLines.get(line)
  if (known) return known
  const points = (snaps.lines.lines[line] ?? []).map((point) =>
    asPoint(point.clone().applyMatrix4(surface.matrixWorld)),
  )
  snaps.worldLines.set(line, points)
  return points
}

const faceSnap = (point: Vector3): Snapped => ({ kind: 'face', point: asPoint(point), edge: null })

/** How much nearer than a point, as a share of how far off it is, the part may be and still not hide it. */
const SEE_SLACK = 1e-3

/**
 * Whether the camera can see a point on the part: nothing of the part, nor a
 * face a cut made, stands nearer along the ray to it, and no section cut has
 * taken it away. A corner round the back of the part, behind a wall, or under
 * a cut face, is not offered.
 *
 * The ray is aimed at the point itself, not at its pixel: a ray through the
 * pixel misses a corner by a hair, and where a face meets it edge on, that
 * hair lands well in front of the corner, which then hid and showed by turns.
 */
const canSee = (point: Vector3, part: PartAt, camera: ViewerCamera, surface: Mesh): boolean => {
  const { raycaster, surfaces } = part
  if (clippedAway(surface, point)) return false
  const along = aimRayAt(raycaster, point, camera)
  const first = firstHit(raycaster, surfaces)?.distance ?? Infinity
  const cap = cutFaceHit(raycaster.ray, part)?.distance ?? Infinity
  // A hair's room, as the point is on the part and its own faces meet the ray there.
  return Math.min(first, cap) >= along - Math.max(along * SEE_SLACK, SEE_SLACK)
}

/** Aims the ray from the camera straight at `point`, and says how far along it the point is. */
const aimRayAt = (raycaster: Raycaster, point: Vector3, camera: ViewerCamera): number => {
  const { ray } = raycaster
  const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld)
  if ('isPerspectiveCamera' in camera && camera.isPerspectiveCamera) {
    ray.origin.copy(eye)
    ray.direction.subVectors(point, eye).normalize()
  } else {
    // Square to the view: from where the point's pixel is on the camera's plane.
    ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld)
    const along = new Vector3().subVectors(point, eye).dot(ray.direction)
    ray.origin.copy(point).addScaledVector(ray.direction, -along)
  }
  return ray.origin.distanceTo(point)
}

/** Whether a point is on the part of the mesh a section cut has taken away, and so not on screen. */
const clippedAway = (surface: Mesh, point: Vector3): boolean => {
  const materials = Array.isArray(surface.material) ? surface.material : [surface.material]
  return materials.some((material) =>
    (material.clippingPlanes ?? []).some((plane) => plane.distanceToPoint(point) < 0),
  )
}

/** CSS pixels on the canvas as the -1..1 coordinates a ray is cast from. */
const toDevice = ({ x, y }: ScreenAt['pointer'], viewport: ViewportSize): Vector2 =>
  new Vector2((x / viewport.width) * 2 - 1, 1 - (y / viewport.height) * 2)

const asPoint = ({ x, y, z }: Vector3): Point => [x, y, z]

/** Where a point on the part is on the canvas, CSS pixels from its top left. */
export const onCanvas = (point: Point, camera: ViewerCamera, viewport: ViewportSize): Vector2 =>
  screenPoint(camera, toVector(point), viewport)

/** The part's bounding sphere in world space, for how big it is on screen. */
export const partSphere = (geometry: BufferGeometry, surfaces: readonly Mesh[]): Sphere => {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  const sphere = (geometry.boundingSphere ?? new Sphere()).clone()
  const [surface] = surfaces
  return surface ? sphere.applyMatrix4(surface.matrixWorld) : sphere
}
