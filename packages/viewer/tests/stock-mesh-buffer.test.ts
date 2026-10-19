import { BoxGeometry } from 'three'
import type { BufferGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createStockMeshBuffer } from '../src/render/stock-mesh-buffer.js'

const deferred = () => {
  let resolve!: (geometries: BufferGeometry[]) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<BufferGeometry[]>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('decoded stock transitions', () => {
  it('keeps A alive while B decodes and disposes A only after B commits', async () => {
    const buffer = createStockMeshBuffer()
    const a = new BoxGeometry()
    const b = new BoxGeometry()
    const disposeA = vi.spyOn(a, 'dispose')
    const disposeB = vi.spyOn(b, 'dispose')
    const ready = vi.fn()
    const cancelA = buffer.request(() => Promise.resolve([a]), ready, vi.fn())
    await Promise.resolve()
    buffer.commit([a])
    cancelA()
    const pending = deferred()
    buffer.request(() => pending.promise, ready, vi.fn())
    expect(disposeA).not.toHaveBeenCalled()
    pending.resolve([b])
    await Promise.resolve()
    expect(ready).toHaveBeenLastCalledWith([b])
    expect(disposeA).not.toHaveBeenCalled()
    buffer.commit([b])
    expect(disposeA).toHaveBeenCalledOnce()
    expect(disposeB).not.toHaveBeenCalled()
    buffer.dispose()
    expect(disposeB).toHaveBeenCalledOnce()
  })

  it('discards late B after A → B → A and never replaces the visible answer', async () => {
    const buffer = createStockMeshBuffer()
    const pending = deferred()
    const b = new BoxGeometry()
    const disposeB = vi.spyOn(b, 'dispose')
    const ready = vi.fn()
    const cancel = buffer.request(() => pending.promise, ready, vi.fn())
    cancel()
    pending.resolve([b])
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    expect(disposeB).toHaveBeenCalledOnce()
    buffer.dispose()
  })

  it('disposes a decode completing after unmount', async () => {
    const buffer = createStockMeshBuffer()
    const pending = deferred()
    const geometry = new BoxGeometry()
    const dispose = vi.spyOn(geometry, 'dispose')
    const ready = vi.fn()
    buffer.request(() => pending.promise, ready, vi.fn())
    buffer.dispose()
    pending.resolve([geometry])
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('reports current decode errors but ignores cancelled failures', async () => {
    const buffer = createStockMeshBuffer()
    const failed = vi.fn()
    const error = new Error('bad GLB')
    buffer.request(() => Promise.reject(error), vi.fn(), failed)
    await Promise.resolve()
    expect(failed).toHaveBeenCalledWith(error)
    const pending = deferred()
    const cancel = buffer.request(() => pending.promise, vi.fn(), failed)
    cancel()
    pending.reject(error)
    await Promise.resolve()
    expect(failed).toHaveBeenCalledOnce()
    buffer.dispose()
  })

  it('supports cleanup/setup replay without publishing an earlier request', async () => {
    const buffer = createStockMeshBuffer()
    const ready = vi.fn()
    const first = deferred()
    const cancel = buffer.request(() => first.promise, ready, vi.fn())
    cancel()
    buffer.dispose()
    const current = new BoxGeometry()
    buffer.request(() => Promise.resolve([current]), ready, vi.fn())
    first.resolve([new BoxGeometry()])
    await Promise.resolve()
    expect(ready).toHaveBeenCalledOnce()
    expect(ready).toHaveBeenCalledWith([current])
    buffer.dispose()
  })
})
