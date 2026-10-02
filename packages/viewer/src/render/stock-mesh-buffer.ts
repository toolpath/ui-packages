import type { BufferGeometry } from 'three'

/** Own decoded meshes until their replacement has committed, including cancelled/late decodes. */
export function createStockMeshBuffer() {
  const owned = new Set<BufferGeometry>()
  let disposed = false
  return {
    request(
      decode: () => Promise<BufferGeometry[]>,
      ready: (geometries: BufferGeometry[]) => void,
      failed: (cause: unknown) => void,
    ) {
      // React StrictMode replays setup after cleanup on the same component instance.
      disposed = false
      let active = true
      void decode().then(
        (geometries) => {
          if (!active || disposed) {
            geometries.forEach((geometry) => geometry.dispose())
            return
          }
          geometries.forEach((geometry) => owned.add(geometry))
          ready(geometries)
        },
        (cause: unknown) => {
          if (active && !disposed) {
            failed(cause)
          }
        },
      )
      return () => {
        active = false
      }
    },
    commit(geometries: BufferGeometry[]) {
      const visible = new Set(geometries)
      for (const geometry of owned) {
        if (!visible.has(geometry)) {
          owned.delete(geometry)
          geometry.dispose()
        }
      }
    },
    dispose() {
      disposed = true
      owned.forEach((geometry) => geometry.dispose())
      owned.clear()
    },
  }
}
