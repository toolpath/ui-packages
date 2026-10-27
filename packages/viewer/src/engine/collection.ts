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
  /**
   * Releases items a load returned, once each, after the renderer has committed their replacements.
   * A mesh that a later load also returned stays loaded until every item holding it is released.
   */
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
  // One reference per item handed out: a retry or replacement can return a mesh an earlier
  // result already holds, and releasing that earlier item must not free it.
  const held = new Map<BufferGeometry, { resource: EngineGeometryResource; count: number }>()
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
            const entry = held.get(resource.geometry)
            if (entry) {
              entry.count += 1
            } else {
              held.set(resource.geometry, { resource, count: 1 })
            }
            cache.retain(resource)
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
      for (const item of items) {
        const entry = held.get(item.geometry)
        if (!entry) {
          continue
        }
        entry.count -= 1
        if (entry.count === 0) {
          held.delete(item.geometry)
        }
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
