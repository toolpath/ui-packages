// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { OrthographicCamera } from 'three'
import { describe, expect, it, vi } from 'vitest'

/**
 * React Native's views, as plain elements: each records the props it was last
 * rendered with under its `testID`, where a test can read them.
 */
const rendered = new Map<string, Record<string, unknown>>()
const host =
  (tag: string) =>
  ({ children, ...props }: { children?: ReactNode; testID?: string }) => {
    if (props.testID) rendered.set(props.testID, props)
    return createElement(tag, null, children)
  }
vi.mock('react-native', () => ({
  View: host('div'),
  Pressable: host('button'),
  Text: host('span'),
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
}))

const { LabelOverlay } = await import('../src/label-overlay.native.js')
const { createLabelStore } = await import('../src/render/label-store.js')

type Slop = { top: number; bottom: number; left: number; right: number }

/** A store holding one label, already projected, as the frame leaves it. */
const storeWith = (label: { onPress?: () => void; accessibilityHint?: string }) => {
  const store = createLabelStore()
  store.set('a', { position: [0, 0, 0], text: '12.4 mm', kind: 'distance', ...label })
  return store
}

/** One frame's projection, with the label in the middle of the view. */
const project = (store: ReturnType<typeof createLabelStore>) =>
  act(() => {
    const view = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    view.position.set(0, 0, 5)
    view.updateMatrixWorld()
    store.project(view, { width: 200, height: 200 })
  })

describe('LabelOverlay (React Native)', () => {
  it('gives a pressable label a touch target at least 44 tall once laid out', () => {
    const store = storeWith({ onPress: () => {} })
    render(<LabelOverlay store={store} />)
    project(store)

    const label = () => rendered.get('scene-label-distance') ?? {}
    act(() => {
      const onLayout = label().onLayout as (event: unknown) => void
      onLayout({ nativeEvent: { layout: { width: 60, height: 17 } } })
    })

    const slop = label().hitSlop as Slop
    expect(17 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44)
    expect(60 + slop.left + slop.right).toBeGreaterThanOrEqual(60 + 16)
  })
})
