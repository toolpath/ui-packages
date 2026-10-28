// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/** Fiber's root store, reduced to its loop. */
const fiber = vi.hoisted(() => ({
  state: { frameloop: 'demand' as 'always' | 'demand' | 'never', invalidate: () => {} },
}))
vi.mock('@react-three/fiber', () => ({
  useThree: <T>(selector: (state: typeof fiber.state) => T): T => selector(fiber.state),
}))

const { useAppInactive, useRepaintOnResume } = await import('../src/render/pause-inactive.js')

/** React Native's `AppState`: its current state, and a change that tells every listener. */
const createAppState = (initial: string) => {
  const listeners = new Set<(state: string) => void>()
  const appState = {
    currentState: initial,
    addEventListener: (_type: 'change', listener: (state: string) => void) => {
      listeners.add(listener)
      return { remove: () => listeners.delete(listener) }
    },
    change: (state: string) => {
      appState.currentState = state
      for (const listener of [...listeners]) listener(state)
    },
    listeners,
  }
  return appState
}

describe('useAppInactive', () => {
  it('is inactive from the first render when the app already is', () => {
    const { result } = renderHook(() => useAppInactive(createAppState('inactive')))
    expect(result.current).toBe(true)
  })

  it('follows the app out and back', () => {
    const appState = createAppState('active')
    const { result } = renderHook(() => useAppInactive(appState))
    expect(result.current).toBe(false)

    act(() => appState.change('inactive'))
    expect(result.current).toBe(true)
    act(() => appState.change('background'))
    expect(result.current).toBe(true)
    act(() => appState.change('active'))
    expect(result.current).toBe(false)
  })

  it('stops listening when it unmounts', () => {
    const appState = createAppState('active')
    const { unmount } = renderHook(() => useAppInactive(appState))
    expect(appState.listeners.size).toBe(1)

    unmount()
    expect(appState.listeners.size).toBe(0)
  })
})

describe('useRepaintOnResume', () => {
  it('asks for a frame once the loop runs again, and none while it is paused', () => {
    const invalidate = vi.fn()
    fiber.state = { frameloop: 'never', invalidate }
    const { rerender } = renderHook(() => useRepaintOnResume())
    expect(invalidate).not.toHaveBeenCalled()

    // What fiber's store holds once it has applied the canvas's new `frameloop`.
    fiber.state = { frameloop: 'demand', invalidate }
    rerender()
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
