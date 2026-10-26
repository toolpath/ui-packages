import type { BufferGeometry } from 'three'
import type { PartModel } from '../model/types.js'
import { createEngineGeometryCache, type EngineGeometryResource } from './geometry-cache.js'
import { loadPartMesh, type LoadPartGeometryOptions } from './geometry.js'
import { smoothRegionNormals } from './normals.js'

export interface CollectionModel {
  id: string
  model: PartModel
}

export interface LoadedCollectionItem extends CollectionModel {
  geometry: BufferGeometry
}

export interface CollectionLoadResult {
  items: Array<LoadedCollectionItem>
  failures: Array<{ id: string; error: Error }>
}

export interface PartCollectionLoader {
  /** Resolves after every requested item succeeds or fails; successful geometry survives retry. */
  load(items: ReadonlyArray<CollectionModel>): Promise<CollectionLoadResult>
  /** Release replaced items after the renderer has committed their replacements. */
  release(items: ReadonlyArray<LoadedCollectionItem>): void
  /** Aborts pending reads and disposes this session's geometry. Call after unmounting its meshes. */
  dispose(): void
}

export const createPartCollectionLoader = (
  options: LoadPartGeometryOptions & { concurrency?: number } = {},
): PartCollectionLoader => {
  const concurrency = options.concurrency ?? 3
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Collection concurrency must be a positive integer.')
  }
  const controller = new AbortController()
  const abort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) {
    abort()
  } else {
    options.signal?.addEventListener('abort', abort, { once: true })
  }
  const retained = new Set<EngineGeometryResource>()
  const cache = createEngineGeometryCache(async (part) => {
    const geometry = await loadPartMesh(part.mesh, {
      fetch: options.fetch,
      signal: controller.signal,
    })
    if (controller.signal.aborted) {
      geometry.dispose()
      controller.signal.throwIfAborted()
    }
    if (part.regions.length > 0) {
      smoothRegionNormals(geometry, part.regions)
    }
    return geometry
  })
  return {
    async load(items) {
      const ids = items.map((item) => item.id)
      if (new Set(ids).size !== ids.length) {
        throw new Error('Collection item ids must be unique.')
      }
      const loaded = new Map<string, LoadedCollectionItem>()
      const failed = new Map<string, Error>()
      let next = 0
      const work = async () => {
        while (next < items.length) {
          controller.signal.throwIfAborted()
          const item = items[next++]!
          // A new request object permits retrying a failed URL; fulfilled artifacts are reused.
          const resource = cache.get({ ...item.model })
          try {
            await resource.promise
            controller.signal.throwIfAborted()
            if (resource.status === 'rejected') {
              throw resource.error
            }
            if (!resource.geometry) {
              throw new Error('The mesh loaded without geometry.')
            }
            if (!retained.has(resource)) {
              retained.add(resource)
              cache.retain(resource)
            }
            loaded.set(item.id, { ...item, geometry: resource.geometry })
          } catch (error) {
            controller.signal.throwIfAborted()
            failed.set(item.id, error instanceof Error ? error : new Error(String(error)))
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, work))
      return {
        items: items.flatMap(({ id }) => loaded.get(id) ?? []),
        failures: items.flatMap(({ id }) =>
          failed.has(id) ? [{ id, error: failed.get(id)! }] : [],
        ),
      }
    },
    release(items) {
      const geometries = new Set(items.map((item) => item.geometry))
      for (const resource of retained) {
        if (resource.geometry && geometries.has(resource.geometry)) {
          retained.delete(resource)
          cache.release(resource)
        }
      }
    },
    dispose() {
      options.signal?.removeEventListener('abort', abort)
      controller.abort()
      for (const resource of retained) {
        cache.release(resource)
      }
      retained.clear()
      cache.clear()
    },
  }
}
