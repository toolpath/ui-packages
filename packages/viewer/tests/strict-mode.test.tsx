import { createRoot, extend } from '@react-three/fiber'
import { StrictMode, Suspense, act, type ReactNode } from 'react'
import * as THREE from 'three'
import { Mesh, type Object3D } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGION_ATTRIBUTE } from '../src/render/part.js'
import { loadMeshFixture, loadReportFixture } from './fixtures.js'

/*
 * The scene runs in fiber's own reconciler, as in the app. The frame around it
 * is the platform's (a DOM canvas on the web), so it is left out: the scene is
 * rendered in its place.
 */
vi.mock('../src/viewer-frame.js', () => ({
  ViewerFrame: ({ children }: { children: ReactNode }) => children,
}))

// What fiber's `Canvas` registers for its children.
extend(THREE as never)

const { Viewer } = await import('../src/viewer.js')
const { EnginePart, engineGeometryCache, normalizePartReport } =
  await import('../src/engine/index.js')

const report = {
  ...loadReportFixture('local-0.3.0-cube'),
  meshGlbUrl: 'https://example.test/strict.glb',
  meshStlUrl: null,
  thumbnailUrl: null,
}

/** A renderer that draws nothing: what is under test is which effects React runs. */
const renderer = (canvas: object) => ({
  domElement: canvas,
  render: () => {},
  setSize: () => {},
  setPixelRatio: () => {},
  dispose: () => {},
  xr: {
    enabled: false,
    isPresenting: false,
    setAnimationLoop: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  shadowMap: { enabled: false },
})

/** Renders `scene` into a fiber root under StrictMode, as fiber's `Canvas` carries the page's in. */
const mount = async (scene: ReactNode) => {
  // An element with no layout, as React Native's canvas is: the controls listen to nothing.
  const canvas = { addEventListener: () => {}, removeEventListener: () => {} }
  const root = createRoot(canvas as never)
  await root.configure({
    gl: renderer(canvas) as never,
    size: { width: 100, height: 100, top: 0, left: 0 },
    dpr: 1,
    frameloop: 'never',
  })
  let store: ReturnType<typeof root.render> | undefined
  await act(async () => {
    store = root.render(<StrictMode>{scene}</StrictMode>)
  })
  // The mesh loads, and the boundary shows the part.
  await act(async () => {
    await engineGeometryCache.get(normalizePartReport(report)).promise
  })
  return { scene: store!.getState().scene, unmount: () => act(async () => root.unmount()) }
}

/** The part's mesh, still in the scene and still painted by region. */
const drawnPart = (scene: Object3D): Mesh | undefined => {
  let found: Mesh | undefined
  scene.traverse((object) => {
    if (object instanceof Mesh && object.geometry.getAttribute(REGION_ATTRIBUTE)) found = object
  })
  return found
}

beforeEach(() => {
  // camera-controls makes one, even with no element to measure.
  vi.stubGlobal('DOMRect', class {})
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(loadMeshFixture('local-0.3.0-cube'))),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  engineGeometryCache.clear()
})

describe('a part shown by a Suspense boundary under StrictMode', () => {
  it('is drawn', async () => {
    const { scene, unmount } = await mount(
      <Suspense fallback={null}>
        <Viewer>
          <EnginePart report={report} />
        </Viewer>
      </Suspense>,
    )
    expect(drawnPart(scene)).toBeDefined()
    await unmount()
  })
})
