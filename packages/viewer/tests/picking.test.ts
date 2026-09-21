import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { PartModel } from '../src/model/types.js'
import { buildPick, focusForPick, viewDirection } from '../src/render/picking.js'
import { cubeModel } from './fixtures.js'

/**
 * A click resolves to five to eight readings and the viewer puts one of them
 * up. That is a default, not a decision, so what is checked here is that the
 * alternatives survive the trip — and that the ranking is the one the cube's
 * measured structure calls for.
 */

const PZ = 0 // +Z, in the cube's candidateDirections
const NZ = 1 // −Z

function pickOn(
  model: PartModel,
  region: number,
  options: Partial<Parameters<typeof buildPick>[0]> = {},
) {
  return buildPick({
    model,
    region,
    triangleIndex: region * 2,
    point: [0, 0, 0],
    normal: [0, 0, 1],
    ...options,
  })
}

const typeOf = (model: PartModel, tag: string | null) =>
  model.features.find((feature) => feature.tag === tag)?.featureType

describe('buildPick', () => {
  it('carries every owner alongside the one it ranked first', () => {
    const model = cubeModel()
    const pick = pickOn(model, 3)

    // Eight readings own this face. A consumer handed only `best` could not
    // offer the seven it discarded.
    expect(pick.owners).toHaveLength(8)
    expect(pick.ranked).toHaveLength(8)
    expect(pick.best).toBe(pick.ranked[0])
    expect(new Set(pick.ranked)).toEqual(new Set(pick.owners))
  })

  it('preserves a browser pointer location when a caller supplies one', () => {
    const pick = pickOn(cubeModel(), 3, { pointer: { clientX: 120, clientY: 48 } })

    expect(pick.pointer).toEqual({ clientX: 120, clientY: 48 })
  })

  it('resolves a face to the reading that faces the camera', () => {
    const model = cubeModel()

    const fromAbove = pickOn(model, 3, { viewDirection: { x: 0, y: 0, z: 1 } })
    const fromTheSide = pickOn(model, 3, { viewDirection: { x: 0, y: 1, z: 0 } })

    expect(typeOf(model, fromAbove.best)).toBe('wall')
    expect(
      model.features.find((feature) => feature.tag === fromAbove.best)?.machiningDirection,
    ).toEqual({ x: 0, y: 0, z: 1 })
    expect(
      model.features.find((feature) => feature.tag === fromTheSide.best)?.machiningDirection,
    ).toEqual({ x: 0, y: 1, z: 0 })
  })

  it('scopes to an active direction, filtering rather than reordering', () => {
    const model = cubeModel()
    const pick = pickOn(model, 3, { activeDirection: PZ })

    expect(pick.owners).toHaveLength(8)
    expect(pick.ranked).toHaveLength(2)
    // A profile traces a boundary rather than cutting a surface, so it never
    // wins the surface it traces.
    expect(pick.ranked.map((tag) => typeOf(model, tag))).toEqual(['wall', 'profile'])
  })

  /**
   * Reachable, not hypothetical: with `+Z` active, the bottom of the cube
   * belongs to no feature at all. "Nothing here in this direction" is a real
   * answer, and it must not read as a click that missed the part.
   */
  it('picks to nothing on a face the active direction cannot reach', () => {
    const model = cubeModel()
    const pick = pickOn(model, 0, { activeDirection: PZ })

    expect(pick.region).toBe(0)
    expect(pick.owners).toHaveLength(5)
    expect(pick.ranked).toEqual([])
    expect(pick.best).toBeNull()
  })

  it('reports modifiers rather than interpreting them', () => {
    const model = cubeModel()

    expect(pickOn(model, 3).modifiers).toEqual({
      alt: false,
      ctrl: false,
      meta: false,
      shift: false,
      secondary: false,
    })
    expect(
      pickOn(model, 3, {
        modifiers: { alt: false, ctrl: false, meta: true, shift: false, secondary: false },
      }).modifiers.meta,
    ).toBe(true)
  })

  it('names the direction the two ±Z faces are cut from', () => {
    const model = cubeModel()

    expect(pickOn(model, 0, { activeDirection: NZ }).ranked).toHaveLength(1)
    expect(typeOf(model, pickOn(model, 0, { activeDirection: NZ }).best)).toBe('face')
  })
})

describe('viewDirection', () => {
  it('points from the target toward the camera', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 10)

    expect(viewDirection(camera, new Vector3())).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('falls back rather than dividing by zero when the camera sits on its target', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(1, 2, 3)

    expect(viewDirection(camera, new Vector3(1, 2, 3))).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('focusForPick', () => {
  it('walks the readings when the same face is clicked again', () => {
    const model = cubeModel()
    const pick = pickOn(model, 3)

    const visited: Array<string | null> = []
    let focus: string | null = null
    for (let click = 0; click < pick.ranked.length; click += 1) {
      focus = focusForPick(pick, click === 0 ? null : 3, focus)
      visited.push(focus)
    }

    // Eight clicks visit all eight readings and the ninth lands back at the
    // start — an escape hatch that does not reach everything is not one.
    expect(visited[0]).toBe(pick.best)
    expect(new Set(visited).size).toBe(8)
    expect(focusForPick(pick, 3, focus)).toBe(pick.ranked[0])
  })

  it('starts from the best answer when a different face is clicked', () => {
    const model = cubeModel()
    const pick = pickOn(model, 3)

    expect(focusForPick(pick, 1, pick.ranked[4]!)).toBe(pick.best)
  })

  it('focuses nothing when the scope leaves no reading', () => {
    const model = cubeModel()
    const pick = pickOn(model, 0, { activeDirection: PZ })

    expect(focusForPick(pick, 0, null)).toBeNull()
  })
})
