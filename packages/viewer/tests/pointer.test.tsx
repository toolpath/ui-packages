import { act, type ReactNode } from 'react'
import { createRoot, extend, type RootState, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Box3, Raycaster, Vector3, type BufferGeometry, type Object3D } from 'three'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { ExplodedPart } from '../src/exploded-part.js'
import type { ExplodeGroup, ExplodePick } from '../src/model/explode.js'
import type { PartModel } from '../src/model/types.js'
import { PartMesh } from '../src/part-mesh.js'
import { EXCLUDE_FROM_FRAME } from '../src/render/camera.js'
import type { PartPick } from '../src/render/picking.js'
import { createSectionStore } from '../src/render/section-store.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

/*
 * The viewer's contexts, as a `<Viewer>` provides them, without its canvas. These tests render
 * into an R3F root with a stand-in renderer and call the pointer handlers R3F would call.
 */
const viewer = vi.hoisted(() => ({ retarget: vi.fn(), section: null as unknown }))
vi.mock('../src/viewer.js', () => ({
  useViewerControls: () => ({ frameBox: () => undefined }),
  useSectionStore: () => viewer.section,
  useOptionalSectionStore: () => viewer.section,
  useRetarget: () => viewer.retarget,
}))

extend(THREE as never)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Handlers = Record<string, (event: unknown) => void>
type WithHandlers = Object3D & { __r3f?: { handlers?: Handlers } }

const unmounts: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const unmount of unmounts.splice(0)) {
    await unmount()
  }
  viewer.retarget.mockClear()
})

/** An R3F root on a stand-in canvas and renderer; `press` starts a gesture, as a pointerdown. */
const mount = async (element: ReactNode) => {
  const presses = new Set<(event: { clientX: number; clientY: number }) => void>()
  const canvas = {
    addEventListener: (
      type: string,
      listener: (event: { clientX: number; clientY: number }) => void,
    ) => {
      if (type === 'pointerdown') {
        presses.add(listener)
      }
    },
    removeEventListener: (
      _type: string,
      listener: (event: { clientX: number; clientY: number }) => void,
    ) => {
      presses.delete(listener)
    },
    style: {},
  }
  const renders: Array<() => void> = []
  const gl = {
    domElement: canvas,
    render: () => {
      for (const render of renders) {
        render()
      }
    },
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    getScissor: (into: unknown) => into,
    setScissor: () => undefined,
    getScissorTest: () => false,
    setScissorTest: () => undefined,
  }
  viewer.section = createSectionStore()
  const root = createRoot(canvas as unknown as HTMLCanvasElement)
  await root.configure({
    gl: gl as never,
    size: { width: 100, height: 100, top: 0, left: 0 },
    frameloop: 'never',
  })
  let store: { getState: () => RootState } | undefined
  await act(async () => {
    store = root.render(element)
  })
  const unmount = async () => {
    await act(async () => root.unmount())
  }
  unmounts.push(unmount)
  const scene = store!.getState().scene
  return {
    scene,
    camera: store!.getState().camera,
    /** Runs `check` inside each render the renderer is asked for. */
    onRender: (check: () => void) => renders.push(check),
    press: (clientX: number, clientY = 0) => {
      for (const listener of presses) {
        listener({ clientX, clientY })
      }
    },
    rerender: async (next: ReactNode) => {
      await act(async () => {
        root.render(next)
      })
    },
    /** Lets the pieces' warm-up, scheduled after mount, run. */
    settle: async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    },
    handlersOf: (object: Object3D) => (object as WithHandlers).__r3f!.handlers!,
    find: (name: string) => scene.getObjectByName(name)!,
  }
}

let model: PartModel
let geometry: BufferGeometry
beforeAll(async () => {
  model = cubeModel()
  geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
})

/** A pointer event over `hit`, at `clientX`, `timeStamp` ms in, with `button`. */
const pointer = (
  hit: Partial<THREE.Intersection>,
  { clientX = 10, timeStamp = 0, button = 0 } = {},
) => {
  let stopped = false
  let prevented = false
  const event = {
    ...hit,
    point: hit.point ?? new Vector3(),
    nativeEvent: {
      clientX,
      clientY: 0,
      timeStamp,
      button,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {
        prevented = true
      },
    },
    stopPropagation: () => {
      stopped = true
    },
  }
  return {
    event: event as unknown as ThreeEvent<MouseEvent>,
    stopped: () => stopped,
    prevented: () => prevented,
  }
}

describe('<PartMesh visible={false}>', () => {
  it('stays mounted out of drawing, framing, rays, hover and picks, and comes back', async () => {
    const onPick = vi.fn()
    const onHover = vi.fn()
    const part = (visible: boolean) => (
      <PartMesh
        model={model}
        geometry={geometry}
        visible={visible}
        onPick={onPick}
        onHover={onHover}
      />
    )
    const scene = await mount(part(false))
    let surface: Object3D | undefined
    scene.scene.traverse((object) => {
      if ((object as WithHandlers).__r3f?.handlers?.onClick) {
        surface = object
      }
    })
    const shown = surface!.parent!
    expect(shown.visible).toBe(false)
    expect(shown.userData[EXCLUDE_FROM_FRAME]).toBe(true)
    surface!.traverse((object) => expect(object.layers.mask).toBe(0))

    const handlers = scene.handlersOf(surface!)
    const hit = { faceIndex: 0, point: new Vector3() }
    scene.press(10)
    handlers.onPointerMove!(pointer(hit).event)
    handlers.onClick!(pointer(hit).event)
    const menu = pointer(hit, { button: 2 })
    handlers.onContextMenu!(menu.event)
    expect(onHover).not.toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
    expect(menu.prevented()).toBe(false)

    await scene.rerender(part(true))
    expect(shown.visible).toBe(true)
    expect(shown.userData[EXCLUDE_FROM_FRAME]).toBe(false)
    surface!.traverse((object) => expect(object.layers.mask).not.toBe(0))
    handlers.onPointerMove!(pointer(hit).event)
    handlers.onClick!(pointer(hit, { timeStamp: 1000 }).event)
    expect(onHover).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledTimes(1)
    expect((onPick.mock.calls[0]![0] as PartPick).region).toBe(
      model.regionIndex.regionForTriangle(0),
    )
  })
})

describe('<ExplodedPart> pointer', () => {
  // Two copies of the top face, apart on either side of the part.
  const top = () =>
    model.features.find((f) => f.featureType === 'face' && f.machiningDirection.z === 1)!
  const layout = (): Array<ExplodeGroup> => [
    {
      id: 'left',
      regionIdxs: [...top().regionIdxs],
      offset: { x: -60, y: 0, z: 0 },
      color: 0x34d399,
      featureTags: [top().tag],
    },
    {
      id: 'right',
      regionIdxs: [...top().regionIdxs],
      offset: { x: 60, y: 0, z: 0 },
      color: 0xa78bfa,
      featureTags: [top().tag],
    },
  ]

  /** The ray hit on a piece's top, straight down through its middle. */
  const hitOn = (scene: Awaited<ReturnType<typeof mount>>, offset: number) => {
    scene.scene.updateMatrixWorld(true)
    const centre = new Box3().setFromBufferAttribute(
      geometry.getAttribute('position') as THREE.BufferAttribute,
    )
    const middle = centre.getCenter(new Vector3())
    const ray = new Raycaster(
      new Vector3(middle.x + offset, middle.y, centre.max.z + 100),
      new Vector3(0, 0, -1),
    )
    return ray.intersectObject(scene.find('explode-surfaces'))[0]!
  }

  const render = async (props: Partial<Parameters<typeof ExplodedPart>[0]> = {}) => {
    const onPick = vi.fn<(pick: ExplodePick) => void>()
    const onHover = vi.fn<(pick: ExplodePick | null) => void>()
    const groups = layout()
    const element = (overrides: Partial<Parameters<typeof ExplodedPart>[0]> = {}) => (
      <ExplodedPart
        model={model}
        geometry={geometry}
        explode={{ groups, amount: 1 }}
        onPick={onPick}
        onHover={onHover}
        {...props}
        {...overrides}
      />
    )
    const scene = await mount(element())
    const handlers = () => scene.handlersOf(scene.find('exploded-part'))
    return { scene, handlers, onPick, onHover, element }
  }

  it('picks a tapped piece, and not the end of a drag', async () => {
    const { scene, handlers, onPick } = await render()
    const hit = hitOn(scene, 60)
    scene.press(10)
    const tap = pointer(hit)
    handlers().onClick!(tap.event)
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]![0].explodeGroupId).toBe('right')
    expect(tap.stopped()).toBe(true)
    // Pressed at 10 and released 40 pixels away: an orbit, not a click.
    scene.press(10)
    handlers().onClick!(pointer(hit, { clientX: 50, timeStamp: 1000 }).event)
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('reports a double click and re-aims the orbit at the piece', async () => {
    const { scene, handlers, onPick } = await render()
    const hit = hitOn(scene, -60)
    scene.press(10)
    handlers().onClick!(pointer(hit, { timeStamp: 0 }).event)
    handlers().onClick!(pointer(hit, { timeStamp: 200 }).event)
    expect(onPick.mock.calls.map(([pick]) => pick.doubled)).toEqual([false, true])
    expect(viewer.retarget).toHaveBeenCalledWith(hit.point)
  })

  it('judges the right button on release, and passes a miss through', async () => {
    const { scene, handlers, onPick } = await render()
    const hit = hitOn(scene, 60)
    scene.press(10)
    handlers().onPointerUp!(pointer(hit, { button: 0 }).event)
    expect(onPick).not.toHaveBeenCalled()
    handlers().onPointerUp!(pointer(hit, { button: 2 }).event)
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]![0].modifiers.secondary).toBe(true)
    const menu = pointer(hit, { button: 2 })
    handlers().onContextMenu!(menu.event)
    expect(menu.prevented()).toBe(true)
    // A hit with no face is no pick: the event goes on to what is behind.
    const miss = pointer({ ...hit, face: null }, { timeStamp: 5000 })
    handlers().onClick!(miss.event)
    expect(miss.stopped()).toBe(false)
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('reports hover once per piece and face', async () => {
    const { scene, handlers, onHover } = await render()
    const right = hitOn(scene, 60)
    handlers().onPointerMove!(pointer(right).event)
    handlers().onPointerMove!(pointer({ ...right, point: right.point.clone() }).event)
    expect(onHover).toHaveBeenCalledTimes(1)
    expect(onHover.mock.calls[0]![0]!.explodeGroupId).toBe('right')
    handlers().onPointerMove!(pointer(hitOn(scene, -60)).event)
    expect(onHover).toHaveBeenCalledTimes(2)
    handlers().onPointerOut!(pointer(right).event)
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('hovers the piece under the pointer again once the layout changes', async () => {
    const { scene, handlers, onHover, element } = await render()
    handlers().onPointerMove!(pointer(hitOn(scene, 60)).event)
    expect(onHover).toHaveBeenCalledTimes(1)
    // The same pieces, laid out again: the hover is dropped with the old ones.
    await scene.rerender(element({ explode: { groups: layout(), amount: 1 } }))
    expect(onHover).toHaveBeenLastCalledWith(null)
    handlers().onPointerMove!(pointer(hitOn(scene, 60)).event)
    expect(onHover).toHaveBeenCalledTimes(3)
    expect(onHover.mock.calls[2]![0]!.explodeGroupId).toBe('right')
  })

  it('neither hovers nor picks while hidden, and warms its pieces all the same', async () => {
    const { scene, handlers, onPick, onHover } = await render({ visible: false })
    const pieces = scene.find('explode-surfaces')
    const warmed: Array<boolean> = []
    scene.onRender(() => {
      let drawn = true
      pieces.traverseAncestors((object) => {
        drawn &&= object.visible
      })
      warmed.push(drawn && pieces.visible && pieces.layers.test(scene.camera.layers))
    })
    await vi.waitFor(async () => {
      await scene.settle()
      expect(warmed.length).toBeGreaterThan(0)
    })
    expect(warmed).toEqual([true])
    // Hidden again, and left out of framing.
    const group = scene.find('exploded-part')
    expect(group.visible).toBe(false)
    expect(group.userData[EXCLUDE_FROM_FRAME]).toBe(true)

    const hit = { batchId: 0, faceIndex: 0, face: { normal: new Vector3(0, 0, 1) } }
    scene.press(10)
    handlers().onPointerMove!(pointer(hit as never).event)
    handlers().onClick!(pointer(hit as never).event)
    expect(onHover).not.toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
  })
})
