import {
  Box3,
  type BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  type Plane,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
} from 'three'
import type { FeatureTag, PartModel } from '../model/types.js'
import { regionEdgesGeometry } from './edges.js'
import type { ViewerTheme } from './theme.js'

/** The vertex attribute carrying each vertex's column in the state texture. */
export const REGION_ATTRIBUTE = 'aRegion'

/** How much of a painted region's color also lights it from within. */
const EMISSIVE_MIX = 0.4

/**
 * A part on screen: one mesh, one draw call, one material.
 *
 * Highlighting is a texture write, not a material change. Every region owns one
 * texel of a `regionCount + 1` wide RGBA texture holding a color and a blend
 * weight, and every vertex carries its region's column in {@link
 * REGION_ATTRIBUTE}. Hover, select, candidate, and dim are then all the same
 * operation — write a texel, flag the texture — with no material churn, no
 * geometry rebuild, and no re-upload of positions.
 *
 * What it replaces allocated a material per visual state and rebuilt the
 * geometry's draw groups on every hover, which is a draw call per highlighted
 * feature and a buffer walk per pointer move.
 */
export interface PartObject {
  /** Add this to the scene. Holds the mesh and its edges. */
  readonly object: Group
  readonly mesh: Mesh
  /** The overlaid edge lines, exposed so a consumer can hide them. */
  readonly edges: LineSegments
  readonly model: PartModel
  /** Paints one region. `weight` 0 clears it, 1 replaces the surface color. */
  paintRegion(region: number, color: number, weight: number): void
  /** What a region is painted with now. `null` for a region it does not have. */
  regionPaint(region: number): RegionPaint | null
  /** Paints every region the feature explicitly owns. */
  paintFeature(tag: FeatureTag, color: number, weight: number): void
  clearPaint(): void
  /** A feature's bounds in part space, for framing. `null` if it has none. */
  boxForFeature(tag: FeatureTag): Box3 | null
  /**
   * Applies a section's clipping plane to the part and its edges. `null`
   * removes it. A setter rather than a constructor argument because a section
   * is toggled far more often than a part is loaded.
   */
  setClippingPlanes(planes: readonly Plane[] | null): void
  setTheme(theme: ViewerTheme): void
  dispose(): void
}

export interface RegionPaint {
  readonly color: number
  /** 0 for untouched, 1 for fully painted. */
  readonly weight: number
}

/** The part of a region table the buffer builders need. */
type RegionTable = {
  readonly regions: readonly Pick<PartModel['regions'][number], 'idx' | 'triangles'>[]
}

/**
 * Maps a region's `idx` to its column in the state texture.
 *
 * Real reports number regions densely from zero, but `idx` is documented as an
 * identifier rather than a position, so it is looked up instead of assumed —
 * the same discipline `regionIdxs` needs. The extra column past the end is a
 * permanently transparent slot for a vertex belonging to no region; region
 * tiling is enforced at normalization so nothing should land there, and if
 * something does, it paints nothing rather than painting region zero.
 */
export function buildRegionTexels(model: RegionTable): Map<number, number> {
  return new Map(model.regions.map((region, column) => [region.idx, column]))
}

/**
 * The per-vertex region attribute, built by walking the region table once.
 *
 * The mesh must be non-indexed — `engine/geometry.ts` guarantees it — because a
 * shared vertex belongs to several regions and there is no single value to
 * write into it. With three vertices per triangle, region `[start, end)` owns
 * the vertex range `[start * 3, end * 3)`, which makes this a handful of `fill`
 * calls.
 */
export function buildRegionAttribute(
  model: RegionTable,
  texels: Map<number, number>,
  vertexCount: number,
): Float32Array {
  // The transparent slot, so an untiled vertex paints nothing.
  const values = new Float32Array(vertexCount).fill(model.regions.length)

  for (const region of model.regions) {
    const column = texels.get(region.idx)
    if (column === undefined) continue

    values.fill(
      column,
      Math.min(region.triangles.start * 3, vertexCount),
      Math.min(region.triangles.end * 3, vertexCount),
    )
  }

  return values
}

/**
 * Builds the renderable part.
 *
 * Takes working use of `geometry`: it adds {@link REGION_ATTRIBUTE} to it and
 * removes that again on dispose, but never disposes the geometry itself — the
 * loader's caller owns it, and a viewer destroying an object it was handed is a
 * good way to break a cache that is legitimately sharing it.
 *
 * Two parts on one geometry is still not a thing to *render*, but it is a state
 * that happens: a report changing identity rebuilds the part against the same
 * cached mesh, and for a moment both exist. So dispose removes the attribute
 * only if it is still the one this part set — see the note where it is built.
 */
export function createPart(
  model: PartModel,
  geometry: BufferGeometry,
  theme: ViewerTheme,
): PartObject {
  const position = geometry.getAttribute('position')
  const texels = buildRegionTexels(model)

  /*
   * Held, so `dispose` can tell whether it is still the one in place.
   *
   * A consumer whose report changes — a feature added, a re-fetch — rebuilds
   * the part against the **same cached geometry**, and the order React runs
   * that in is: new part built during render, *then* old part disposed. A
   * dispose that deleted the attribute unconditionally therefore deleted the
   * one the new part had just set, and every vertex fell back to texel 0 — the
   * whole part in one flat colour, with hover, selection and every wash gone.
   */
  const regionAttribute = new Float32BufferAttribute(
    buildRegionAttribute(model, texels, position.count),
    1,
  )
  geometry.setAttribute(REGION_ATTRIBUTE, regionAttribute)

  // One texel per region, plus the transparent slot. RGB is the paint color in
  // the renderer's working space; A is how much of it shows.
  const width = model.regions.length + 1
  const state = new Uint8Array(width * 4)
  const stateTexture = new DataTexture(state, width, 1, RGBAFormat, UnsignedByteType)
  stateTexture.needsUpdate = true

  const material = new MeshLambertMaterial({
    color: theme.part,
    emissive: theme.partEmissive,
    // Pushes the surface back so the edge lines below sit on top of it rather
    // than z-fighting with it.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uRegionState'] = { value: stateTexture }

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float ${REGION_ATTRIBUTE};
        varying float vRegion;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRegion = ${REGION_ATTRIBUTE};`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uRegionState;
        varying float vRegion;
        vec4 regionState;`,
      )
      // three compiles built-in materials as GLSL 3.0, so `texelFetch` is
      // available: an exact integer lookup, with no filtering to defeat and no
      // texture width to pass in as a second uniform.
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        regionState = texelFetch(uRegionState, ivec2(int(vRegion + 0.5), 0), 0);
        diffuseColor.rgb = mix(diffuseColor.rgb, regionState.rgb, regionState.a);
`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(
          totalEmissiveRadiance,
          regionState.rgb * ${EMISSIVE_MIX.toFixed(2)},
          regionState.a
        );`,
      )
  }

  const mesh = new Mesh(geometry, material)
  // Leaves room below for a section's stencil pass and its cap, which would
  // otherwise be painted over by the very surface they exist to cap.
  mesh.renderOrder = 3

  // Region boundaries rather than an angle threshold: a small bore's facets sit
  // 30 degrees apart and would each be drawn as an edge.
  const edgeGeometry = regionEdgesGeometry(geometry, model)
  const edgeMaterial = new LineBasicMaterial({
    color: theme.edge,
    opacity: theme.edgeOpacity,
    transparent: true,
  })
  const edges = new LineSegments(edgeGeometry, edgeMaterial)
  edges.renderOrder = 4
  // Edges must never win a pick: the raycaster would otherwise report a hit on
  // a line with no face index, which is not a surface anyone clicked.
  edges.raycast = () => {}

  const object = new Group()
  object.add(mesh, edges)

  const scratchColor = new Color()
  const scratchVector = new Vector3()

  const paintRegion = (region: number, color: number, weight: number): void => {
    const column = texels.get(region)
    if (column === undefined) return

    // `Color` converts from sRGB into the renderer's working space, so what is
    // stored is what the shader can mix directly into `diffuseColor`.
    scratchColor.setHex(color)
    const offset = column * 4
    state[offset] = Math.round(scratchColor.r * 255)
    state[offset + 1] = Math.round(scratchColor.g * 255)
    state[offset + 2] = Math.round(scratchColor.b * 255)
    state[offset + 3] = Math.round(Math.min(Math.max(weight, 0), 1) * 255)
    stateTexture.needsUpdate = true
  }

  return {
    object,
    mesh,
    edges,
    model,

    paintRegion,

    regionPaint(region) {
      const column = texels.get(region)
      if (column === undefined) return null

      const offset = column * 4
      scratchColor.setRGB(
        (state[offset] ?? 0) / 255,
        (state[offset + 1] ?? 0) / 255,
        (state[offset + 2] ?? 0) / 255,
      )

      return { color: scratchColor.getHex(), weight: (state[offset + 3] ?? 0) / 255 }
    },

    paintFeature(tag, color, weight) {
      for (const region of model.regionIndex.regionsForFeature(tag)) {
        paintRegion(region, color, weight)
      }
    },

    clearPaint() {
      state.fill(0)
      stateTexture.needsUpdate = true
    },

    boxForFeature(tag) {
      const regions = model.regionIndex.regionsForFeature(tag)
      if (regions.length === 0) return null

      // One pass over the feature's own triangles rather than the whole mesh.
      const box = new Box3()
      for (const region of regions) {
        const range = model.regionIndex.rangeForRegion(region)
        if (!range) continue

        for (
          let vertex = range.start * 3;
          vertex < range.end * 3 && vertex < position.count;
          vertex += 1
        ) {
          box.expandByPoint(scratchVector.fromBufferAttribute(position, vertex))
        }
      }

      return box.isEmpty() ? null : box
    },

    setClippingPlanes(planes) {
      const value = planes === null ? null : [...planes]
      material.clippingPlanes = value
      edgeMaterial.clippingPlanes = value
    },

    setTheme(next) {
      material.color.setHex(next.part)
      material.emissive.setHex(next.partEmissive)
      edgeMaterial.color.setHex(next.edge)
      edgeMaterial.opacity = next.edgeOpacity
    },

    dispose() {
      object.clear()
      // Only what this part put there. Another may have taken the geometry over
      // in the meantime — see the note where the attribute is built.
      if (geometry.getAttribute(REGION_ATTRIBUTE) === regionAttribute) {
        geometry.deleteAttribute(REGION_ATTRIBUTE)
      }
      material.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      stateTexture.dispose()
    },
  }
}
