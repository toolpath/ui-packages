import { BoxGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { collectionBounds } from '../src/model/collection.js'
import { createPartCollectionLoader } from '../src/engine/collection.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

const models = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const model = cubeModel()
    return {
      id: String(index),
      model: {
        ...model,
        mesh: { ...model.mesh, glbUrl: `https://test/${index}.glb`, stlUrl: null },
      },
    }
  })
describe('complete collections', () => {
  it('combines off-origin geometry without changing its coordinates, and rejects ambiguous identities', () => {
    const first = new BoxGeometry(20, 10, 10).translate(100, 0, 0)
    const second = new BoxGeometry(20, 10, 10).translate(300, 0, 0)
    expect(
      collectionBounds([
        { id: 'a', geometry: first },
        { id: 'b', geometry: second },
      ]).min.x,
    ).toBe(90)
    expect(first.getAttribute('position').getX(0)).toBe(110)
    expect(() =>
      collectionBounds([
        { id: 'a', geometry: first },
        { id: 'a', geometry: second },
      ]),
    ).toThrow(/Duplicate/)
    first.dispose()
    second.dispose()
  })
  it('waits for every mesh, limits concurrent reads, and disposes retained geometry once', async () => {
    let active = 0
    let peak = 0
    const request = vi.fn(async () => {
      peak = Math.max(peak, ++active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return new Response(loadMeshFixture('local-0.3.0-cube'))
    })
    const loader = createPartCollectionLoader({ fetch: request, concurrency: 2 })
    const result = await loader.load(models(5))
    expect(result.items.map((item) => item.id)).toEqual(['0', '1', '2', '3', '4'])
    expect(result.failures).toEqual([])
    expect(peak).toBe(2)
    const disposed = vi.fn()
    result.items[0]!.geometry.addEventListener('dispose', disposed)
    loader.dispose()
    expect(disposed).toHaveBeenCalledTimes(1)
  })
  it('keeps successful geometry across failed-body retries', async () => {
    let broken = true
    const request = vi.fn(async (url: string) =>
      url.endsWith('/1.glb') && broken
        ? new Response(null, { status: 500 })
        : new Response(loadMeshFixture('local-0.3.0-cube')),
    )
    const loader = createPartCollectionLoader({ fetch: request })
    const first = await loader.load(models(2))
    expect(first.failures.map((failure) => failure.id)).toEqual(['1'])
    broken = false
    const again = await loader.load(models(2))
    expect(again.items[0]!.geometry).toBe(first.items[0]!.geometry)
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'https://test/0.glb',
      'https://test/1.glb',
      'https://test/1.glb',
    ])
    loader.dispose()
  })
  it('prepares a replacement model and geometry while preserving the visible artifact', async () => {
    const request = vi.fn(async () => new Response(loadMeshFixture('local-0.3.0-cube')))
    const loader = createPartCollectionLoader({ fetch: request })
    const [display] = models(1)
    const original = (await loader.load([display!])).items[0]!
    const disposed = vi.fn()
    original.geometry.addEventListener('dispose', disposed)
    const analysis = {
      ...display!,
      model: {
        ...display!.model,
        mesh: { ...display!.model.mesh, glbUrl: 'https://test/analysis.glb' },
      },
    }
    const replacement = (await loader.load([analysis])).items[0]!
    expect(replacement.model).toBe(analysis.model)
    expect(replacement.geometry).not.toBe(original.geometry)
    expect(disposed).not.toHaveBeenCalled()
    loader.release([original])
    expect(replacement.geometry.getAttribute('position').count).toBeGreaterThan(0)
    loader.dispose()
    expect(disposed).toHaveBeenCalledTimes(1)
  })
  it('aborts reads and stops starting pending items', async () => {
    const controller = new AbortController()
    const request = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          }),
        ),
    )
    const loader = createPartCollectionLoader({
      fetch: request,
      signal: controller.signal,
      concurrency: 1,
    })
    const pending = loader.load(models(3))
    controller.abort()
    await expect(pending).rejects.toBeDefined()
    expect(request).toHaveBeenCalledTimes(1)
    loader.dispose()
  })
})
