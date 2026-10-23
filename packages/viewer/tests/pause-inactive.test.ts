import { describe, expect, it, vi } from 'vitest'
import { type Frameloop, pauseWhileInactive } from '../src/render/pause-inactive.js'

/** Fiber's root store, reduced to its loop: subscribers hear every change. */
const createStore = (initial: Frameloop) => {
  const listeners = new Set<(state: { frameloop: Frameloop }) => void>()
  const state = {
    frameloop: initial,
    setFrameloop: vi.fn((frameloop: Frameloop) => {
      state.frameloop = frameloop
      for (const listener of [...listeners]) listener({ frameloop })
    }),
    invalidate: vi.fn(),
  }
  return {
    state,
    getState: () => state,
    subscribe: (listener: (state: { frameloop: Frameloop }) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const createAppState = (currentState: string) => {
  let listener: ((state: string) => void) | null = null
  return {
    currentState,
    addEventListener: (_type: 'change', next: (state: string) => void) => {
      listener = next
      return { remove: () => (listener = null) }
    },
    change: (state: string) => listener?.(state),
  }
}

describe('pauseWhileInactive', () => {
  it('pauses a canvas that mounts while the app is already inactive', () => {
    const store = createStore('demand')
    pauseWhileInactive(createAppState('inactive'), store, 'demand')

    expect(store.state.setFrameloop).toHaveBeenCalledWith('never')
    expect(store.state.frameloop).toBe('never')
  })

  it('stays paused when a re-render sets the loop back to its prop', () => {
    const store = createStore('demand')
    const appState = createAppState('active')
    pauseWhileInactive(appState, store, 'demand')

    appState.change('inactive')
    // What fiber 9.7's Canvas does on every render: the prop wins.
    store.state.setFrameloop('demand')

    expect(store.state.frameloop).toBe('never')
  })

  it('resumes with a frame when the app is active again', () => {
    const store = createStore('demand')
    const appState = createAppState('active')
    pauseWhileInactive(appState, store, 'demand')

    appState.change('background')
    appState.change('active')

    expect(store.state.frameloop).toBe('demand')
    expect(store.state.invalidate).toHaveBeenCalledTimes(1)
  })

  it('leaves the loop alone once stopped', () => {
    const store = createStore('demand')
    const appState = createAppState('active')
    const stop = pauseWhileInactive(appState, store, 'demand')

    stop()
    appState.change('inactive')

    expect(store.state.frameloop).toBe('demand')
  })
})
