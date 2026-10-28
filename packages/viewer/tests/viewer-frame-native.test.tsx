// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

/** React Native's views, as plain elements that record every set of props they render with. */
const views: Array<Record<string, unknown>> = []
const host =
  (tag: string) =>
  ({ children, ...props }: { children?: ReactNode }) => {
    views.push(props)
    return createElement(tag, null, children)
  }
/** React Native's `AppState`: its current state, and a change that tells every listener. */
const listeners = new Set<(state: string) => void>()
const appState = {
  currentState: 'active',
  addEventListener: (_type: 'change', listener: (state: string) => void) => {
    listeners.add(listener)
    return { remove: () => listeners.delete(listener) }
  },
  change: (state: string) => {
    appState.currentState = state
    for (const listener of [...listeners]) listener(state)
  },
}
vi.mock('react-native', () => ({
  View: host('div'),
  Pressable: host('button'),
  Text: host('span'),
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
  AppState: appState,
}))
// The canvas needs a GL context; the frame around it is what is tested here,
// and the props it hands the canvas.
const canvases: Array<Record<string, unknown>> = []
vi.mock('@react-three/fiber/native', () => ({
  Canvas: (props: Record<string, unknown>) => {
    canvases.push(props)
    return null
  },
  addAfterEffect: () => () => {},
  useFrame: () => {},
  useThree: () => undefined,
}))
vi.mock('expo-gl', () => ({ GLView: {} }))

const { ViewerFrame } = await import('../src/viewer-frame.native.js')

const canvas = {
  projection: 'orthographic' as const,
  camera: {},
  gl: {},
  frameloop: 'demand' as const,
}

describe('ViewerFrame (React Native)', () => {
  it('gives a screen reader an image of the view, apart from the labels', () => {
    views.length = 0
    render(
      <ViewerFrame
        canvas={canvas}
        accessibilityLabel="3D view of bracket.step"
        accessibilityHint="Fit is in the View menu."
      >
        {null}
      </ViewerFrame>,
    )

    const images = views.filter((view) => view.accessibilityRole === 'image')
    expect(images).toEqual([
      expect.objectContaining({
        accessible: true,
        accessibilityLabel: '3D view of bracket.step',
        accessibilityHint: 'Fit is in the View menu.',
        pointerEvents: 'none',
      }),
    ])
    // The frame itself stays a container, so the labels' buttons stay reachable.
    expect(views.filter((view) => view.accessible === true)).toHaveLength(1)
  })

  it('adds nothing for a screen reader without a label', () => {
    views.length = 0
    render(<ViewerFrame canvas={canvas}>{null}</ViewerFrame>)

    expect(views.some((view) => view.accessibilityRole === 'image')).toBe(false)
  })

  it('runs the canvas no frames while the app is inactive', () => {
    appState.currentState = 'inactive'
    canvases.length = 0
    render(<ViewerFrame canvas={canvas}>{null}</ViewerFrame>)
    expect(canvases.at(-1)?.frameloop).toBe('never')

    act(() => appState.change('active'))
    expect(canvases.at(-1)?.frameloop).toBe('demand')

    act(() => appState.change('background'))
    expect(canvases.at(-1)?.frameloop).toBe('never')
    act(() => appState.change('active'))
  })
})
