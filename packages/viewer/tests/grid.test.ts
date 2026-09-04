import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { gridFor, gridGeometry, gridSpec } from '../src/render/grid.js'

/**
 * The ground grid is sized from the part, so its two failure modes are a step
 * nobody can read and a plane nobody can bound. Both are arithmetic on a `Box3`,
 * which is why they are pinned here rather than by rendering one.
 */

const box = (x: number, y: number, z = 10) => new Box3(new Vector3(0, 0, 0), new Vector3(x, y, z))

describe('gridSpec', () => {
  /**
   * The Engine emits millimetres and says nothing about scale, so the step is a
   * 1-2-5 progression rather than a fixed size — a fixed grid is invisible under
   * a 900 mm plate and a solid wash under a 12 mm insert.
   */
  it('picks a step a machinist reads without doing arithmetic', () => {
    expect(gridSpec(box(50.8, 50.8)).step).toBe(5)
    expect(gridSpec(box(900, 900)).step).toBe(50)
    expect(gridSpec(box(12, 12)).step).toBe(1)
  })

  it('rounds the step down, so the part gets a grid rather than a border', () => {
    // Rounding up would leave a 50.8 mm cube on 10 mm cells: five squares.
    expect(50.8 / gridSpec(box(50.8, 50.8)).step).toBeGreaterThanOrEqual(10)
  })

  it('sits on the bottom of the part rather than on z = 0', () => {
    const raised = new Box3(new Vector3(0, 0, -30), new Vector3(50, 50, -10))

    // A part modelled about its own centre would otherwise be sliced in half by
    // its own grid.
    expect(gridSpec(raised).z).toBe(-30)
  })

  it('spans a whole number of cells past the part', () => {
    const spec = gridSpec(box(50.8, 50.8))

    expect(spec.extent % spec.step).toBeCloseTo(0, 9)
    expect(spec.extent * 2).toBeGreaterThan(50.8)
  })
})

describe('gridFor', () => {
  /**
   * `useContentBox` is empty until the scene has been measured, and `Grid` is
   * mounted before that happens. This is the assertion that fails if the check
   * moves back into the component, where nothing in this package can reach it.
   */
  it('draws nothing for an unmeasured scene', () => {
    expect(gridFor(new Box3())).toBeNull()
  })

  /**
   * Why the case above exists, stated as the failure rather than as a rule. An
   * empty `Box3` measures as zero size at the origin but keeps `min.z` at
   * `+Infinity`, so every vertex lands on a plane at infinity and three.js
   * cannot bound the result — it reports "Computed radius is NaN" and does it
   * on every mount.
   */
  it('would otherwise build geometry three.js cannot bound', () => {
    const spec = gridSpec(new Box3())
    expect(spec.z).toBe(Number.POSITIVE_INFINITY)

    const unbounded = gridGeometry(spec)
    unbounded.computeBoundingSphere()

    expect(unbounded.boundingSphere?.radius).toBeNaN()
  })

  it('builds a grid three.js can bound for a measured part', () => {
    const geometry = gridFor(box(50.8, 50.8))
    if (geometry === null) throw new Error('a measured part gets a grid')
    geometry.computeBoundingSphere()

    expect(geometry.boundingSphere?.radius).toBeGreaterThan(0)
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
  })

  it('honours a step and an extent the caller gives', () => {
    const geometry = gridFor(box(50.8, 50.8), { step: 10, extent: 40 })
    if (geometry === null) throw new Error('a measured part gets a grid')

    // Nine lines each way over an 80 mm span on 10 mm cells, two vertices each.
    expect(geometry.getAttribute('position').count).toBe(9 * 2 * 2)
  })
})
