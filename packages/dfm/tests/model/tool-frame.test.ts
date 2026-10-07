import { describe, expect, it } from 'vitest'
import { pinchLabel, pinchMark, MAX_DRAWN_TOOL_MM } from '../../src/model/pinch-mark.js'
import { placePinchTool, type FaceTriangles } from '../../src/model/tool-frame.js'

type P = [number, number, number]

/** A quad as two triangles, each with the quad's outward normal. */
const quad = (a: P, b: P, c: P, d: P, normal: P): { positions: number[]; normals: number[] } => ({
  positions: [...a, ...b, ...c, ...a, ...c, ...d],
  normals: [...normal, ...normal],
})

/**
 * A pocket 20 long in x and 6 wide in y, 10 deep below z = 0, cut from +Z:
 * its floor and four walls, each facing into the cut. Moved by `by`.
 */
const pocket = (by: P = [0, 0, 0]): FaceTriangles => {
  const faces = [
    quad([0, 0, -10], [20, 0, -10], [20, 6, -10], [0, 6, -10], [0, 0, 1]),
    quad([0, 0, -10], [0, 6, -10], [0, 6, 0], [0, 0, 0], [1, 0, 0]),
    quad([20, 0, -10], [20, 6, -10], [20, 6, 0], [20, 0, 0], [-1, 0, 0]),
    quad([0, 0, -10], [20, 0, -10], [20, 0, 0], [0, 0, 0], [0, 1, 0]),
    quad([0, 6, -10], [20, 6, -10], [20, 6, 0], [0, 6, 0], [0, -1, 0]),
  ]
  return {
    positions: faces
      .flatMap((face) => face.positions)
      .map((value, index) => value + by[index % 3]!),
    normals: faces.flatMap((face) => face.normals),
  }
}

const UP = { x: 0, y: 0, z: 1 }

/**
 * The widest tool, 6 across, against the long walls at x = 4 — written in a
 * datasheet frame whose x runs along the part's y and whose y along its x,
 * which only one of the sixteen frames reproduces.
 */
const mark = { discs: [{ x: 3, y: 4, diameter: 6 }], zMin: -10, zMax: 0 }

describe('placePinchTool', () => {
  it("finds the datasheet's frame and stands the tool on the floor, in the tight place", () => {
    const tool = placePinchTool(mark, pocket(), UP)
    expect(tool).not.toBeNull()
    expect(tool!.base.x).toBeCloseTo(4)
    expect(tool!.base.y).toBeCloseTo(3)
    expect(tool!.base.z).toBeCloseTo(-10)
    expect([tool!.axis.x, tool!.axis.y, tool!.axis.z]).toEqual([0, 0, 1])
    expect(tool!.diameter).toBe(6)
    expect(tool!.height).toBe(10)
    expect(tool!.cornerRadius).toBe(0)
    // Toward the wall it touches: across y, one way or the other.
    expect(Math.abs(tool!.across.y)).toBeCloseTo(1)
  })

  it('places it where the part is drawn when the drawing moved the CAD zero', () => {
    const tool = placePinchTool(mark, pocket([100, -50, 7]), UP, { x: 100, y: -50, z: 7 })
    expect(tool!.base.x).toBeCloseTo(104)
    expect(tool!.base.y).toBeCloseTo(-47)
    expect(tool!.base.z).toBeCloseTo(-3)
  })

  it('stands the floor at zMin with the nearest frame when no frame matches the depth', () => {
    const tool = placePinchTool({ ...mark, zMin: -12, zMax: -2 }, pocket(), UP)
    expect(tool).not.toBeNull()
    expect(tool!.base.z).toBeCloseTo(-10)
  })

  it('draws the tightest disc, rounding a corner no more than the tool', () => {
    const tool = placePinchTool(
      { ...mark, discs: [{ x: 3, y: 10, diameter: 6.5 }, ...mark.discs], corner: 5 },
      pocket(),
      UP,
    )
    expect(tool!.diameter).toBe(6)
    expect(tool!.cornerRadius).toBe(3)
  })

  it('has nothing to draw with no faces or no discs', () => {
    expect(placePinchTool(mark, { positions: [], normals: [] }, UP)).toBeNull()
    expect(placePinchTool({ ...mark, discs: [] }, pocket(), UP)).toBeNull()
  })
})

describe('pinchMark', () => {
  const datasheet = (diameters: number[]) => ({
    zMin: -10,
    zMax: 0,
    pinchPoints: diameters.map((diameter, at) => ({ center: { x: at, y: 0 }, diameter })),
  })

  it('keeps the discs a tool can stand in, and rounds a walled floor fillet into a bull nose', () => {
    const read = pinchMark(
      datasheet([0, 6, MAX_DRAWN_TOOL_MM + 1]),
      { filletRadius: 0.5 },
      'pocket',
    )
    expect(read?.discs.map((disc) => disc.diameter)).toEqual([6])
    expect(read?.corner).toBe(0.5)
  })

  it("does not take a surface's fillet radius for a corner, and has nothing for sharp corners alone", () => {
    expect(
      pinchMark(datasheet([6]), { filletRadius: 2 }, 'contour_surface')?.corner,
    ).toBeUndefined()
    expect(pinchMark(datasheet([0]), undefined, 'pocket')).toBeNull()
  })

  it('labels the tightest disc, and says the kind of tool and how many places', () => {
    const read = pinchMark(datasheet([6, 8]), { filletRadius: 0.5 }, 'pocket')!
    expect(pinchLabel(read, 'mm')).toEqual({
      label: '⌀ 6.000 mm',
      note: 'bull nose R 0.500 mm · 2 places',
    })
    expect(
      pinchLabel({ ...read, corner: undefined, discs: [read.discs[0]!], unresolved: true }, 'inch'),
    ).toEqual({
      label: '≤ ⌀ 0.236 in',
      note: 'widest tool',
    })
  })
})

describe('placePinchTool on a big feature', () => {
  it('reads a feature of hundreds of thousands of points without overflowing the stack', () => {
    const base = pocket()
    const copies = 20_000
    const positions = new Float32Array(base.positions.length * copies)
    const normals = new Float32Array(base.normals.length * copies)
    for (let at = 0; at < copies; at++) {
      positions.set(base.positions as ArrayLike<number>, at * base.positions.length)
      normals.set(base.normals as ArrayLike<number>, at * base.normals.length)
    }
    expect(() => placePinchTool(mark, { positions, normals }, UP)).not.toThrow()
  })
})
