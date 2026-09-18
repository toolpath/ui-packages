import { Box3, BoxGeometry, Group, Mesh, Raycaster, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { EXCLUDE_FROM_FRAME } from '../src/render/camera.js'
import {
  AXES_PLANE_OFFSET,
  DISABLED_SECTION,
  axesPlanes,
  sectionAnchor,
  sectionFromPick,
  sectionOptionsFromState,
  surfaceUnderRay,
} from '../src/render/section.js'
import { createSectionStore } from '../src/render/section-store.js'
import { resolveSectionPlane } from '../src/section-view.js'

const cube = () => new Box3(new Vector3(-10, -10, -10), new Vector3(10, 10, 10))

describe('createSectionStore', () => {
  it('starts empty, notifies on a change, and not on the same value again', () => {
    const store = createSectionStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.get()).toBeNull()

    const options = { enabled: true, offset: 0.5 }
    store.set(options)
    expect(store.get()).toBe(options)
    expect(listener).toHaveBeenCalledTimes(1)

    // `useSyncExternalStore` re-renders on every notification, so the same
    // value twice must not be one.
    store.set(options)
    expect(listener).toHaveBeenCalledTimes(1)

    store.set(null)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('carries the engaged flag on the same subscription, and only on a change', () => {
    const store = createSectionStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.isEngaged()).toBe(false)
    store.setEngaged(true)
    expect(store.isEngaged()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    store.setEngaged(false)
    expect(store.isEngaged()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  /**
   * The section tool and the measure tool can be up together, and each lets go
   * on its own unmount. The part waits for the last of them: a boolean would
   * have handed the pointer back the moment the first one left.
   */
  it('stays engaged until every tool that engaged it has let go', () => {
    const store = createSectionStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.setEngaged(true)
    store.setEngaged(true)
    expect(listener).toHaveBeenCalledTimes(1)
    store.setEngaged(false)
    expect(store.isEngaged()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    store.setEngaged(false)
    expect(store.isEngaged()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    // A release with nothing held is not a debt the next tool inherits.
    store.setEngaged(false)
    store.setEngaged(true)
    expect(store.isEngaged()).toBe(true)
  })

  /**
   * The picker raises it while it offers a cut and drops it once one is
   * placed; the measure tool reads it to keep its hands off the click that
   * chooses the cut. Same counting as `engaged`, on the same subscription.
   */
  it('carries the picking flag, counted, on the same subscription', () => {
    const store = createSectionStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.isPicking()).toBe(false)
    store.setPicking(true)
    expect(store.isPicking()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    store.setPicking(true)
    expect(listener).toHaveBeenCalledTimes(1)
    store.setPicking(false)
    expect(store.isPicking()).toBe(true)
    store.setPicking(false)
    expect(store.isPicking()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    // A release with nothing held is not a debt the next tool inherits.
    store.setPicking(false)
    store.setPicking(true)
    expect(store.isPicking()).toBe(true)
    // ...and it is its own flag, not the engaged one.
    expect(store.isEngaged()).toBe(false)
  })

  it('stops notifying once unsubscribed', () => {
    const store = createSectionStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.set({ enabled: true })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('sectionOptionsFromState', () => {
  /**
   * A drag reports a state and the store holds options, so the round trip is
   * what keeps a dragged cut where it was dragged to.
   */
  it('round-trips a sweep through its offset', () => {
    const box = cube()
    const first = resolveSectionPlane(
      { enabled: true, normal: { x: 0, y: 0, z: 1 }, offset: 0.3 },
      box,
    )
    expect(first).not.toBeNull()
    const again = resolveSectionPlane(sectionOptionsFromState(first!.state), box)
    expect(again!.plane.constant).toBeCloseTo(first!.plane.constant, 9)
    expect(again!.state.plane).toBeNull()
  })

  it('round-trips an anchored cut through its depth, keeping the anchor', () => {
    const box = cube()
    const plane = sectionFromPick({ point: { x: 0, y: 0, z: 10 }, normal: { x: 0, y: 0, z: 1 } })
    const first = resolveSectionPlane({ enabled: true, plane, depth: 4 }, box)
    const options = sectionOptionsFromState(first!.state)
    expect(options.plane).toBe(plane)
    expect(options.depth).toBeCloseTo(4, 9)
    const again = resolveSectionPlane(options, box)
    expect(again!.plane.constant).toBeCloseTo(first!.plane.constant, 9)
  })

  it('reports the disabled state as disabled', () => {
    expect(sectionOptionsFromState(DISABLED_SECTION).enabled).toBe(false)
    expect(resolveSectionPlane(sectionOptionsFromState(DISABLED_SECTION), cube())).toBeNull()
  })
})

describe('axesPlanes', () => {
  it('stands each plane past the part on the side away from the camera', () => {
    const box = cube()
    const planes = axesPlanes(box, { x: 30, y: -30, z: 30 })
    const byAxis = Object.fromEntries(planes.map((plane) => [plane.axis, plane]))

    // Largest dimension 20, so the planes stand 11 out from the centre.
    expect(byAxis.x!.position.x).toBeCloseTo(-20 * AXES_PLANE_OFFSET, 9)
    expect(byAxis.y!.position.y).toBeCloseTo(20 * AXES_PLANE_OFFSET, 9)
    expect(byAxis.z!.position.z).toBeCloseTo(-20 * AXES_PLANE_OFFSET, 9)
  })

  it('cuts in from the camera side, half way through', () => {
    const box = cube()
    const [x] = axesPlanes(box, { x: 30, y: 0, z: 0 })
    // The normal points into the half that stays, which is the half the
    // camera cannot see into.
    expect(x!.options.normal).toEqual({ x: -1, y: 0, z: 0 })
    expect(x!.options.offset).toBe(0.5)

    const cut = resolveSectionPlane(x!.options, box)!
    expect(cut.plane.distanceToPoint(new Vector3(-9, 0, 0))).toBeGreaterThan(0)
    expect(cut.plane.distanceToPoint(new Vector3(9, 0, 0))).toBeLessThan(0)
  })

  it('picks a side for a camera dead on an axis', () => {
    const planes = axesPlanes(cube(), { x: 0, y: 0, z: 30 })
    for (const plane of planes) expect(Math.abs(plane.sign)).toBe(1)
  })
})

describe('sectionAnchor', () => {
  it('lies on the plane, on the line through the centre along its normal', () => {
    const box = new Box3(new Vector3(0, 0, 0), new Vector3(10, 20, 30))
    const cut = resolveSectionPlane(
      { enabled: true, normal: { x: 0, y: 1, z: 0 }, offset: 0.25 },
      box,
    )!
    const anchor = sectionAnchor(box, cut.plane)
    expect(cut.plane.distanceToPoint(anchor)).toBeCloseTo(0, 9)
    expect(anchor.x).toBeCloseTo(5, 9)
    expect(anchor.z).toBeCloseTo(15, 9)
  })
})

describe('surfaceUnderRay', () => {
  const rayDown = () => {
    const raycaster = new Raycaster()
    raycaster.set(new Vector3(0, 0, 50), new Vector3(0, 0, -1))
    return raycaster
  }

  it('finds the part and reports the normal in world space', () => {
    const scene = new Group()
    const part = new Mesh(new BoxGeometry(10, 10, 10))
    // Turned over, so an object-space normal would be the wrong answer.
    part.rotation.x = Math.PI
    scene.add(part)
    scene.updateMatrixWorld(true)

    const hit = surfaceUnderRay(rayDown(), scene)
    expect(hit).not.toBeNull()
    expect(hit!.point.z).toBeCloseTo(5, 9)
    expect(hit!.normal.z).toBeCloseTo(1, 9)
  })

  it('looks through an overlay to the part behind it', () => {
    const scene = new Group()
    const part = new Mesh(new BoxGeometry(10, 10, 10))
    const overlay = new Group()
    overlay.userData[EXCLUDE_FROM_FRAME] = true
    const sheet = new Mesh(new BoxGeometry(40, 40, 1))
    sheet.position.z = 20
    overlay.add(sheet)
    scene.add(part, overlay)
    scene.updateMatrixWorld(true)

    const hit = surfaceUnderRay(rayDown(), scene)
    expect(hit!.point.z).toBeCloseTo(5, 9)
  })

  it('looks through a hidden mesh, which three itself would hit', () => {
    const scene = new Group()
    const part = new Mesh(new BoxGeometry(10, 10, 10))
    const hidden = new Mesh(new BoxGeometry(40, 40, 1))
    hidden.position.z = 20
    hidden.visible = false
    scene.add(part, hidden)
    scene.updateMatrixWorld(true)

    expect(surfaceUnderRay(rayDown(), scene)!.point.z).toBeCloseTo(5, 9)
  })

  it('reports nothing for a ray that hits only overlays', () => {
    const scene = new Group()
    const overlay = new Mesh(new BoxGeometry(10, 10, 10))
    overlay.userData[EXCLUDE_FROM_FRAME] = true
    scene.add(overlay)
    scene.updateMatrixWorld(true)

    expect(surfaceUnderRay(rayDown(), scene)).toBeNull()
  })
})
