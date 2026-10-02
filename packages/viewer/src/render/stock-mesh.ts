import { type BufferGeometry, Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Decode caller-provided GLB bytes into stock geometry in part coordinates.
 * Internal to Stock: no fetching or caching. Stock owns the returned geometry
 * and disposes it when its input changes or it unmounts.
 */
export async function parseStockGlb(data: ArrayBuffer): Promise<BufferGeometry[]> {
  const { scene } = await new GLTFLoader().parseAsync(data, '')
  try {
    return stockMeshGeometries(scene)
  } finally {
    // This scene is private to the parser, not a shared loader-cache resource.
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.dispose()
      }
    })
  }
}

/** Prepare owned stock geometry without changing the loader's shared scene. */
export function stockMeshGeometries(scene: Object3D): BufferGeometry[] {
  const geometries: BufferGeometry[] = []
  scene.updateWorldMatrix(true, true)
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
    // Engine stock GLBs contain indexed positions and no normals. They need
    // lighting, but not the part report's per-region attributes or de-indexing.
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
    geometries.push(geometry)
  })
  if (geometries.length === 0) throw new Error('The stock GLB contains no mesh.')
  return geometries
}
