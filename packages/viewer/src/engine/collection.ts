import type { BufferGeometry } from 'three'
import type { PartModel } from '../model/types.js'
import { createEngineGeometryCache, type EngineGeometryResource } from './geometry-cache.js'
import { loadPartMesh, type LoadPartGeometryOptions } from './geometry.js'
import { toError } from './guards.js'
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
  /**
   * Call with every item the scene shows, after it has rendered them. Meshes shown before and
   * missing now are freed; meshes a load returned that have not been shown yet are held for it.
   */
  keep(items: ReadonlyArray<LoadedCollectionItem>): void
  /**
   * Frees the mesh of an item a load returned that will never be shown, such as a result for a
   * model replaced while it loaded. Does nothing for a mesh the scene has shown.
   */
  discard(item: LoadedCollectionItem): void
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
  // Every mesh a load has returned, with whether the scene has shown it. One cache reference
  // each, however many results returned it: what frees a mesh is the scene no longer showing it.
  const held = new Map<BufferGeometry, { resource: EngineGeometryResource; shown: boolean }>()
  // Keeps nothing released: a mesh the scene stops showing is disposed at once.
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
  }, 0)
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
          // Held while this load waits, so a `keep` meanwhile cannot evict it.
          cache.retain(resource)
          try {
            await resource.promise
            controller.signal.throwIfAborted()
            if (resource.status === 'rejected') {
              throw resource.error
            }
            if (!resource.geometry) {
              throw new Error('The mesh loaded without geometry.')
            }
            if (held.has(resource.geometry)) {
              cache.release(resource)
            } else {
              held.set(resource.geometry, { resource, shown: false })
            }
            loaded.set(item.id, { ...item, geometry: resource.geometry })
          } catch (error) {
            cache.release(resource)
            controller.signal.throwIfAborted()
            failed.set(item.id, toError(error))
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
    keep(items) {
      const shown = new Set(items.map((item) => item.geometry))
      for (const [geometry, entry] of held) {
        if (shown.has(geometry)) {
          entry.shown = true
        } else if (entry.shown) {
          held.delete(geometry)
          cache.release(entry.resource)
        }
      }
    },
    discard(item) {
      const entry = held.get(item.geometry)
      if (entry && !entry.shown) {
        held.delete(item.geometry)
        cache.release(entry.resource)
      }
    },
    dispose() {
      options.signal?.removeEventListener('abort', abort)
      controller.abort()
      held.clear()
      cache.clear()
    },
  }
}
