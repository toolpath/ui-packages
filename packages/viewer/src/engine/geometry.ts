import { type BufferGeometry, Matrix4, Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { PartMeshRefs } from '../model/types.js'
import { toError } from './guards.js'

/**
 * A mesh that cannot be paired with its report.
 *
 * Every case is a contract mismatch caught at load, which is the whole point:
 * the alternative is a report and a mesh that disagree about which triangle is
 * which, and that surfaces as *the wrong surface highlighting* — a shader bug
 * to anyone debugging it, hours from its cause.
 */
export class PartMeshError extends Error {
  override readonly name = 'PartMeshError'
}

/** What the report says the mesh contains. Checked, never trusted. */
export type PartMeshExpectation = Pick<PartMeshRefs, 'pointCount' | 'triangleCount'>

export type MeshFormat = 'glb' | 'stl'

export interface MeshAsset {
  format: MeshFormat
  url: string
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>

export interface LoadPartGeometryOptions {
  /** Inject to route through a backend, or to serve a fixture in a test. */
  readonly fetch?: FetchLike
  readonly signal?: AbortSignal
}

const IDENTITY = new Matrix4()

/** The mesh artifacts to try, in order: GLB first, STL as a fallback. */
export function partMeshAssets(mesh: Pick<PartMeshRefs, 'glbUrl' | 'stlUrl'>): MeshAsset[] {
  const assets: MeshAsset[] = []
  if (mesh.glbUrl) assets.push({ format: 'glb', url: mesh.glbUrl })
  if (mesh.stlUrl) assets.push({ format: 'stl', url: mesh.stlUrl })
  return assets
}

/**
 * Fetches a part's mesh and prepares it for rendering and picking.
 *
 * The URL is passed separately rather than read off `PartMeshRefs` because it
 * is the one field that goes stale: presigns live fifteen minutes, so the
 * caller decides what to fetch and when.
 */
export async function loadPartGeometry(
  url: string,
  mesh: PartMeshExpectation,
  options: LoadPartGeometryOptions & { format?: MeshFormat } = {},
): Promise<BufferGeometry> {
  const request = options.fetch ?? globalThis.fetch
  const response = await request(url, options.signal ? { signal: options.signal } : undefined)

  if (!response.ok) {
    // An expired presign lands here as a 403 with an XML body, which is by far
    // the likeliest failure in practice — hence naming the status.
    throw new PartMeshError(
      `Fetching the part mesh failed with ${response.status} ${response.statusText}. ` +
        `A presigned mesh URL expires 15 minutes after the report that carried it.`,
    )
  }

  return parsePartGeometry(await response.arrayBuffer(), mesh, options.format ?? 'glb')
}

/**
 * Loads whichever mesh artifact a report actually carries, preferring GLB.
 *
 * The STL fallback is not redundancy for its own sake: a report can carry one
 * URL and not the other, and an STL still satisfies the triangle-order contract
 * the region ranges depend on. Every attempt's failure is kept, because "the
 * GLB 403'd and the STL was not a mesh" is two different problems and a caller
 * shown only the second would chase the wrong one.
 */
export async function loadPartMesh(
  mesh: PartMeshRefs,
  options: LoadPartGeometryOptions = {},
): Promise<BufferGeometry> {
  const assets = partMeshAssets(mesh)
  if (assets.length === 0) {
    throw new PartMeshError('The report carries neither a GLB nor an STL mesh URL.')
  }

  const failures: Error[] = []
  for (const asset of assets) {
    try {
      return await loadPartGeometry(asset.url, mesh, { ...options, format: asset.format })
    } catch (error) {
      failures.push(toError(error))
    }
  }
  throw new AggregateError(failures, 'Could not load the part mesh.')
}

/**
 * Parses a mesh into the geometry the renderer and the region index share.
 *
 * Three things happen here, and each one is load-bearing:
 *
 * - **De-index, always.** The Engine writes an indexed GLB with shared vertices
 *   (the cube: 8 vertices, 36 indices). The region highlight is a *per-vertex*
 *   attribute, and a shared corner vertex belongs to three regions at once, so
 *   there is no value to write into it. Non-indexed is not an optimization
 *   here, it is what makes region attributes expressible.
 * - **Compute normals, if the mesh ships none.** The GLB currently ships
 *   `POSITION` only. Doing this *after* de-indexing is what gives faceted CAD
 *   shading; the other order smooth-shades a cube, which reads as a rendering
 *   bug rather than the data-handling one it is.
 * - **Check the counts.** The report's region ranges index this triangle
 *   buffer. If the two disagree about how many triangles there are, they are
 *   not the same artifact and nothing downstream can be trusted.
 *
 * Coordinates are passed through untouched: the Engine emits millimetres, Z-up,
 * usually with a corner at the origin, and `GLTFLoader` does not rotate a scene
 * to the glTF Y-up convention. Centring and framing are the camera's business,
 * not the loader's — region geometry is quoted in part space, so part space is
 * what gets rendered.
 *
 * `toNonIndexed()` renumbers nothing at the triangle level: it walks the index
 * buffer in order, three vertices at a time, so triangle `i` stays triangle
 * `i`. That is what makes it safe to apply before region ranges, and it is
 * asserted against the real cube in `geometry.test.ts` because it looks
 * dangerous and is not.
 */
export async function parsePartGeometry(
  data: ArrayBuffer,
  mesh: PartMeshExpectation,
  format: MeshFormat = 'glb',
): Promise<BufferGeometry> {
  if (format === 'stl') return parseStl(data, mesh)

  const loader = new GLTFLoader()

  let scene: Object3D
  try {
    ;({ scene } = await loader.parseAsync(data, ''))
  } catch (cause) {
    throw new PartMeshError('The part mesh is not a readable GLB.', { cause })
  }

  const source = singleMesh(scene)
  const geometry = source.geometry

  assertCounts(geometry, mesh)

  // The Engine emits a single node with no transform, so this is normally a
  // no-op — but a transform that silently went unapplied would misplace the
  // whole part, and checking costs one matrix comparison.
  source.updateWorldMatrix(true, false)
  if (!source.matrixWorld.equals(IDENTITY)) {
    geometry.applyMatrix4(source.matrixWorld)
  }

  const prepared = geometry.index ? geometry.toNonIndexed() : geometry
  if (prepared !== geometry) geometry.dispose()

  if (!prepared.hasAttribute('normal')) prepared.computeVertexNormals()

  disposeMaterials(scene)

  return prepared
}

function parseStl(data: ArrayBuffer, mesh: PartMeshExpectation): BufferGeometry {
  let geometry: BufferGeometry
  try {
    geometry = new STLLoader().parse(data)
  } catch (cause) {
    throw new PartMeshError('The part mesh is not a readable STL.', { cause })
  }

  // An STL is a triangle soup already — no index, three vertices per facet —
  // so the only preparation it needs is the same agreement check.
  assertCounts(geometry, mesh)
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()

  return geometry
}

/**
 * The mesh holds one primitive, and the region table describes that one
 * triangle buffer. More than one mesh would mean the ordering contract has no
 * single subject, so it fails rather than guessing at an order.
 */
function singleMesh(scene: Object3D): Mesh {
  const meshes: Mesh[] = []
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object)
  })

  const [mesh] = meshes
  if (mesh === undefined || meshes.length !== 1) {
    throw new PartMeshError(
      `The part mesh must be a single triangle mesh; this GLB has ${meshes.length}. ` +
        `Region triangle ranges index one buffer, so there is no order to apply them in.`,
    )
  }

  return mesh
}

function assertCounts(geometry: BufferGeometry, expected: PartMeshExpectation): void {
  const position = geometry.getAttribute('position')
  if (position === undefined) {
    throw new PartMeshError('The part mesh has no POSITION attribute.')
  }

  const indices = geometry.index?.count ?? position.count
  if (indices % 3 !== 0) {
    throw new PartMeshError(
      `The part mesh has ${indices} vertex indices, which is not a whole number of triangles.`,
    )
  }

  const triangleCount = indices / 3
  if (triangleCount !== expected.triangleCount) {
    throw new PartMeshError(
      `The report describes ${expected.triangleCount} triangles but the mesh has ${triangleCount}. ` +
        `Region ranges index the mesh directly, so the two must be the same artifact.`,
    )
  }

  // An indexed mesh should carry exactly the reported points; a non-indexed one
  // legitimately carries three per triangle instead. Anything else means the
  // report and the mesh describe different geometry.
  const points = geometry.index ? expected.pointCount : triangleCount * 3
  if (position.count !== points) {
    throw new PartMeshError(
      `The report describes ${expected.pointCount} points but the mesh has ${position.count}.`,
    )
  }
}

/**
 * `parsePartGeometry` returns geometry and nothing else, so the materials the
 * loader invented on the way — the part gets its own when it is rendered — are
 * the loader's to clean up.
 */
function disposeMaterials(scene: Object3D): void {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return

    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.dispose()
    }
  })
}
