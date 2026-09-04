import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { GAP, LENGTH, arrowPlacement } from '../src/render/directions.js'

/**
 * An arrow says "the tool comes from here", so the one thing it must never do
 * is start inside the part it is pointing at.
 */

const cube = () => new Box3(new Vector3(0, 0, 0), new Vector3(50.8, 50.8, 50.8))

describe('arrowPlacement', () => {
  it('puts the tip outside the part, clear of the surface', () => {
    const box = cube()
    const { tip } = arrowPlacement({ x: 0, y: 0, z: 1 }, box)

    expect(tip.z).toBeGreaterThan(box.max.z)
    expect(tip.x).toBeCloseTo(25.4, 9)
    expect(tip.y).toBeCloseTo(25.4, 9)
  })

  /**
   * The reason the exit distance is `halfExtent / |component|` rather than the
   * bounding radius: real reports carry tilted directions, one of them a 36°
   * five-axis setup, and an axis-aligned simplification buries those arrows in
   * the part.
   */
  it('clears the part for a direction that is not an axis', () => {
    const box = cube()
    const tilted = { x: 0.587_785_252_292_476_9, y: 0, z: 0.809_016_994_374_944_8 }

    const { tip } = arrowPlacement(tilted, box)

    // Outside the box on the axis it leaves through, and still on its own ray.
    expect(box.containsPoint(tip)).toBe(false)
    const fromCentre = tip
      .clone()
      .sub(new Vector3(25.4, 25.4, 25.4))
      .normalize()
    expect(fromCentre.x).toBeCloseTo(tilted.x, 6)
    expect(fromCentre.z).toBeCloseTo(tilted.z, 6)
  })

  it('leaves the same gap however flat the part is', () => {
    const plate = new Box3(new Vector3(0, 0, 0), new Vector3(200, 200, 2))
    const { tip } = arrowPlacement({ x: 0, y: 0, z: 1 }, plate)

    // A plate exits through its thin axis at 1 mm, so the clearance has to come
    // from the part's overall size or the arrow lands on the surface.
    expect(tip.z).toBeGreaterThan(plate.max.z)
  })

  it('scales the arrow with the part rather than the viewport', () => {
    const small = arrowPlacement(
      { x: 0, y: 0, z: 1 },
      new Box3(new Vector3(), new Vector3(2, 2, 2)),
    )
    const large = arrowPlacement({ x: 0, y: 0, z: 1 }, cube())

    expect(large.length / small.length).toBeCloseTo(50.8 / 2, 6)
    expect(small.length).toBeCloseTo(Math.sqrt(3) * LENGTH, 6)
  })

  it('survives a zero direction rather than producing NaN', () => {
    const { tip } = arrowPlacement({ x: 0, y: 0, z: 0 }, cube())

    expect(Number.isFinite(tip.x + tip.y + tip.z)).toBe(true)
  })

  it('keeps the gap proportional, so it reads the same on any part', () => {
    const box = cube()
    const radius = box.getSize(new Vector3()).multiplyScalar(0.5).length()
    const { tip } = arrowPlacement({ x: 0, y: 0, z: 1 }, box)

    expect(tip.z - box.max.z).toBeCloseTo(radius * GAP, 6)
  })

  /**
   * The third seam that reads `useContentBox`, and the one that survives an
   * unmeasured scene by arithmetic rather than by a guard: `radius` falls back
   * to 1 and a zero-extent box gives a finite exit distance. Nothing else pins
   * that, so an arrow flying to infinity would take the whole scene's bounding
   * sphere with it and never be traced back to here.
   */
  it('stays finite for an unmeasured scene', () => {
    const { tip, length } = arrowPlacement({ x: 0, y: 0, z: 1 }, new Box3())

    expect(Number.isFinite(tip.x)).toBe(true)
    expect(Number.isFinite(tip.y)).toBe(true)
    expect(Number.isFinite(tip.z)).toBe(true)
    expect(Number.isFinite(length)).toBe(true)
    expect(length).toBeGreaterThan(0)
  })
})
