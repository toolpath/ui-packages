import {
  BufferGeometry,
  type Color,
  Float32BufferAttribute,
  type Mesh,
  type MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  type ShaderMaterial,
  Vector3,
} from 'three'
import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { buildRegionIndex } from '../src/model/region-index.js'
import type { PartModel, PartModelFeature, PartModelRegion, Vec3 } from '../src/model/types.js'
import { MEASURE_RENDER_ORDER } from '../src/render/measure.js'
import { type PartObject, createPart } from '../src/render/part.js'
import {
  SHARP_CORNER_STENCIL_BIT,
  type SurfaceCreases,
  type SharpCorner,
  findSharpCorners,
  sharpCornerBands,
  sharpCornerKey,
  sharpCornerPositions,
  surfaceCreases,
} from '../src/render/sharp-corners.js'
import { DEFAULT_THEME, resolveTheme } from '../src/render/theme.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

/**
 * A sharp corner is a crease between two surfaces, measured from the triangles
 * either side of it: how far apart their normals are, and whether each one's
 * far corner stands in front of the other's plane (an inside corner) or behind
 * it (an outside edge).
 */

type Triangle = readonly [number, number, number, number, number, number, number, number, number]

function mesh(...triangles: Triangle[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flat(), 3))
  return geometry
}

/** One region per triangle, each its own surface unless `origins` joins them. */
function regions(count: number, origins?: readonly number[]): { regions: PartModelRegion[] } {
  return {
    regions: Array.from({ length: count }, (_, idx) => ({
      idx,
      splitOrigin: origins?.[idx] ?? idx,
      shapeKind: 'Plane',
      area: 1,
      triangles: { start: idx, end: idx + 1 },
    })),
  }
}

/** Faces up, `+Z`, with an edge from the origin along `+Y`. */
const FLOOR: Triangle = [0, 0, 0, 1, 0, 0, 0, 1, 0]
/** Stands up off that edge facing `+X`, over the floor: an inside corner. */
const WALL_UP: Triangle = [0, 0, 0, 0, 1, 0, 0, 0, 1]
/** Drops down off it facing `-X`, away from the floor: a box's outside edge. */
const WALL_DOWN: Triangle = [0, 0, 0, 0, 1, 0, 0, 0, -1]

const TEN_DEGREES = Math.tan((10 * Math.PI) / 180)
/** Carries the floor on past the edge, turned up by 10°. */
const RISE: Triangle = [0, 0, 0, 0, 1, 0, -1, 0, TEN_DEGREES]

describe('surfaceCreases', () => {
  it('reads an inside corner as concave and square', () => {
    const creases = surfaceCreases(mesh(FLOOR, WALL_UP), regions(2))

    expect(creases.count).toBe(1)
    expect(creases.concave[0]).toBe(1)
    expect(creases.angles[0]).toBeCloseTo(90, 4)
    // The faces either side, so a flagged feature can claim the corner, and
    // the corner of each that is off the edge, for the way across it.
    expect(Array.from(creases.regions).sort()).toEqual([0, 1])
    const fars = [Array.from(creases.fars.subarray(0, 3)), Array.from(creases.fars.subarray(3, 6))]
    expect(fars).toContainEqual([1, 0, 0])
    expect(fars).toContainEqual([0, 0, 1])
  })

  it('reads an outside edge as convex', () => {
    const creases = surfaceCreases(mesh(FLOOR, WALL_DOWN), regions(2))

    expect(creases.count).toBe(1)
    expect(creases.concave[0]).toBe(0)
    expect(creases.angles[0]).toBeCloseTo(90, 4)
  })

  it('measures a shallow seam as shallow', () => {
    const creases = surfaceCreases(mesh(FLOOR, RISE), regions(2))

    expect(creases.angles[0]).toBeCloseTo(10, 3)
  })

  it('records the shared edge itself', () => {
    const { positions } = surfaceCreases(mesh(FLOOR, WALL_UP), regions(2))

    const ends = [Array.from(positions.subarray(0, 3)), Array.from(positions.subarray(3, 6))]
    expect(ends).toContainEqual([0, 0, 0])
    expect(ends).toContainEqual([0, 1, 0])
  })

  it('finds nothing inside one surface, however sharp the fold', () => {
    // Two regions split from one face are one surface to look at, as the edge
    // overlay already treats them.
    expect(surfaceCreases(mesh(FLOOR, WALL_UP), regions(2, [7, 7])).count).toBe(0)
  })

  it('pairs corners that differ by float noise', () => {
    const noisy: Triangle = [1e-6, 0, 0, 0, 1 - 1e-6, 0, 0, 0, 1]

    expect(surfaceCreases(mesh(FLOOR, noisy), regions(2)).count).toBe(1)
  })

  it('skips an edge only one triangle has, rather than guessing its fold', () => {
    const apart: Triangle = [0, 0, 0.5, 0, 1, 0.5, 0, 0, 1]

    expect(surfaceCreases(mesh(FLOOR, apart), regions(2)).count).toBe(0)
  })

  it('finds nothing on an indexed mesh, which has no per-region triangles to pair', () => {
    const geometry = mesh(FLOOR, WALL_UP)
    geometry.setIndex([0, 1, 2, 3, 4, 5])

    expect(surfaceCreases(geometry, regions(2)).count).toBe(0)
  })

  /**
   * The real Engine cube: 12 square outside edges of 50.8 mm and nothing else.
   * Every diagonal is inside one face, and every one of the cube's edges is met
   * by exactly one triangle from each side.
   */
  it('reads the real cube as twelve square outside edges', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)

    const creases = surfaceCreases(geometry, model)

    expect(creases.count).toBe(12)
    expect(Array.from(creases.concave)).toEqual(Array(12).fill(0))
    for (const angle of creases.angles) expect(angle).toBeCloseTo(90, 3)
    expect(totalLength(creases.positions)).toBeCloseTo(12 * 50.8, 2)
  })
})

/**
 * Five creases, hand-made, around a pocket (regions 0 floor, 1–2 walls) cut
 * from +Z, a boss (6–7) and a side face (5):
 *
 * 0. the square corner between the pocket's walls, up Z;
 * 1. the pocket's floor meeting a wall, along X;
 * 2. a square outside edge, up Z;
 * 3. a shallower inside corner of the pocket, 25°, leaning 10° off Z;
 * 4. the boss's own inside corner, up Z.
 */
const CREASES: SurfaceCreases = {
  count: 5,
  positions: new Float32Array([
    ...[0, 0, 0, 0, 0, 10],
    ...[0, 0, 0, 10, 0, 0],
    ...[5, 5, 0, 5, 5, 10],
    ...[0, 0, 0, 0, 10 * TEN_DEGREES, 10],
    ...[20, 0, 0, 20, 0, 10],
  ]),
  angles: new Float32Array([90, 90, 90, 25, 90]),
  concave: new Uint8Array([1, 1, 0, 1, 1]),
  regions: new Int32Array([1, 2, 0, 1, 3, 4, 2, 5, 6, 7]),
  // Only drawing reads them.
  fars: new Float32Array(30),
}

const UP = { x: 0, y: 0, z: 1 }

function feature(
  tag: string,
  regionIdxs: number[],
  machiningDirection: Vec3 = UP,
): PartModelFeature {
  return { tag, featureType: 'pocket', machiningDirection, axis: null, regionIdxs }
}

/** The model the creases belong to: eight one-triangle regions and the features over them. */
function creaseModel(
  features: PartModelFeature[] = [feature('pocket', [0, 1, 2]), feature('boss', [6, 7])],
): Pick<PartModel, 'features' | 'regionIndex'> {
  const { regions: table } = regions(8)
  return { features, regionIndex: buildRegionIndex({ regions: table, features, triangleCount: 8 }) }
}

const segmentCount = (positions: Float32Array) => positions.length / 6

describe('sharpCornerPositions', () => {
  it('draws nothing the DFM rules did not flag', () => {
    expect(segmentCount(sharpCornerPositions(CREASES, creaseModel(), { features: [] }))).toBe(0)
  })

  /**
   * The pocket's corners up its machining direction: the square one and the
   * shallow one. Not its floor edge, which runs across the direction and is a
   * flat end mill's ordinary work; not the outside edge; not the boss's corner,
   * which nothing flagged.
   */
  it("draws a flagged feature's inside corners along its machining direction, and nothing else", () => {
    const drawn = sharpCornerPositions(CREASES, creaseModel(), { features: ['pocket'] })

    expect(segmentCount(drawn)).toBe(2)
    expect(Array.from(drawn.subarray(0, 6))).toEqual([0, 0, 0, 0, 0, 10])
  })

  it('draws each flagged feature, and only those', () => {
    expect(segmentCount(sharpCornerPositions(CREASES, creaseModel(), { features: ['boss'] }))).toBe(
      1,
    )
    expect(
      segmentCount(sharpCornerPositions(CREASES, creaseModel(), { features: ['pocket', 'boss'] })),
    ).toBe(3)
  })

  it("follows each feature's own direction, either way round", () => {
    // The floor edge runs along X: a corner for a feature cut from the side.
    const model = creaseModel([feature('slot', [0], { x: -1, y: 0, z: 0 })])

    expect(segmentCount(sharpCornerPositions(CREASES, model, { features: ['slot'] }))).toBe(1)
  })

  it('matches tags without regard to case', () => {
    expect(
      segmentCount(sharpCornerPositions(CREASES, creaseModel(), { features: ['POCKET'] })),
    ).toBe(2)
  })
})

/**
 * A corner as the hover card names it: the flagged feature it belongs to, how
 * far it runs, the angle between its faces — whole, however many pieces the
 * mesh cut it into.
 */
describe('findSharpCorners', () => {
  /** A pocket corner up Z split in two at mid-height, and a second corner beside it. */
  const SPLIT: SurfaceCreases = {
    count: 3,
    positions: new Float32Array([
      ...[0, 0, 0, 0, 0, 5],
      ...[0, 0, 5, 0, 0, 10],
      ...[10, 0, 0, 10, 0, 10],
    ]),
    angles: new Float32Array([90, 90, 60]),
    concave: new Uint8Array([1, 1, 1]),
    regions: new Int32Array([1, 2, 1, 2, 0, 1]),
    fars: new Float32Array(18),
  }

  it('joins the pieces of one corner, and keeps separate corners apart', () => {
    const corners = findSharpCorners(SPLIT, creaseModel(), { features: ['pocket'] })

    expect(corners).toHaveLength(2)
    const [split, other] = corners
    expect(split).toMatchObject({
      index: 0,
      feature: 'pocket',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 10 },
      segments: [0, 1],
    })
    expect(split!.length).toBeCloseTo(10)
    expect([...split!.regions].sort()).toEqual([1, 2])
    expect(other!.index).toBe(1)
  })

  it('gives the angle between the faces, not between their normals', () => {
    const [square, sixty] = findSharpCorners(SPLIT, creaseModel(), { features: ['pocket'] })

    expect(square!.angle).toBeCloseTo(90)
    // The normals turn by 60°, so the faces open at 120°.
    expect(sixty!.angle).toBeCloseTo(120)
  })

  it("names the feature as the part model spells it, whatever the flag's case", () => {
    const [corner] = findSharpCorners(SPLIT, creaseModel(), { features: ['POCKET'] })

    expect(corner!.feature).toBe('pocket')
  })
})

describe('sharpCornerKey', () => {
  it('is the same for the same features, in any order or case', () => {
    expect(sharpCornerKey({ features: ['b', 'A'] })).toBe(sharpCornerKey({ features: ['a', 'B'] }))
  })

  it('differs when the features do', () => {
    expect(sharpCornerKey({ features: ['a'] })).not.toBe(sharpCornerKey({ features: ['b'] }))
  })
})

/**
 * A corner is drawn as a band on each face either side of it, so it is seen
 * exactly where those faces are and stops where the corner does. What the
 * geometry has to get right is which way is across each face, and how far.
 */
describe('sharpCornerBands', () => {
  const CORNER: SharpCorner = {
    index: 0,
    feature: 'corner',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 1, z: 0 },
    length: 1,
    angle: 90,
    regions: [0, 1],
    segments: [0],
  }
  const bands = () => {
    const creases = surfaceCreases(mesh(FLOOR, WALL_UP), regions(2))
    return sharpCornerBands(creases, [CORNER])
  }
  const attribute = (geometry: BufferGeometry, name: string, vertex: number) =>
    new Vector3().fromBufferAttribute(geometry.getAttribute(name), vertex)

  it('puts a strip on each face, every vertex on the corner itself', () => {
    const geometry = bands()

    expect(geometry.getAttribute('position').count).toBe(8)
    expect(geometry.index?.count).toBe(12)
    for (let vertex = 0; vertex < 8; vertex += 1) {
      // On the corner, (0, 0, 0)–(0, 1, 0): the shader moves the outer ones across.
      const point = attribute(geometry, 'position', vertex)
      expect(point.x).toBe(0)
      expect(point.z).toBe(0)
    }
  })

  it('steps across each face, square to the corner, into the face', () => {
    const geometry = bands()
    const across = [0, 4].map((vertex) => attribute(geometry, 'aPerp', vertex).toArray())

    // Out over the floor along +X, and up the wall along +Z.
    expect(across).toContainEqual([1, 0, 0])
    expect(across).toContainEqual([0, 0, 1])
  })

  it('moves only the outer edge of each strip, and never past the face', () => {
    const geometry = bands()
    const side = geometry.getAttribute('aSide')
    const reach = geometry.getAttribute('aReach')

    expect(Array.from({ length: 8 }, (_, vertex) => side.getX(vertex))).toEqual([
      0, 0, 1, 1, 0, 0, 1, 1,
    ])
    // Each triangle reaches one unit off the corner.
    for (let vertex = 0; vertex < 8; vertex += 1) expect(reach.getX(vertex)).toBe(1)
  })

  it('marks every vertex with its corner, for drawing the hovered one up', () => {
    const owner = bands().getAttribute('aCorner')

    expect(Array.from({ length: 8 }, (_, vertex) => owner.getX(vertex))).toEqual(Array(8).fill(0))
  })

  it('draws nothing for no segments', () => {
    const creases = surfaceCreases(mesh(FLOOR, WALL_UP), regions(2))

    expect(sharpCornerBands(creases, []).getAttribute('position').count).toBe(0)
  })
})

describe('createPart — sharp corners', () => {
  /** A floor and a wall meeting in an inside corner along Y, one feature cut along Y over both. */
  function corner(): PartObject {
    // The floor alone as well, for something to focus on.
    const features = [feature('corner', [0, 1], { x: 0, y: 1, z: 0 }), feature('floor', [0])]
    const { regions: table } = regions(2)
    const model: PartModel = {
      partId: 'corner',
      kernelVersion: '0.3.0',
      features,
      regions: table,
      candidateDirections: [{ x: 0, y: 1, z: 0 }],
      mesh: { pointCount: 6, triangleCount: 2, glbUrl: null, stlUrl: null, thumbnailUrl: null },
      regionIndex: buildRegionIndex({ regions: table, features, triangleCount: 2 }),
      warnings: [],
    }
    return createPart(model, mesh(FLOOR, WALL_UP), DEFAULT_THEME)
  }

  type Band = Mesh<BufferGeometry, ShaderMaterial>

  /** The two draws — far and near — of the sharp-corner group, once it exists. */
  const lines = (part: PartObject): Band[] =>
    ['sharpCornersFar', 'sharpCornersNear'].flatMap((name) => {
      const band = part.object.getObjectByName(name)
      return band ? [band as Band] : []
    })

  /** The copy of the part that lays its depth down for the bands. */
  const depthOf = (part: PartObject) =>
    part.object.getObjectByName('sharpCornersDepth') as
      | Mesh<BufferGeometry, MeshBasicMaterial>
      | undefined

  it('builds nothing until something is flagged', () => {
    const part = corner()

    part.setSharpCorners({ features: [] })

    expect(part.object.children).toHaveLength(3)
  })

  it('draws the flagged corner, near and far', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })

    const [far, near] = lines(part)
    expect(near?.parent?.visible).toBe(true)
    // One segment: a strip on each face, two triangles each.
    expect(near?.geometry.index?.count).toBe(12)
    expect(far?.geometry).toBe(near?.geometry)
    // Strong where it can be seen, faint where the part stands in front of it.
    const opacity = (band: Mesh<BufferGeometry, ShaderMaterial>) =>
      band.material.uniforms['opacity']!.value as number
    expect(opacity(near!)).toBeGreaterThan(opacity(far!))
  })

  /**
   * The faint far draw was a string of beads: a curve's segments overlap at
   * their round ends, and a translucent pixel drawn twice is twice as dark.
   */
  it('draws each pixel once, the line in view first', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })

    const [far, near] = lines(part)
    for (const line of [near!, far!]) {
      expect(line.material.stencilWrite).toBe(true)
      expect(line.material.stencilRef).toBe(SHARP_CORNER_STENCIL_BIT)
      expect(line.material.stencilFuncMask).toBe(SHARP_CORNER_STENCIL_BIT)
      expect(line.material.stencilWriteMask).toBe(SHARP_CORNER_STENCIL_BIT)
    }
    expect(near!.renderOrder).toBeLessThan(far!.renderOrder)
  })

  /**
   * A band lies on the face it marks, so the two tie for depth. The bands
   * settle it themselves rather than lean on the part's own offset: a focused
   * face is drawn by a material with none, and there the near and far draws
   * fought, speckling the corner.
   */
  it('pulls its bands toward the camera, to win the tie with any face', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })

    for (const band of lines(part)) {
      expect(band.material.polygonOffset).toBe(true)
      expect(band.material.polygonOffsetFactor).toBeLessThan(0)
      expect(band.material.polygonOffsetUnits).toBeLessThan(0)
    }
  })

  /**
   * In wireframe and focus the part's faded faces write no depth, and every
   * corner read as in view — even one behind the part. There the drawing lays
   * the part's depth down for the bands itself.
   */
  describe("the part's depth, for the bands", () => {
    it('is laid down in wireframe, and not on a solid part', () => {
      const part = corner()
      part.setSharpCorners({ features: ['corner'] })
      expect(depthOf(part)?.visible).toBe(false)

      part.setDisplay('wireframe')
      expect(depthOf(part)?.visible).toBe(true)

      part.setDisplay('solid')
      expect(depthOf(part)?.visible).toBe(false)
    })

    it('is laid down around a focus', () => {
      const part = corner()
      part.setSharpCorners({ features: ['corner'] })

      part.setFocus(['floor'], {})

      expect(depthOf(part)?.visible).toBe(true)
    })

    it('is laid down for corners turned on while already in wireframe', () => {
      const part = corner()
      part.setDisplay('wireframe')

      part.setSharpCorners({ features: ['corner'] })

      expect(depthOf(part)?.visible).toBe(true)
    })

    it("is the part's own geometry, cut by the same section, and draws no colour", () => {
      const part = corner()
      part.setSharpCorners({ features: ['corner'] })
      part.setClippingPlanes([new Plane(new Vector3(0, 0, 1), 0)])

      const depth = depthOf(part)!
      expect(depth.geometry).toBe(part.mesh.geometry)
      expect(depth.material.clippingPlanes).toHaveLength(1)
      expect(depth.material.colorWrite).toBe(false)
      expect(depth.material.depthWrite).toBe(true)
    })

    /**
     * Anything drawn after the depth that tested it would be hidden behind a
     * part that is meant to be see-through. So it comes after the stock and
     * a tool mark (6) and before the measure tool (7), which does not test it.
     */
    it('comes just before the bands, after everything else that tests depth', () => {
      const part = corner()
      part.setSharpCorners({ features: ['corner'] })

      const [far, near] = lines(part)
      const depth = depthOf(part)!
      expect(depth.renderOrder).toBeGreaterThan(MEASURE_RENDER_ORDER - 1)
      expect(depth.renderOrder).toBeLessThan(near!.renderOrder)
      expect(far!.renderOrder).toBeLessThan(MEASURE_RENDER_ORDER)
    })
  })

  it('hides when nothing is flagged, and when switched off', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })
    part.setSharpCorners({ features: [] })
    expect(lines(part)[0]?.parent?.visible).toBe(false)

    part.setSharpCorners({ features: ['corner'] })
    part.setSharpCorners(null)
    expect(lines(part)[0]?.parent?.visible).toBe(false)
  })

  it('draws no corner on a part with none, flagged or not', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
    const part = createPart(model, geometry, DEFAULT_THEME)

    // Every edge of a cube is an outside one.
    part.setSharpCorners({ features: model.features.map((each) => each.tag) })

    expect(lines(part)[0]?.parent?.visible).toBe(false)
  })

  it('lists the corners it draws, and none once off', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })
    expect(part.sharpCorners().map((each) => each.feature)).toEqual(['corner'])

    part.setSharpCorners(null)
    expect(part.sharpCorners()).toEqual([])
  })

  /**
   * The pointer is on a corner when it is on one of the corner's two faces and
   * within a few pixels of it on screen — on the band, a little generously.
   */
  describe('the corner under the pointer', () => {
    const VIEWPORT = { width: 800, height: 600 }
    const camera = new PerspectiveCamera(50, VIEWPORT.width / VIEWPORT.height, 0.1, 100)
    camera.position.set(2, 0.5, 2)
    camera.lookAt(0, 0.5, 0)
    camera.updateMatrixWorld()

    const hovered = (point: Vector3, region = 0) => {
      const part = corner()
      part.setSharpCorners({ features: ['corner'] })
      return part.sharpCornerAt({ point, region }, camera, VIEWPORT)
    }

    it('finds the corner from a point on its face beside it', () => {
      expect(hovered(new Vector3(0.005, 0.5, 0))?.feature).toBe('corner')
    })

    it('finds nothing well away from it', () => {
      expect(hovered(new Vector3(0.5, 0.5, 0))).toBeNull()
    })

    it('finds nothing from a face that is not one of its own', () => {
      expect(hovered(new Vector3(0.005, 0.5, 0), 5)).toBeNull()
    })

    it('finds nothing while the corners are off', () => {
      const part = corner()

      expect(part.sharpCornerAt({ point: new Vector3(), region: 0 }, camera, VIEWPORT)).toBeNull()
    })
  })

  it('marks the hovered corner, and only while it is hovered', () => {
    const part = corner()
    part.setSharpCorners({ features: ['corner'] })
    const hovered = () => lines(part)[0]!.material.uniforms['uHovered']!.value as number

    part.setHoveredSharpCorner(0)
    expect(hovered()).toBe(0)

    part.setHoveredSharpCorner(null)
    expect(hovered()).toBe(-1)
  })

  /**
   * Widening the corner under the pointer looked bad. It is shown the way a
   * hovered face is, in the theme's hover colour, at the width it always has.
   */
  it('shows the hovered corner in the hover colour, at its own width', () => {
    const part = corner()
    part.setSharpCorners({ features: ['corner'] })
    const [band] = lines(part)
    const width = band!.material.uniforms['uHalfWidth']!.value as number

    part.setHoveredSharpCorner(0)

    expect(band!.material.uniforms['uHalfWidth']!.value).toBe(width)
    expect(band!.material.uniforms['uHoverWidth']).toBeUndefined()
    expect((band!.material.uniforms['hoverColor']!.value as Color).getHex()).toBe(
      DEFAULT_THEME.hover,
    )

    part.setTheme(resolveTheme({ hover: 0x00aaff }))
    expect((band!.material.uniforms['hoverColor']!.value as Color).getHex()).toBe(0x00aaff)
  })

  /**
   * A corner lies on its feature's faces, which an application has usually
   * painted for the rule that flagged it, and in the rule's colour it vanished
   * into that paint. A thin dark edge each side lets it show there.
   */
  it('edges every band with a thin dark outline', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })

    for (const band of lines(part)) {
      expect((band.material.uniforms['outline']!.value as Color).getHex()).toBe(0x1f2937)
      // The corner's colour out to here across each half of the band, the outline past it.
      const core = band.material.uniforms['uCore']!.value as number
      expect(core).toBeGreaterThan(0)
      expect(core).toBeLessThan(1)
      expect(band.material.fragmentShader).toContain('smoothstep(uCore')
    }
  })

  it('takes the theme colour', () => {
    const part = corner()

    part.setSharpCorners({ features: ['corner'] })
    part.setTheme(resolveTheme({ sharpCorner: 0x00ff00 }))

    for (const band of lines(part)) {
      expect((band.material.uniforms['diffuse']!.value as Color).getHex()).toBe(0x00ff00)
    }
  })
})

function totalLength(positions: Float32Array): number {
  let total = 0
  for (let at = 0; at < positions.length; at += 6) {
    total += Math.hypot(
      positions[at + 3]! - positions[at]!,
      positions[at + 4]! - positions[at + 1]!,
      positions[at + 5]! - positions[at + 2]!,
    )
  }
  return total
}
