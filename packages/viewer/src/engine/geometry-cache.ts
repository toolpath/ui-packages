import type { BufferGeometry } from 'three'
import type { PartMeshRefs, PartModel } from '../model/types.js'
import { loadPartMesh } from './geometry.js'
import { smoothRegionNormals } from './normals.js'

/** What the cache needs of a part: the artifact to fetch, and how to shade it. */
export type CacheablePart = Pick<PartModel, 'mesh' | 'regions'>

export interface EngineGeometryResource {
  status: 'pending' | 'fulfilled' | 'rejected'
  promise: Promise<void>
  geometry?: BufferGeometry
  error?: Error
  references: number
  lastAccess: number
}

export interface EngineGeometryCache {
  get(part: CacheablePart): EngineGeometryResource
  retain(resource: EngineGeometryResource): void
  release(resource: EngineGeometryResource): void
  clear(): void
}

/**
 * The cache key.
 *
 * Deliberately not the presigned URL: those carry a signature and an expiry, so
 * two reports of the same part fetched a minute apart would miss every time.
 * The path is the artifact's identity and the query string is not.
 */
export function engineGeometryResourceKey(mesh: PartMeshRefs): string {
  return [mesh.glbUrl, mesh.stlUrl].map((url) => url?.split('?')[0] ?? '').join('|')
}

/**
 * A small reference-aware LRU cache for Engine mesh artifacts. Rendered parts
 * retain their source geometry; released entries are evicted and disposed once
 * the cache exceeds its capacity, as soon as a part is retained or released.
 * A memory-tight host (a phone) passes a `maximumEntries` of 1.
 */
export function createEngineGeometryCache(
  loadGeometry: (part: CacheablePart) => Promise<BufferGeometry> = async (part) => {
    const geometry = await loadPartMesh(part.mesh)
    // Shaded here rather than in the loader: the normals depend on the report's
    // region table, and the cached geometry is per report anyway.
    smoothRegionNormals(geometry, part.regions)
    return geometry
  },
  maximumEntries = 8,
): EngineGeometryCache {
  const resources = new Map<string, EngineGeometryResource>()
  const requests = new WeakMap<EngineGeometryResource, string>()
  let failures = new WeakMap<CacheablePart, EngineGeometryResource>()
  let accessSequence = 0
  const touch = (resource: EngineGeometryResource) => {
    resource.lastAccess = ++accessSequence
  }

  const evictReleasedResources = () => {
    while (resources.size > maximumEntries) {
      let oldest: [string, EngineGeometryResource] | undefined
      for (const entry of resources) {
        const [, resource] = entry
        if (
          resource.status !== 'fulfilled' ||
          resource.references > 0 ||
          (oldest && oldest[1].lastAccess <= resource.lastAccess)
        ) {
          continue
        }
        oldest = entry
      }
      if (!oldest) return
      resources.delete(oldest[0])
      oldest[1].geometry?.dispose()
    }
  }

  const rememberFailure = (
    part: CacheablePart,
    requestKey: string,
    resource: EngineGeometryResource,
  ) => {
    const attempts = failures
    void resource.promise.then(() => {
      if (resource.status === 'rejected' && requests.get(resource) === requestKey) {
        attempts.set(part, resource)
      }
    })
  }

  return {
    get(part) {
      const key = engineGeometryResourceKey(part.mesh)
      const existing = resources.get(key)
      if (existing?.status === 'fulfilled') {
        failures.delete(part)
        touch(existing)
        return existing
      }

      // A failed attempt belongs to its report, not an unbounded list of URLs.
      // Keep it stable across Suspense retries while allowing a fresh report/URL.
      const requestKey = JSON.stringify([part.mesh.glbUrl, part.mesh.stlUrl])
      const failed = failures.get(part)
      if (failed && requests.get(failed) === requestKey) {
        touch(failed)
        return failed
      }
      if (existing) {
        rememberFailure(part, requestKey, existing)
        touch(existing)
        return existing
      }

      const resource: EngineGeometryResource = {
        status: 'pending',
        promise: Promise.resolve(),
        references: 0,
        lastAccess: ++accessSequence,
      }
      requests.set(resource, requestKey)
      resource.promise = loadGeometry(part).then(
        (geometry) => {
          resource.status = 'fulfilled'
          resource.geometry = geometry
        },
        (error: unknown) => {
          resource.status = 'rejected'
          resource.error = error instanceof Error ? error : new Error(String(error))
          if (resources.get(key) === resource) resources.delete(key)
        },
      )
      resources.set(key, resource)
      rememberFailure(part, requestKey, resource)
      return resource
    },
    retain(resource) {
      resource.references += 1
      touch(resource)
      // A part opening is when a closed one's geometry is no longer worth
      // keeping: at a capacity of one, waiting for the next release would hold
      // a closed part's geometry for as long as the open one is on screen.
      evictReleasedResources()
    },
    release(resource) {
      resource.references = Math.max(0, resource.references - 1)
      touch(resource)
      evictReleasedResources()
    },
    clear() {
      for (const resource of resources.values()) resource.geometry?.dispose()
      resources.clear()
      failures = new WeakMap()
    },
  }
}

export const engineGeometryCache = createEngineGeometryCache()
