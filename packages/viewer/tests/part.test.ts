import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import type { PartModel, PartModelFeature } from '../src/model/types.js'
import {
  type PartObject,
  REGION_ATTRIBUTE,
  buildRegionAttribute,
  buildRegionTexels,
  createPart,
} from '../src/render/part.js'
import { DEFAULT_THEME } from '../src/render/theme.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

/**
 * `createPart` builds objects but never touches a GL context — a material is
 * compiled at draw time, not at construction — so all of this runs in node
 * against the real cube. What is checked is the mapping from the report onto
 * the buffers: every vertex pointing at its own region's texel, and a paint
 * reaching exactly the texels a feature owns and no others.
 */

const HIGHLIGHT = 0xff8000

async function loadCube(): Promise<{ model: PartModel; part: PartObject }> {
  const model = cubeModel()
  const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)

  return { model, part: createPart(model, geometry, DEFAULT_THEME) }
}

/** The `+Z` face: one region, so painting it must leave five untouched. */
function topFace(model: PartModel): PartModelFeature {
  const face = model.features.find(
    (feature) => feature.featureType === 'face' && feature.machiningDirection.z === 1,
  )

  if (!face) throw new Error('The cube fixture should have a +Z face feature.')

  return face
}

const weights = (part: PartObject, model: PartModel): number[] =>
  model.regions.map((region) => part.regionPaint(region.idx)?.weight ?? -1)

describe('buildRegionAttribute', () => {
  it("gives every vertex of a triangle its own region's texel", async () => {
    const { model, part } = await loadCube()
    const attribute = part.mesh.geometry.getAttribute(REGION_ATTRIBUTE)

    expect(attribute.count).toBe(36)

    for (let vertex = 0; vertex < 36; vertex += 1) {
      expect(attribute.getX(vertex)).toBe(
        model.regionIndex.regionForTriangle(Math.floor(vertex / 3)),
      )
    }
  })

  /**
   * `idx` is an identifier, not a position. Used directly as a column, a sparse
   * table would waste texels and a shuffled one would paint the wrong surface.
   */
  it('looks the column up by idx rather than array position', () => {
    const table = {
      regions: [
        { idx: 7, shapeKind: 'Plane', area: 1, triangles: { start: 0, end: 1 } },
        { idx: 3, shapeKind: 'Plane', area: 1, triangles: { start: 1, end: 2 } },
      ],
    }

    const texels = buildRegionTexels(table)
    expect(texels.get(7)).toBe(0)
    expect(texels.get(3)).toBe(1)

    expect([...buildRegionAttribute(table, texels, 6)]).toEqual([0, 0, 0, 1, 1, 1])
  })

  /**
   * The spare column past the end. Tiling is enforced at normalization so no
   * vertex should land there, but if one does it paints nothing rather than
   * inheriting whatever region zero happens to be showing.
   */
  it('parks a vertex belonging to no region on the transparent column', () => {
    const table = {
      regions: [{ idx: 0, shapeKind: 'Plane', area: 1, triangles: { start: 0, end: 1 } }],
    }

    expect([...buildRegionAttribute(table, buildRegionTexels(table), 6)]).toEqual([
      0, 0, 0, 1, 1, 1,
    ])
  })
})

describe('createPart — painting', () => {
  it('paints exactly the regions a feature owns', async () => {
    const { model, part } = await loadCube()
    const face = topFace(model)
    const owned = model.regionIndex.regionsForFeature(face.tag)

    expect(owned).toHaveLength(1)

    part.paintFeature(face.tag, HIGHLIGHT, 1)

    expect(weights(part, model)).toEqual(
      model.regions.map((region) => (owned.includes(region.idx) ? 1 : 0)),
    )
  })

  it('round-trips the paint color', async () => {
    const { part } = await loadCube()

    part.paintRegion(0, HIGHLIGHT, 1)

    expect(part.regionPaint(0)?.color).toBe(HIGHLIGHT)
  })

  it('clears every texel', async () => {
    const { model, part } = await loadCube()

    for (const region of model.regions) part.paintRegion(region.idx, HIGHLIGHT, 1)
    part.clearPaint()

    expect(weights(part, model)).toEqual(model.regions.map(() => 0))
  })

  it('ignores a region the part does not have', async () => {
    const { model, part } = await loadCube()

    expect(() => part.paintRegion(99, HIGHLIGHT, 1)).not.toThrow()
    expect(part.regionPaint(99)).toBeNull()
    expect(weights(part, model)).toEqual(model.regions.map(() => 0))
  })

  it('clamps the weight to what the shader can honour', async () => {
    const { part } = await loadCube()

    part.paintRegion(0, HIGHLIGHT, 4)
    expect(part.regionPaint(0)?.weight).toBe(1)

    part.paintRegion(0, HIGHLIGHT, -1)
    expect(part.regionPaint(0)?.weight).toBe(0)
  })

  /**
   * The reason the rewrite happened: highlighting is a texture write, so the
   * scene holds one mesh and one material however many features are lit. What
   * this replaced allocated a material per state and re-grouped the geometry on
   * every hover.
   */
  it('lights every feature without adding a material or a draw call', async () => {
    const { model, part } = await loadCube()

    for (const feature of model.features) part.paintFeature(feature.tag, HIGHLIGHT, 1)

    expect(model.features).toHaveLength(24)
    expect(Array.isArray(part.mesh.material)).toBe(false)
    expect(part.mesh.geometry.groups).toHaveLength(0)
  })
})

describe('createPart — framing and teardown', () => {
  it('bounds a feature from its own triangles, not the whole mesh', async () => {
    const { model, part } = await loadCube()
    const box = part.boxForFeature(topFace(model).tag)
    const size = box?.getSize(new Vector3())

    // One flat face of a 50.8 mm cube: full extent on two axes and none on the
    // third. The whole-mesh box would measure 50.8 on all three.
    expect(size?.toArray().filter((value) => value === 0)).toHaveLength(1)
    expect(size?.toArray().filter((value) => Math.abs(value - 50.8) < 1e-3)).toHaveLength(2)
  })

  it('returns null for a feature it does not know', async () => {
    const { part } = await loadCube()

    expect(part.boxForFeature('nope')).toBeNull()
  })

  /**
   * The geometry belongs to whoever loaded it — here, a cache that may still be
   * sharing it. Dispose removes only the attribute this added.
   */
  it("leaves the caller's geometry usable after dispose", async () => {
    const { part } = await loadCube()
    const geometry = part.mesh.geometry

    part.dispose()

    expect(geometry.hasAttribute(REGION_ATTRIBUTE)).toBe(false)
    expect(geometry.getAttribute('position').count).toBe(36)
  })

  /**
   * The order a consumer rebuilds in, and the bug it caused.
   *
   * A report changing identity — a feature added, a re-fetch — rebuilds the
   * part against the **same cached geometry**, and React builds the new one
   * during render before disposing the old. A dispose that deleted the
   * attribute unconditionally therefore deleted the one the new part had just
   * set: every vertex fell back to texel 0 and the whole part went one flat
   * colour, with hover, selection and every wash gone with it.
   */
  it('leaves a newer part on the same geometry alone', async () => {
    const { model, part } = await loadCube()
    const geometry = part.mesh.geometry

    const newer = createPart(model, geometry, DEFAULT_THEME)
    const attribute = geometry.getAttribute(REGION_ATTRIBUTE)

    part.dispose()

    expect(geometry.hasAttribute(REGION_ATTRIBUTE)).toBe(true)
    expect(geometry.getAttribute(REGION_ATTRIBUTE)).toBe(attribute)

    // And the newer one still cleans up after itself.
    newer.dispose()
    expect(geometry.hasAttribute(REGION_ATTRIBUTE)).toBe(false)
  })
})
