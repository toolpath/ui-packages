import { describe, expect, it, vi } from 'vitest'
import { createPartCollectionSession } from '../src/engine/collection-session.js'
import type { PartModel } from '../src/model/types.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

const modelAt = (url: string): PartModel => {
  const model = cubeModel()
  return { ...model, mesh: { ...model.mesh, glbUrl: url, stlUrl: null } }
}
const bodies = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    model: modelAt(`https://test/${index}.glb`),
  }))
const cube = () => new Response(loadMeshFixture('local-0.3.0-cube'))
/** Resolves once the session has published a state that passes `test`. */
const settled = (
  session: ReturnType<typeof createPartCollectionSession>,
  test: (state: ReturnType<typeof session.get>) => boolean,
) =>
  new Promise<ReturnType<typeof session.get>>((resolve) => {
    if (test(session.get())) {
      resolve(session.get())
      return
    }
    const stop = session.subscribe(() => {
      if (test(session.get())) {
        stop()
        resolve(session.get())
      }
    })
  })

describe('collection sessions', () => {
  it('shows nothing until every model has loaded, within one limit for the session', async () => {
    let active = 0
    let peak = 0
    const request = vi.fn(async () => {
      peak = Math.max(peak, ++active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return cube()
    })
    const session = createPartCollectionSession({ fetch: request, concurrency: 2 })
    const states: Array<number | null> = []
    session.subscribe(() => states.push(session.get().items?.length ?? null))
    session.show(bodies(5))
    const { items } = await settled(session, (state) => state.items !== null)
    expect(items!.map((item) => item.id)).toEqual(['0', '1', '2', '3', '4'])
    expect(states.slice(0, -1).every((length) => length === null)).toBe(true)
    expect(peak).toBe(2)
    session.dispose()
  })

  it('retries only the failed models, and reuses what loaded', async () => {
    let broken = true
    const request = vi.fn(async (url: string) =>
      url.endsWith('/1.glb') && broken ? new Response(null, { status: 500 }) : cube(),
    )
    const session = createPartCollectionSession({ fetch: request })
    session.show(bodies(3))
    const failedOnce = await settled(session, (state) => state.failures.length > 0)
    expect(failedOnce.items).toBeNull()
    expect(failedOnce.failures.map((failure) => failure.id)).toEqual(['1'])
    broken = false
    session.retry()
    const { items, failures } = await settled(session, (state) => state.items !== null)
    expect(failures).toEqual([])
    expect(items!.map((item) => item.id)).toEqual(['0', '1', '2'])
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'https://test/0.glb',
      'https://test/1.glb',
      'https://test/2.glb',
      'https://test/1.glb',
    ])
    session.dispose()
  })

  it('replaces a changed model once it loads, keeping the current item until then', async () => {
    let release: () => void = () => {}
    const request = vi.fn(async (url: string) => {
      if (url.includes('analysis')) {
        await new Promise<void>((resolve) => (release = resolve))
      }
      return cube()
    })
    const session = createPartCollectionSession({ fetch: request })
    const models = bodies(2)
    session.show(models)
    const before = (await settled(session, (state) => state.items !== null)).items!
    session.keep(before)
    const analysis = modelAt('https://test/analysis.glb')
    session.show([models[0]!, { id: '1', model: analysis }])
    expect(session.get().items).toBe(before)
    release()
    const after = await settled(session, (state) => state.items?.[1]?.model === analysis)
    expect(after.items![0]).toBe(before[0])
    expect(after.items![1]!.geometry).not.toBe(before[1]!.geometry)
    session.dispose()
  })

  it('drops a result for a model replaced again while it loaded', async () => {
    const waiting = new Map<string, () => void>()
    const request = vi.fn(async (url: string) => {
      if (!url.includes('/0.glb')) {
        await new Promise<void>((resolve) => waiting.set(url, resolve))
      }
      return cube()
    })
    const session = createPartCollectionSession({ fetch: request })
    const first = bodies(1)
    session.show(first)
    await settled(session, (state) => state.items !== null)
    const older = modelAt('https://test/older.glb')
    const newer = modelAt('https://test/newer.glb')
    session.show([{ id: '0', model: older }])
    await vi.waitFor(() => expect(waiting.has('https://test/older.glb')).toBe(true))
    session.show([{ id: '0', model: newer }])
    waiting.get('https://test/older.glb')!()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(session.get().items![0]!.model).toBe(first[0]!.model)
    await vi.waitFor(() => expect(waiting.has('https://test/newer.glb')).toBe(true))
    waiting.get('https://test/newer.glb')!()
    const { items } = await settled(session, (state) => state.items?.[0]?.model === newer)
    expect(items).toHaveLength(1)
    session.dispose()
  })

  it('keeps showing a body whose replacement fails, and retries just that body', async () => {
    let broken = true
    const request = vi.fn(async (url: string) =>
      url.includes('analysis') && broken ? new Response(null, { status: 500 }) : cube(),
    )
    const session = createPartCollectionSession({ fetch: request })
    const models = bodies(2)
    session.show(models)
    const before = (await settled(session, (state) => state.items !== null)).items!
    const analysis = modelAt('https://test/analysis.glb')
    session.show([models[0]!, { id: '1', model: analysis }])
    const failed = await settled(session, (state) => state.failures.length > 0)
    expect(failed.failures.map((failure) => failure.id)).toEqual(['1'])
    expect(failed.items).toEqual(before)
    broken = false
    session.retry('1')
    const { items, failures } = await settled(
      session,
      (state) => state.items?.[1]?.model === analysis,
    )
    expect(failures).toEqual([])
    expect(items![0]).toBe(before[0])
    session.dispose()
  })

  it('publishes nothing for the same models again, and nothing after disposal', async () => {
    let release: () => void = () => {}
    const request = vi.fn(async () => {
      await new Promise<void>((resolve) => (release = resolve))
      return cube()
    })
    const session = createPartCollectionSession({ fetch: request })
    const models = bodies(1)
    session.show(models)
    const published = vi.fn()
    session.subscribe(published)
    session.show([...models])
    expect(published).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    session.dispose()
    release()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(published).not.toHaveBeenCalled()
    expect(session.get().items).toBeNull()
  })
})
