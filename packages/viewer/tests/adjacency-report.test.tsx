// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { BufferGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PartModel } from '../src/model/types.js'

const regionAdjacency = vi.fn(() => new Map<number, ReadonlySet<number>>())
vi.mock('../src/render/adjacency.js', () => ({ regionAdjacency }))

const { useAdjacencyReport } = await import('../src/part-mesh.js')

// The walk is mocked, so the part only has to be one object.
const part = () => ({}) as PartModel

describe('useAdjacencyReport', () => {
  it('never walks the mesh when nobody asked for its adjacency', () => {
    regionAdjacency.mockClear()
    const { rerender } = renderHook(() =>
      useAdjacencyReport(part(), new BufferGeometry(), undefined),
    )
    rerender()

    expect(regionAdjacency).not.toHaveBeenCalled()
  })

  it('walks it once per mesh for a listener, and hands a new listener the same result', () => {
    regionAdjacency.mockClear()
    const model = part()
    const geometry = new BufferGeometry()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ onAdjacency }) => useAdjacencyReport(model, geometry, onAdjacency),
      { initialProps: { onAdjacency: first } },
    )
    rerender({ onAdjacency: second })

    expect(regionAdjacency).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(second.mock.calls[0]![0]).toBe(first.mock.calls[0]![0])
  })
})
