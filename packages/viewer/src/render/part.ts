import {
  Box3,
  type BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  type Plane,
  RedFormat,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
} from 'three'
import type { FeatureTag, PartModel } from '../model/types.js'
import { regionEdgesGeometry } from './edges.js'
import { focusOpacity, focusedRegions, type FocusOptions } from './focus.js'
import type { ViewerCamera, ViewportSize } from './camera.js'
import {
  type SharpCorner,
  type SharpCornerDrawing,
  type SharpCornerOptions,
  type SurfaceCreases,
  createSharpCornerDrawing,
  findSharpCorners,
  sharpCornerAt,
  sharpCornerKey,
  surfaceCreases,
} from './sharp-corners.js'
import type { ViewerTheme } from './theme.js'
import { THREAD_TEXTURE_ROWS, type ThreadOptions, threadKey, writeThreadTexels } from './threads.js'

/**
 * Depth-buffer steps between two depth layers. Two coplanar surfaces
 * triangulated differently still interpolate the same plane to within a step or
 * two, so four always settles which is in front.
 */
const DEPTH_LAYER_UNITS = 4
/** Layers past this share it: 63 × 4 steps is still well under any visible gap. */
const MAX_DEPTH_LAYER = 63

/** The vertex attribute carrying each vertex's column in the state texture. */
export const REGION_ATTRIBUTE = 'aRegion'

/** How much of a painted region's color also lights it from within. */
const EMISSIVE_MIX = 0.4

// How far a thread's flank turns the light. Steeper than a real 60° thread's
// 30°: inside a bore the light is mostly ambient, and a true tilt barely shows.
const THREAD_TILT = Math.tan(Math.PI / 4)

// How dark a thread's root is drawn, beside its crest: a stand-in for the
// shadow a real root sits in, which is most of what makes a thread read.
const THREAD_ROOT_SHADE = 0.45

// How much a crest is brightened, so the helix shows on a dark theme too.
const THREAD_CREST_LIGHT = 1.15

export type PartDisplay = 'solid' | 'wireframe'

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
  /** Makes selected features solid and the rest of the part translucent. */
  setFocus(selection: readonly FeatureTag[], focus?: FocusOptions): void
  /** The current opacity of one region, or `null` if it does not exist. */
  regionOpacity(region: number): number | null
  /** A feature's bounds in part space, for framing. `null` if it has none. */
  boxForFeature(tag: FeatureTag): Box3 | null
  /**
   * Applies a section's clipping plane to the part and its edges. `null`
   * removes it. A setter rather than a constructor argument because a section
   * is toggled far more often than a part is loaded.
   */
  setClippingPlanes(planes: readonly Plane[] | null): void
  setTheme(theme: ViewerTheme): void
  /** Semantic edges only in wireframe; painted faces remain visible for interaction. */
  setDisplay(display: PartDisplay, showEdges?: boolean): void
  /** The whole part's opacity, 0–1: below 1 it is see-through, and its edges fade with it. */
  setOpacity(opacity: number): void
  /**
   * Pushes the surface back by `layer` depth steps, 0 to 63, so that where it
   * lies on another part's surface the part on the lower layer is drawn,
   * rather than the two fighting over each pixel.
   */
  setDepthLayer(layer: number): void
  /**
   * Hides the part and takes it out of picking, so it neither draws nor stands
   * between the pointer and a part behind it. Nothing is rebuilt to show it again.
   */
  setVisible(visible: boolean): void
  /**
   * Draws the sharp corners of the features the DFM rules flag, bold and
   * through the part — see `render/sharp-corners.ts`. `null` hides them. Setting what is already drawn
   * costs a string comparison, so a caller may pass a fresh object each render.
   */
  setSharpCorners(options: SharpCornerOptions | null): void
  /** The corners drawn now, in the order their `index` counts; none while they are off. */
  sharpCorners(): readonly SharpCorner[]
  /**
   * The drawn corner under a pointer on the part — `point` in world space,
   * `region` the face it hit — or `null`. See `sharpCornerAt`.
   */
  sharpCornerAt(
    hit: { readonly point: Vector3; readonly region: number },
    camera: ViewerCamera,
    viewport: ViewportSize,
  ): SharpCorner | null
  /** Draws one corner up as the one under the pointer; `null` for none. */
  setHoveredSharpCorner(index: number | null): void
  /**
   * Draws threads into the bores they are cut in — see `render/threads.ts`.
   * `null` draws none. Keyed by content, like `setSharpCorners`.
   */
  setThreads(options: ThreadOptions | null): void
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
  const opacity = new Uint8Array(width).fill(255)
  const opacityTexture = new DataTexture(opacity, width, 1, RedFormat, UnsignedByteType)
  opacityTexture.needsUpdate = true
  // Per region: where its thread's axis runs and its pitch, 0 for none.
  const threads = new Float32Array(width * THREAD_TEXTURE_ROWS * 4)
  const threadTexture = new DataTexture(threads, width, THREAD_TEXTURE_ROWS, RGBAFormat, FloatType)
  threadTexture.needsUpdate = true
  let threadsKey = ''

  const focusState = { value: false }
  const wireframe = { value: false }
  let focused = false
  let currentTheme = theme
  let partOpacity = 1
  // What a shown part picks with, kept while it is hidden.
  let shownRaycast: Mesh['raycast'] = () => {}
  let clipping: Plane[] | null = null

  // Found and built on first use: most parts are never asked for them, and
  // finding them is a pass over every edge of the mesh.
  let creases: SurfaceCreases | null = null
  let sharpLines: SharpCornerDrawing | null = null
  let sharpKey = ''
  let corners: readonly SharpCorner[] = []

  const material = new MeshLambertMaterial({
    color: theme.part,
    emissive: theme.partEmissive,
    // Pushes the surface back so the edge lines below sit on top of it rather
    // than z-fighting with it.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })

  const configureShader = (target: MeshLambertMaterial, opaqueFocusPass: boolean) => {
    target.onBeforeCompile = (shader) => {
      shader.uniforms['uRegionState'] = { value: stateTexture }
      shader.uniforms['uRegionOpacity'] = { value: opacityTexture }
      shader.uniforms['uWireframe'] = wireframe
      shader.uniforms['uFocus'] = focusState
      shader.uniforms['uOpaqueFocusPass'] = { value: opaqueFocusPass }
      shader.uniforms['uThreads'] = { value: threadTexture }

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
        attribute float ${REGION_ATTRIBUTE};
        uniform sampler2D uThreads;
        varying float vRegion;
        varying vec3 vThreadPosition;
        varying vec4 vThreadOrigin;
        varying vec3 vThreadAxis;
        varying vec3 vThreadAxisView;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        vRegion = ${REGION_ATTRIBUTE};
        // Every vertex of a triangle is in one region, so these are flat across it.
        vThreadOrigin = texelFetch(uThreads, ivec2(int(vRegion + 0.5), 0), 0);
        vThreadAxis = texelFetch(uThreads, ivec2(int(vRegion + 0.5), 1), 0).xyz;
        vThreadAxisView = normalMatrix * vThreadAxis;
        vThreadPosition = position;`,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
        uniform sampler2D uRegionState;
        uniform sampler2D uRegionOpacity;
        uniform bool uWireframe;
        uniform bool uFocus;
        uniform bool uOpaqueFocusPass;
        varying float vRegion;
        varying vec3 vThreadPosition;
        varying vec4 vThreadOrigin;
        varying vec3 vThreadAxis;
        varying vec3 vThreadAxisView;
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
        float regionOpacity = texelFetch(uRegionOpacity, ivec2(int(vRegion + 0.5), 0), 0).r;
        if (uFocus && uOpaqueFocusPass && regionOpacity < 0.999) discard;
        if (uFocus && !uOpaqueFocusPass && regionOpacity >= 0.999) discard;
        diffuseColor.a *= regionOpacity;
        if (uWireframe) diffuseColor.a *= regionState.a;
`,
        )
        // The thread, as a bump: the helix phase runs one turn per pitch along
        // the axis and one per revolution round it, and its slope tilts the
        // normal along the axis. Where a pitch spans too few pixels to draw,
        // it fades out flat rather than shimmering.
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
        // Worked out for every pixel, threaded or not, and applied only where
        // there is a thread: derivatives are undefined inside a branch that
        // differs between neighbouring pixels, as it does along a region's edge.
        bool threaded = vThreadOrigin.w != 0.0;
        float threadPitch = threaded ? vThreadOrigin.w : 1.0;
        vec3 threadAxis = threaded ? normalize(vThreadAxis) : vec3(0.0, 0.0, 1.0);
        vec3 threadOffset = vThreadPosition - vThreadOrigin.xyz;
        float threadAlong = dot(threadOffset, threadAxis);
        vec3 threadU = normalize(cross(
          threadAxis,
          abs(threadAxis.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)
        ));
        vec3 threadV = cross(threadAxis, threadU);
        float threadX = dot(threadOffset, threadU);
        float threadY = dot(threadOffset, threadV);
        float threadTurn = atan(threadY, threadX) / PI2;
        float threadPhase = threadAlong / threadPitch - threadTurn;
        // Two angle seams on opposite sides, so the blur estimate has none.
        float threadBlur = fwidth(threadAlong / threadPitch) + min(
          fwidth(threadTurn),
          fwidth(atan(-threadY, -threadX) / PI2)
        );
        if (threaded) {
          float threadStrength = 1.0 - smoothstep(0.2, 0.45, threadBlur);
          // The V of the thread: 1 at its root (phase 0), 0 at its crest (phase ½).
          float threadDepth = abs(fract(threadPhase) - 0.5) * 2.0;
          float threadSlope = clamp(sin(PI2 * threadPhase) * 3.0, -1.0, 1.0) * sign(threadPitch);
          normal = normalize(
            normal - ${THREAD_TILT.toFixed(4)} * threadStrength * threadSlope * normalize(vThreadAxisView)
          );
          float threadShade = mix(
            ${THREAD_CREST_LIGHT.toFixed(2)},
            ${THREAD_ROOT_SHADE.toFixed(2)},
            smoothstep(0.0, 1.0, threadDepth)
          );
          diffuseColor.rgb *= mix(1.0, threadShade, threadStrength);
        }`,
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
  }

  const focusMaterial = new MeshLambertMaterial({
    color: theme.part,
    emissive: theme.partEmissive,
    // A selected face can be viewed through the part from the side its normal
    // faces away from.
    side: DoubleSide,
  })
  configureShader(focusMaterial, true)
  configureShader(material, false)

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

  const focusMesh = new Mesh(geometry, focusMaterial)
  focusMesh.renderOrder = 3
  focusMesh.visible = false
  focusMesh.raycast = () => {}

  const edgeOpacity = () => (wireframe.value ? 1 : currentTheme.edgeOpacity) * partOpacity

  const syncTransparency = () => {
    const seeThrough = partOpacity < 1
    const transparent = wireframe.value || focused || seeThrough
    material.opacity = partOpacity
    if (material.transparent !== transparent || material.depthWrite !== !transparent) {
      material.transparent = transparent
      material.depthWrite = !transparent
      material.needsUpdate = true
    }
    // The x-ray's solid pass fades with the rest, so a see-through part stays see-through.
    focusMaterial.opacity = partOpacity
    if (focusMaterial.transparent !== seeThrough) {
      focusMaterial.transparent = seeThrough
      focusMaterial.depthWrite = !seeThrough
      focusMaterial.needsUpdate = true
    }
    edgeMaterial.opacity = edgeOpacity()
    focusState.value = focused
    focusMesh.visible = focused
    // A part writing no depth of its own leaves the corners none to be hidden by.
    sharpLines?.setPartDepth(transparent)
  }

  const object = new Group()
  object.add(focusMesh, mesh, edges)

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

    setFocus(selection, focus) {
      const regions = focus === undefined ? null : focusedRegions(model, selection)
      const outside = focusOpacity(focus)
      let changed = false
      let hasTransparency = false

      for (const [region, column] of texels) {
        const value =
          regions === null || regions.size === 0 || regions.has(region)
            ? 255
            : Math.round(outside * 255)
        if (opacity[column] !== value) {
          opacity[column] = value
          changed = true
        }
        hasTransparency ||= value < 255
      }

      focused = hasTransparency
      syncTransparency()
      if (changed) opacityTexture.needsUpdate = true
    },

    regionOpacity(region) {
      const column = texels.get(region)
      return column === undefined ? null : (opacity[column] ?? 0) / 255
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
      clipping = value
      material.clippingPlanes = value
      focusMaterial.clippingPlanes = value
      edgeMaterial.clippingPlanes = value
      sharpLines?.setClippingPlanes(value)
    },

    setTheme(next) {
      currentTheme = next
      material.color.setHex(next.part)
      material.emissive.setHex(next.partEmissive)
      focusMaterial.color.setHex(next.part)
      focusMaterial.emissive.setHex(next.partEmissive)
      edgeMaterial.color.setHex(wireframe.value ? next.part : next.edge)
      edgeMaterial.opacity = edgeOpacity()
      sharpLines?.setTheme(next)
    },

    setDisplay(display, showEdges = true) {
      const enabled = display === 'wireframe'
      if (wireframe.value !== enabled) {
        wireframe.value = enabled
        syncTransparency()
      }
      edges.visible = enabled || showEdges
      edgeMaterial.color.setHex(enabled ? currentTheme.part : currentTheme.edge)
      edgeMaterial.opacity = edgeOpacity()
    },

    setOpacity(opacity) {
      const next = Math.min(Math.max(opacity, 0), 1)
      if (next === partOpacity) return
      partOpacity = next
      syncTransparency()
    },

    setVisible(visible) {
      if (visible === object.visible) return
      object.visible = visible
      if (visible) {
        mesh.raycast = shownRaycast
      } else {
        shownRaycast = mesh.raycast
        mesh.raycast = () => {}
      }
    },

    setDepthLayer(layer) {
      const steps = Math.min(Math.max(Math.round(layer), 0), MAX_DEPTH_LAYER)
      // On top of the step every part takes for its own edges.
      material.polygonOffsetUnits = 1 + DEPTH_LAYER_UNITS * steps
    },

    setSharpCorners(options) {
      const key = options === null ? '' : sharpCornerKey(options)
      if (key === sharpKey) return
      sharpKey = key
      // Nothing flagged is nothing to find, so the walk waits for something that is.
      if (options === null || options.features.length === 0) {
        corners = []
        sharpLines?.clear()
        return
      }
      creases ??= surfaceCreases(geometry, model)
      if (!sharpLines) {
        sharpLines = createSharpCornerDrawing(currentTheme, geometry)
        sharpLines.setClippingPlanes(clipping)
        sharpLines.setPartDepth(wireframe.value || focused)
        object.add(sharpLines.object)
      }
      corners = findSharpCorners(creases, model, options)
      sharpLines.setCorners(creases, corners)
    },

    sharpCorners() {
      return corners
    },

    sharpCornerAt(hit, camera, viewport) {
      if (!creases || corners.length === 0) return null
      return sharpCornerAt(corners, creases, hit, camera, viewport, mesh.matrixWorld)
    },

    setHoveredSharpCorner(index) {
      sharpLines?.setHovered(index)
    },

    setThreads(options) {
      const key = threadKey(options)
      if (key === threadsKey) return
      threadsKey = key
      writeThreadTexels(threads, width, geometry, model, texels, options)
      threadTexture.needsUpdate = true
    },

    dispose() {
      object.clear()
      // Only what this part put there. Another may have taken the geometry over
      // in the meantime — see the note where the attribute is built.
      if (geometry.getAttribute(REGION_ATTRIBUTE) === regionAttribute) {
        geometry.deleteAttribute(REGION_ATTRIBUTE)
      }
      material.dispose()
      focusMaterial.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      sharpLines?.dispose()
      stateTexture.dispose()
      opacityTexture.dispose()
      threadTexture.dispose()
    },
  }
}
