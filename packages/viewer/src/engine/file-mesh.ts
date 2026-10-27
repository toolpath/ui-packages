import { type BufferGeometry, Matrix4, Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { PartModel } from '../model/types.js'
import { displayMeshModel } from './display-mesh.js'
import { type LoadPartGeometryOptions, PartMeshError } from './geometry.js'

/** A body of a file as the file's mesh draws it. */
export interface FileMeshBody {
  /** The body's `index` among the file's `bodies`. */
  index: number
  /**
   * A model with no features, and the body as one region: the file's mesh has
   * no faces, so the body is picked and hovered as one and drawn without edges.
   */
  model: PartModel
  geometry: BufferGeometry
}

/** The node the Engine writes for body `index`: `body-<index>`. */
const BODY_NODE = /^body-(\d+)$/

const IDENTITY = new Matrix4()

/**
 * Fetches a file's mesh, the `meshGlbUrl` of **Get file mesh**
 * (`GET /v1/files/{id}/mesh`), and splits it into its bodies. The URL expires
 * 15 minutes after the response that carried it.
 */
export const loadFileMesh = async (
  url: string,
  options: LoadPartGeometryOptions = {},
): Promise<Map<number, FileMeshBody>> => {
  const request = options.fetch ?? globalThis.fetch
  const response = await request(url, options.signal ? { signal: options.signal } : undefined)
  if (!response.ok) {
    throw new PartMeshError(
      `Fetching the file mesh failed with ${response.status} ${response.statusText}. ` +
        `A presigned mesh URL expires 15 minutes after Get file mesh returned it.`,
    )
  }
  const bodies = await parseFileMesh(await response.arrayBuffer())
  if (options.signal?.aborted) {
    disposeFileMesh(bodies)
    options.signal.throwIfAborted()
  }
  return bodies
}

/**
 * Splits a file's mesh into its bodies, by index: node `body-<index>` is the
 * file's `bodies[index]`. A body the Engine could not facet is left out of the
 * mesh, so check for each body before drawing it. Each body is in the file's
 * coordinates, as its part's display mesh is, and prepared as
 * `parsePartGeometry` prepares a part's: one triangle per three vertices,
 * faceted normals.
 */
export const parseFileMesh = async (glb: ArrayBuffer): Promise<Map<number, FileMeshBody>> => {
  let scene: Object3D
  try {
    ;({ scene } = await new GLTFLoader().parseAsync(glb, ''))
  } catch (cause) {
    throw new PartMeshError('The file mesh is not a readable GLB.', { cause })
  }
  scene.updateMatrixWorld(true)

  const bodies = new Map<number, FileMeshBody>()
  try {
    for (const [index, source] of bodyMeshes(scene)) {
      bodies.set(index, prepareBody(index, source))
    }
  } catch (error) {
    disposeFileMesh(bodies)
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose()
      }
    })
    throw error
  } finally {
    disposeMaterials(scene)
  }
  return bodies
}

/** Frees every body's geometry. Call once nothing draws them. */
export const disposeFileMesh = (bodies: ReadonlyMap<number, FileMeshBody>): void => {
  for (const { geometry } of bodies.values()) {
    geometry.dispose()
  }
}

/** Each body's one mesh, by index, in index order. */
const bodyMeshes = (scene: Object3D): Array<[number, Mesh]> => {
  const found = new Map<number, Array<Mesh>>()
  scene.traverse((node) => {
    const match = BODY_NODE.exec(node.name)
    if (!match) {
      return
    }
    const meshes = found.get(Number(match[1])) ?? []
    node.traverse((child) => {
      if (child instanceof Mesh) {
        meshes.push(child)
      }
    })
    found.set(Number(match[1]), meshes)
  })
  if (found.size === 0) {
    throw new PartMeshError('The file mesh has no `body-<index>` nodes.')
  }
  return [...found]
    .sort(([a], [b]) => a - b)
    .map(([index, meshes]) => {
      if (meshes.length !== 1) {
        throw new PartMeshError(
          `The file mesh must draw body ${index} as one triangle mesh; it has ${meshes.length}.`,
        )
      }
      return [index, meshes[0]!]
    })
}

const prepareBody = (index: number, source: Mesh): FileMeshBody => {
  const geometry = source.geometry
  const position = geometry.getAttribute('position')
  if (position === undefined) {
    throw new PartMeshError(`Body ${index} of the file mesh has no POSITION attribute.`)
  }
  const pointCount = position.count
  const indices = geometry.index?.count ?? pointCount
  if (indices % 3 !== 0) {
    throw new PartMeshError(
      `Body ${index} of the file mesh has ${indices} vertex indices, which is not a whole number of triangles.`,
    )
  }
  // The Engine writes no transforms, but one left unapplied would misplace the body.
  if (!source.matrixWorld.equals(IDENTITY)) {
    geometry.applyMatrix4(source.matrixWorld)
  }
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry
  if (prepared !== geometry) {
    geometry.dispose()
  }
  if (!prepared.hasAttribute('normal')) {
    prepared.computeVertexNormals()
  }
  return {
    index,
    model: displayMeshModel({ meshPointCount: pointCount, meshTriangleCount: indices / 3 }),
    geometry: prepared,
  }
}

const disposeMaterials = (scene: Object3D): void => {
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.dispose()
      }
    }
  })
}
