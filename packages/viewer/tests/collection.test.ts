import { BoxGeometry, Plane, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { collectionBounds } from '../src/model/collection.js'
import { createPartCollectionLoader } from '../src/engine/collection.js'
import { createCollectionSections } from '../src/render/collection-sections.js'
import { BODY_PALETTE, bodyColors } from '../src/render/body-colors.js'
import { resolveTheme } from '../src/render/theme.js'
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
  it('colours each body apart, sharing a colour only between copies', () => {
    const ids = Array.from({ length: 17 }, (_, index) => `body-${index}`)
    const colors = bodyColors([...ids.slice(0, 2), 'body-0', ...ids.slice(2)])
    expect(colors.size).toBe(17)
    expect(colors.get('body-0')).toBe(BODY_PALETTE[0])
    expect(colors.get('body-1')).toBe(BODY_PALETTE[1])
    expect(new Set(ids.slice(0, 16).map((id) => colors.get(id))).size).toBe(16)
    // The second round is the palette lightened, so it stays in the same hue.
    const lighter = colors.get(`body-${BODY_PALETTE.length}`)!
    expect(lighter & 0xff).toBeGreaterThan(BODY_PALETTE[0]! & 0xff)
  })
  it('draws one section for the items a plane cuts, and drags them together', () => {
    const sections = createCollectionSections()
    const notified = vi.fn()
    sections.subscribe(notified)
    const theme = resolveTheme()
    const [a, b, c] = [new BoxGeometry(), new BoxGeometry(), new BoxGeometry()]
    const [first, second, third] = [{}, {}, {}]
    const moved: Array<string> = []
    const across = () => new Plane(new Vector3(0, 0, 1), 5)
    sections.set(first, {
      geometry: a,
      plane: across(),
      theme,
      showHandle: true,
      onDrag: (constant) => moved.push(`a${constant}`),
    })
    sections.set(second, {
      geometry: b,
      plane: across(),
      theme,
      showHandle: true,
      onDrag: (constant) => moved.push(`b${constant}`),
    })
    // Controlled without a change callback: drawn, but nothing to drag.
    sections.set(third, {
      geometry: c,
      plane: new Plane(new Vector3(1, 0, 0), 0),
      theme,
      showHandle: false,
    })
    const [cut, other] = sections.get()
    expect(sections.get()).toHaveLength(2)
    expect(cut!.geometries).toEqual([a, b])
    expect(cut!.showHandle).toBe(true)
    cut!.onDrag?.(3)
    expect(moved).toEqual(['a3', 'b3'])
    expect(other!.geometries).toEqual([c])
    expect(other!.showHandle).toBe(false)
    expect(other!.onDrag).toBeUndefined()
    sections.set(first, null)
    sections.set(first, null)
    expect(sections.get()[0]!.geometries).toEqual([b])
    expect(notified).toHaveBeenCalledTimes(4)
    for (const geometry of [a, b, c]) {
      geometry.dispose()
    }
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
  it('frees only the meshes the scene stops showing, after a retry and a replacement', async () => {
    let broken = true
    const request = vi.fn(async (url: string) =>
      url.endsWith('/9.glb') && broken
        ? new Response(null, { status: 500 })
        : new Response(loadMeshFixture('local-0.3.0-cube')),
    )
    // More bodies than the cache keeps unreferenced, so a freed mesh is evicted at once.
    const loader = createPartCollectionLoader({ fetch: request })
    // A partial result the scene never shows: its meshes are held for the retry.
    const first = await loader.load(models(10))
    expect(first.failures.map((failure) => failure.id)).toEqual(['9'])
    broken = false
    const again = await loader.load(models(10))
    expect(again.items[0]!.geometry).toBe(first.items[0]!.geometry)
    loader.keep(again.items)
    const replaced = vi.fn()
    again.items[0]!.geometry.addEventListener('dispose', replaced)
    const kept = vi.fn()
    again.items[1]!.geometry.addEventListener('dispose', kept)
    const [display] = models(1)
    const [analysis] = (
      await loader.load([
        {
          ...display!,
          model: {
            ...display!.model,
            mesh: { ...display!.model.mesh, glbUrl: 'https://test/analysis.glb' },
          },
        },
      ])
    ).items
    expect(replaced).not.toHaveBeenCalled()
    loader.keep([analysis!, ...again.items.slice(1)])
    expect(replaced).toHaveBeenCalledTimes(1)
    expect(kept).not.toHaveBeenCalled()
    const fetched = request.mock.calls.length
    await loader.load(models(10).slice(1))
    expect(request.mock.calls.length).toBe(fetched)
    loader.dispose()
    expect(kept).toHaveBeenCalledTimes(1)
  })
  it('prepares a replacement model and geometry while preserving the visible artifact', async () => {
    const request = vi.fn(async () => new Response(loadMeshFixture('local-0.3.0-cube')))
    const loader = createPartCollectionLoader({ fetch: request })
    const [display] = models(1)
    const original = (await loader.load([display!])).items[0]!
    loader.keep([original])
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
    loader.keep([replacement])
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
