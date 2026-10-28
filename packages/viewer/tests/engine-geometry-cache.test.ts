import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createEngineGeometryCache } from '../src/engine/geometry-cache.js'

const part = (id: string, query = '') => ({
  mesh: {
    pointCount: 8,
    triangleCount: 12,
    glbUrl: `https://example.test/${id}.glb${query}`,
    stlUrl: null,
    thumbnailUrl: null,
  },
  regions: [],
})

describe('Engine geometry cache', () => {
  it('keeps a download failure available when Suspense reads the resource again', async () => {
    const failure = new Error('HTTP 403')
    const loader = vi.fn(async () => {
      throw failure
    })
    const cache = createEngineGeometryCache(loader)
    const report = part('failed')
    const pending = cache.get(report)
    await pending.promise

    const settled = cache.get(report)
    expect(settled.status).toBe('rejected')
    expect(settled.error).toBe(failure)
    expect(settled).toBe(pending)
    expect(loader).toHaveBeenCalledOnce()
  })

  it('retains rendered geometry and disposes the least-recent released entry at capacity', async () => {
    const loader = vi.fn(async () => new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader, 1)
    const first = cache.get(part('first'))
    await first.promise
    const dispose = vi.fn()
    first.geometry!.addEventListener('dispose', dispose)
    cache.retain(first)
    cache.release(first)

    const second = cache.get(part('second'))
    await second.promise
    cache.retain(second)
    cache.release(second)

    expect(dispose).toHaveBeenCalledOnce()
  })

  it('disposes a closed part at capacity as soon as the next part opens', async () => {
    const loader = vi.fn(async () => new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader, 1)
    const closed = cache.get(part('closed'))
    await closed.promise
    const dispose = vi.fn()
    closed.geometry!.addEventListener('dispose', dispose)
    cache.retain(closed)
    cache.release(closed)

    const open = cache.get(part('open'))
    await open.promise
    cache.retain(open)

    expect(dispose).toHaveBeenCalledOnce()
  })

  it('keeps geometry read for a part that has not retained it yet when another opens', async () => {
    const loader = vi.fn(async () => new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader, 1)
    const closed = cache.get(part('closed'))
    await closed.promise
    cache.retain(closed)
    cache.release(closed)

    // Two parts mounting in one commit: both read during the render, then
    // retained one effect at a time.
    const first = cache.get(part('first'))
    const second = cache.get(part('second'))
    await Promise.all([first.promise, second.promise])
    const dispose = vi.fn()
    second.geometry!.addEventListener('dispose', dispose)
    cache.retain(first)

    expect(dispose).not.toHaveBeenCalled()
    expect(cache.get(part('second'))).toBe(second)
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('keeps geometry a part let go and another part read again when a third opens', async () => {
    const loader = vi.fn(async () => new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader, 1)
    const closed = cache.get(part('closed'))
    await closed.promise
    const dispose = vi.fn()
    closed.geometry!.addEventListener('dispose', dispose)
    cache.retain(closed)
    cache.release(closed)

    // Two parts mounting in one commit: one reads the closed geometry again,
    // the other reads new geometry and retains first.
    const again = cache.get(part('closed'))
    const fresh = cache.get(part('new'))
    await fresh.promise
    cache.retain(fresh)

    expect(again).toBe(closed)
    expect(dispose).not.toHaveBeenCalled()
    cache.retain(again)
    expect(cache.get(part('closed'))).toBe(closed)
    expect(loader).toHaveBeenCalledTimes(2)

    // Letting it go is what disposes it.
    cache.release(again)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('disposes geometry that was evicted before its part retained it once the part lets go', async () => {
    const loader = vi.fn(async () => new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader, 1)
    const held = cache.get(part('held'))
    await held.promise
    cache.retain(held)

    // Read during a render, not retained yet; the other part's cleanup runs first.
    const late = cache.get(part('late'))
    await late.promise
    const dispose = vi.fn()
    late.geometry!.addEventListener('dispose', dispose)
    cache.release(held)
    expect(dispose).toHaveBeenCalledOnce()

    cache.retain(late)
    cache.release(late)
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it('keys on the artifact path, so a re-presigned URL is still a hit', async () => {
    const loader = vi.fn(async () => new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)

    // The same mesh, presigned twice: different signature, same artifact.
    const first = cache.get(part('part', '?X-Amz-Signature=aaa'))
    await first.promise
    const second = cache.get(part('part', '?X-Amz-Signature=bbb'))
    await second.promise

    expect(second).toBe(first)
    expect(loader).toHaveBeenCalledOnce()
  })

  it('retries a failed artifact with fresh signed URLs', async () => {
    const loader = vi
      .fn<() => Promise<THREE.BufferGeometry>>()
      .mockRejectedValueOnce(new Error('expired URL'))
      .mockResolvedValueOnce(new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)
    const failed = cache.get(part('retry', '?signature=expired'))
    await failed.promise

    const retried = cache.get(part('retry', '?signature=renewed'))
    await retried.promise
    expect(retried.status).toBe('fulfilled')
    expect(loader).toHaveBeenCalledTimes(2)
    expect(cache.get(part('retry', '?signature=expired'))).toBe(retried)
  })

  it('keeps separate failed signatures stable when two consumers read the same artifact', async () => {
    const loader = vi.fn(async () => {
      throw new Error('HTTP 403')
    })
    const cache = createEngineGeometryCache(loader)
    const firstReport = part('shared', '?signature=first')
    const secondReport = part('shared', '?signature=second')
    const first = cache.get(firstReport)
    await first.promise
    const second = cache.get(secondReport)
    await second.promise

    for (let read = 0; read < 5; read++) {
      expect(cache.get(firstReport)).toBe(first)
      expect(cache.get(secondReport)).toBe(second)
    }
    expect(first.status).toBe('rejected')
    expect(second.status).toBe('rejected')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('allows an explicit cache clear to retry the same URLs', async () => {
    const loader = vi
      .fn<() => Promise<THREE.BufferGeometry>>()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce(new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)
    const report = part('retry')
    const failed = cache.get(report)
    await failed.promise

    cache.clear()
    const retried = cache.get(report)
    await retried.promise
    expect(retried.status).toBe('fulfilled')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('preserves a shared pending failure for every report that requested the same URLs', async () => {
    const loader = vi.fn(async () => {
      throw new Error('HTTP 403')
    })
    const cache = createEngineGeometryCache(loader)
    const firstReport = part('shared')
    const secondReport = part('shared')
    const first = cache.get(firstReport)
    expect(cache.get(secondReport)).toBe(first)
    await first.promise

    expect(cache.get(firstReport)).toBe(first)
    expect(cache.get(secondReport)).toBe(first)
    expect(first.status).toBe('rejected')
    expect(loader).toHaveBeenCalledOnce()
  })

  it('does not latch an old signature failure onto a report waiting with fresh URLs', async () => {
    const loader = vi
      .fn<() => Promise<THREE.BufferGeometry>>()
      .mockRejectedValueOnce(new Error('HTTP 403'))
      .mockResolvedValueOnce(new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)
    const expired = part('shared', '?signature=expired')
    const renewed = part('shared', '?signature=renewed')
    const pending = cache.get(expired)
    expect(cache.get(renewed)).toBe(pending)
    await pending.promise

    expect(cache.get(expired)).toBe(pending)
    const retried = cache.get(renewed)
    await retried.promise
    expect(retried.status).toBe('fulfilled')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('allows a new report to retry the same URLs without retaining a global failure key', async () => {
    const loader = vi
      .fn<() => Promise<THREE.BufferGeometry>>()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce(new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)
    const failed = cache.get(part('retry'))
    await failed.promise

    const retried = cache.get(part('retry'))
    await retried.promise
    expect(retried.status).toBe('fulfilled')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('retries when a report receives updated mesh URLs', async () => {
    const loader = vi
      .fn<() => Promise<THREE.BufferGeometry>>()
      .mockRejectedValueOnce(new Error('HTTP 403'))
      .mockResolvedValueOnce(new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)
    const report = part('retry', '?signature=expired')
    await cache.get(report).promise

    report.mesh.glbUrl = 'https://example.test/retry.glb?signature=renewed'
    const retried = cache.get(report)
    await retried.promise
    expect(retried.status).toBe('fulfilled')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('does not restore a pending failure after the cache has been cleared', async () => {
    let reject: (error: Error) => void = () => {}
    const loader = vi
      .fn<() => Promise<THREE.BufferGeometry>>()
      .mockImplementationOnce(() => new Promise((_resolve, fail) => (reject = fail)))
      .mockResolvedValueOnce(new THREE.BufferGeometry())
    const cache = createEngineGeometryCache(loader)
    const report = part('retry')
    const pending = cache.get(report)
    cache.clear()
    reject(new Error('HTTP 403'))
    await pending.promise

    const retried = cache.get(report)
    await retried.promise
    expect(retried.status).toBe('fulfilled')
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
