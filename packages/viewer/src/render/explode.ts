import { EXCLUDE_FROM_FRAME } from './camera.js'
import { regionEdgesGeometry } from './edges.js'
import { DEFAULT_EXPLODE_THEME, type ExplodeTheme } from './explode-theme.js'
import { buildPick, ignoreRay, type BuildPickInput } from './picking.js'
import type { PartModel } from '../model/types.js'
import {
  BatchedMesh,
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix3,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Vector3,
  Uint32BufferAttribute,
  type Intersection,
} from 'three'
import { explodeTriangleCount, extractExplodeGroup } from './explode-geometry.js'
import { readExplodeAmount } from '../model/explode-amount.js'
import type {
  ExplodeGroup,
  ExplodeGroupIds,
  ExplodePick,
  ExplodeRegionColors,
} from '../model/explode.js'

/** At or below this amount the part is assembled: pieces are hidden and nothing picks. */
const ASSEMBLED = 0.0001
/** Pieces and their outlines fade in over this first part of the explosion. */
const FADE_IN = 0.1
/** How far selection and hover tint a piece toward their theme colors. */
const SELECTED_TINT = 0.45
const HOVERED_TINT = 0.25
/** How far the source highlight lightens its theme color toward white. */
const SOURCE_LIGHTEN = 0.45

const WHITE = new Color(0xffffff)
// Pieces and their source highlight draw alike: one pass over both sides, behind outlines.
const SURFACE_MATERIAL = {
  emissive: DEFAULT_EXPLODE_THEME.emissive,
  side: DoubleSide,
  forceSinglePass: true,
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
} as const

const idsOf = (value: ExplodeGroupIds) =>
  value === null ? [] : typeof value === 'string' ? [value] : value

/** Paint, selection, and hover for one `setAppearance` call; omitted fields mean none. */
interface ExplodeAppearance {
  readonly colors?: ReadonlyMap<string, number>
  readonly regionColors?: ExplodeRegionColors
  readonly selected?: ExplodeGroupIds
  readonly hovered?: ExplodeGroupIds
  readonly theme?: ExplodeTheme
}

/** The pointer details a pick reports beyond the hit itself. */
type ExplodePickContext = Omit<
  BuildPickInput,
  'model' | 'region' | 'triangleIndex' | 'point' | 'normal'
>

/** Overlays draw only for a selection; the pointer and framing pass through them. */
const overlay = <T extends Mesh | LineSegments>(object: T, renderOrder = 0): T => {
  object.visible = false
  object.renderOrder = renderOrder
  object.frustumCulled = false
  object.raycast = ignoreRay
  object.userData[EXCLUDE_FROM_FRAME] = true
  return object
}

/** Every piece's surfaces in one batch, each mapped back to its source triangles. */
const buildSurfaces = (
  model: PartModel,
  geometry: BufferGeometry,
  groups: readonly ExplodeGroup[],
) => {
  const triangles = explodeTriangleCount(model, geometry, groups)
  if (groups.length === 0) {
    throw new Error('An explode batch needs at least one group.')
  }
  const material = new MeshLambertMaterial({
    ...SURFACE_MATERIAL,
    color: 0xffffff,
    vertexColors: true,
  })
  const mesh = new BatchedMesh(groups.length, triangles * 3, 0, material)
  mesh.name = 'explode-surfaces'
  mesh.renderOrder = 3
  mesh.frustumCulled = false
  // Three r159 already batches unique geometries, but predates separate instances
  // and per-instance colors. Keep the published peer floor: only the color storage
  // changes there, using the same shared geometry and matrix/raycast APIs.
  const instanceColors = typeof mesh.setColorAt === 'function'
  const edgePoints: Array<Float32Array> = []
  let vertexStart = 0
  let edgeStart = 0
  const pieces = groups.map((group) => {
    const extracted = extractExplodeGroup(model, geometry, group)
    const edges = regionEdgesGeometry(extracted.geometry, extracted)
    const points = edges.getAttribute('position').array as Float32Array
    const vertexCount = extracted.geometry.getAttribute('position').count
    extracted.geometry.setAttribute(
      'color',
      new Float32BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3),
    )
    const geometryId = mesh.addGeometry(extracted.geometry)
    const instanceId =
      typeof mesh.addInstance === 'function' ? mesh.addInstance(geometryId) : geometryId
    // Exact-sized, non-indexed geometries are appended without gaps on both APIs.
    const range = { start: vertexStart, count: vertexCount }
    const regions = extracted.regions.map((region) => ({
      idx: region.idx,
      start: vertexStart + region.triangles.start * 3,
      count: (region.triangles.end - region.triangles.start) * 3,
    }))
    vertexStart += vertexCount
    edgePoints.push(points)
    extracted.geometry.computeBoundingBox()
    const piece = {
      group,
      instanceId,
      range,
      regions,
      sourceTriangles: extracted.sourceTriangles,
      centre: extracted.geometry.boundingBox!.getCenter(new Vector3()),
      bounds: extracted.geometry.boundingBox!.clone(),
      edgeStart,
      edgeCount: points.length / 3,
    }
    edgeStart += piece.edgeCount
    // BatchedMesh copied these attributes into its shared buffers.
    extracted.geometry.dispose()
    edges.dispose()
    return piece
  })
  return { mesh, material, instanceColors, pieces, edgePoints, triangles, edgeVertices: edgeStart }
}

type Piece = ReturnType<typeof buildSurfaces>['pieces'][number]

/** Every piece's outline in one draw, translated on the GPU by the explosion amount. */
const buildOutlines = (
  pieces: ReadonlyArray<Piece>,
  edgePoints: ReadonlyArray<Float32Array>,
  edgeVertices: number,
) => {
  const positions = new Float32Array(edgeVertices * 3)
  const offsets = new Float32Array(edgeVertices * 3)
  for (const [index, piece] of pieces.entries()) {
    positions.set(edgePoints[index]!, piece.edgeStart * 3)
    for (let vertex = piece.edgeStart; vertex < piece.edgeStart + piece.edgeCount; vertex += 1) {
      offsets[vertex * 3] = piece.group.offset.x
      offsets[vertex * 3 + 1] = piece.group.offset.y
      offsets[vertex * 3 + 2] = piece.group.offset.z
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aExplodeOffset', new Float32BufferAttribute(offsets, 3))
  geometry.boundingBox = new Box3()
  const amount = { value: 0 }
  const material = new LineBasicMaterial({
    color: DEFAULT_EXPLODE_THEME.edge,
    transparent: true,
    depthWrite: false,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uExplodeAmount = amount
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aExplodeOffset;\nuniform float uExplodeAmount;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += aExplodeOffset * uExplodeAmount;',
      )
  }
  const outlines = new LineSegments(geometry, material)
  outlines.name = 'explode-edges'
  outlines.renderOrder = 4
  outlines.frustumCulled = false
  outlines.raycast = ignoreRay
  return { outlines, amount }
}

/**
 * The selected pieces' surfaces where they sit in the assembled part. Shares the
 * batch's immutable vertex buffers: changing selection changes draw ranges, not
 * geometry, materials, or shader programs.
 */
const buildSourceSurfaces = (surfaces: BatchedMesh, triangles: number) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', surfaces.geometry.getAttribute('position'))
  geometry.setAttribute('normal', surfaces.geometry.getAttribute('normal'))
  geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(triangles * 3), 1))
  geometry.setDrawRange(0, 0)
  const material = new MeshLambertMaterial({
    ...SURFACE_MATERIAL,
    color: new Color(DEFAULT_EXPLODE_THEME.source).lerp(WHITE, SOURCE_LIGHTEN),
  })
  const source = overlay(new Mesh(geometry, material), 3)
  source.name = 'explode-origin'
  return source
}

/** The selected pieces' outlines where they sit in the assembled part. */
const buildSourceOutlines = (outlines: BufferGeometry, edgeVertices: number) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', outlines.getAttribute('position'))
  geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(edgeVertices), 1))
  geometry.setDrawRange(0, 0)
  const material = new LineBasicMaterial({
    color: DEFAULT_EXPLODE_THEME.edge,
    transparent: true,
    opacity: DEFAULT_EXPLODE_THEME.edgeOpacity,
  })
  return overlay(new LineSegments(geometry, material), 4)
}

/** One line from the selection's source to where its pieces sit now. */
const buildConnector = () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3))
  const material = new LineBasicMaterial({
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  return overlay(new LineSegments(geometry, material))
}

/** One surface batch and one outline draw, with feature identities kept outside GPU batching. */
export const createExplodeBatch = (
  model: PartModel,
  geometry: BufferGeometry,
  groups: readonly ExplodeGroup[],
) => {
  const { mesh, material, instanceColors, pieces, edgePoints, triangles, edgeVertices } =
    buildSurfaces(model, geometry, groups)
  const { outlines, amount: amountUniform } = buildOutlines(pieces, edgePoints, edgeVertices)
  const source = buildSourceSurfaces(mesh, triangles)
  const sourceOutlines = buildSourceOutlines(outlines.geometry, edgeVertices)
  const connector = buildConnector()
  const object = new Group()
  object.add(mesh, outlines, source, sourceOutlines, connector)
  const byId = new Map(pieces.map((piece) => [piece.group.id, piece]))
  const matrix = new Matrix4()
  const inverse = new Matrix4()
  const normalMatrix = new Matrix3()
  const color = new Color()
  const highlightColor = new Color()
  const sourceBounds = new Box3()
  const placedBounds = new Box3()
  const movedBounds = new Box3()
  const point = new Vector3()
  const modelPoint = new Vector3()
  const normal = new Vector3()
  let theme = DEFAULT_EXPLODE_THEME
  let selectedPieces: typeof pieces = []
  let amount = -1
  let previousColors: ReadonlyMap<string, number> | undefined
  let previousRegionColors: ExplodeRegionColors | undefined
  let previousSelected: ExplodeGroupIds | undefined
  let previousHovered: ExplodeGroupIds | undefined
  let previousSelectedIds = new Set<string>()
  let previousHoveredIds = new Set<string>()
  let appearanceSet = false
  const syncConnector = () => {
    const visible = selectedPieces.length > 0 && amount > ASSEMBLED
    source.visible = visible
    sourceOutlines.visible = visible
    connector.visible = visible
    if (selectedPieces.length === 0) {
      return
    }
    const points = connector.geometry.getAttribute('position')
    sourceBounds.getCenter(point)
    points.setXYZ(0, point.x, point.y, point.z)
    placedBounds.makeEmpty()
    for (const piece of selectedPieces) {
      const offset = piece.group.offset
      point.set(offset.x * amount, offset.y * amount, offset.z * amount)
      placedBounds.union(movedBounds.copy(piece.bounds).translate(point))
    }
    placedBounds.getCenter(point)
    points.setXYZ(1, point.x, point.y, point.z)
    points.needsUpdate = true
  }
  const hit = (batchId: number | undefined, faceIndex: number | undefined) => {
    if (batchId === undefined || faceIndex === undefined) {
      return null
    }
    const piece = pieces[batchId]
    const local = piece ? faceIndex - piece.range.start / 3 : -1
    return piece && local >= 0 && local < piece.sourceTriangles.length
      ? { group: piece.group, triangleIndex: piece.sourceTriangles[local]! }
      : null
  }
  return {
    object,
    mesh,
    pieces,
    hit,
    /** A ray hit on the batch as a pick of its source surface, with the hit's unexploded point. */
    pick: (
      intersection: Pick<Intersection, 'batchId' | 'faceIndex' | 'face' | 'point'>,
      context: ExplodePickContext = {},
    ): ExplodePick | null => {
      const { face } = intersection
      if (amount <= ASSEMBLED || !face) {
        return null
      }
      const found = hit(intersection.batchId, intersection.faceIndex ?? undefined)
      if (!found) {
        return null
      }
      const region = model.regionIndex.regionForTriangle(found.triangleIndex)
      if (region === null) {
        return null
      }
      // Instances only translate, so the batch's world matrix alone turns the normal.
      normal.copy(face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(mesh.matrixWorld))
      const { offset } = found.group
      modelPoint.copy(intersection.point).applyMatrix4(inverse.copy(mesh.matrixWorld).invert())
      modelPoint.x -= offset.x * amount
      modelPoint.y -= offset.y * amount
      modelPoint.z -= offset.z * amount
      return {
        ...buildPick({
          ...context,
          model,
          region,
          triangleIndex: found.triangleIndex,
          point: intersection.point.toArray(),
          normal: normal.toArray(),
        }),
        explodeGroupId: found.group.id,
        modelPoint: modelPoint.toArray(),
      }
    },
    setAppearance: ({
      colors,
      regionColors,
      selected = null,
      hovered = null,
      theme: nextTheme = DEFAULT_EXPLODE_THEME,
    }: ExplodeAppearance) => {
      const themeChanged = theme !== nextTheme
      if (
        appearanceSet &&
        !themeChanged &&
        previousColors === colors &&
        previousRegionColors === regionColors &&
        previousSelected === selected &&
        previousHovered === hovered
      ) {
        return
      }
      if (themeChanged) {
        theme = nextTheme
        material.emissive.setHex(theme.emissive)
        source.material.emissive.setHex(theme.emissive)
        source.material.color.setHex(theme.source).lerp(WHITE, SOURCE_LIGHTEN)
        outlines.material.color.setHex(theme.edge)
        outlines.material.opacity = theme.edgeOpacity * Math.min(1, Math.max(0, amount) / FADE_IN)
        sourceOutlines.material.color.setHex(theme.edge)
        sourceOutlines.material.opacity = theme.edgeOpacity
      }
      const selectedIds = new Set(idsOf(selected))
      const hoveredIds = new Set(idsOf(hovered))
      for (const piece of pieces) {
        const id = piece.group.id
        if (
          appearanceSet &&
          !themeChanged &&
          previousColors === colors &&
          previousRegionColors === regionColors &&
          !selectedIds.has(id) &&
          !previousSelectedIds.has(id) &&
          !hoveredIds.has(id) &&
          !previousHoveredIds.has(id)
        ) {
          continue
        }
        const base = colors?.get(id) ?? piece.group.color
        const regions = regionColors?.get(id)
        const perVertex = !instanceColors || Boolean(regions?.size)
        highlightColor.setHex(selectedIds.has(id) ? theme.selected : theme.hovered)
        const tint = selectedIds.has(id) ? SELECTED_TINT : hoveredIds.has(id) ? HOVERED_TINT : 0
        const vertices = mesh.geometry.getAttribute('color')
        if (perVertex || previousRegionColors?.get(id)?.size) {
          for (const region of piece.regions) {
            color.setHex(regions?.get(region.idx) ?? base).lerp(highlightColor, tint)
            for (let vertex = region.start; vertex < region.start + region.count; vertex += 1) {
              vertices.setXYZ(
                vertex,
                perVertex ? color.r : 1,
                perVertex ? color.g : 1,
                perVertex ? color.b : 1,
              )
            }
          }
          vertices.needsUpdate = true
        }
        if (instanceColors) {
          color.setHex(base).lerp(highlightColor, tint)
          mesh.setColorAt(piece.instanceId, perVertex ? WHITE : color)
        }
      }
      previousColors = colors
      previousRegionColors = regionColors
      const selectionChanged = previousSelected !== selected || !appearanceSet
      previousSelected = selected
      previousHovered = hovered
      appearanceSet = true
      previousSelectedIds = selectedIds
      previousHoveredIds = hoveredIds
      if (selectionChanged) {
        selectedPieces = [...selectedIds].flatMap((id) => {
          const piece = byId.get(id)
          return piece ? [piece] : []
        })
        sourceBounds.makeEmpty()
        let vertices = 0
        let edgeVertices = 0
        const indices = source.geometry.index!
        const edgeIndices = sourceOutlines.geometry.index!
        for (const piece of selectedPieces) {
          sourceBounds.union(piece.bounds)
          for (let i = 0; i < piece.range.count; i += 1) {
            indices.setX(vertices++, piece.range.start + i)
          }
          for (let i = 0; i < piece.edgeCount; i += 1) {
            edgeIndices.setX(edgeVertices++, piece.edgeStart + i)
          }
        }
        indices.needsUpdate = true
        edgeIndices.needsUpdate = true
        source.geometry.setDrawRange(0, vertices)
        sourceOutlines.geometry.setDrawRange(0, edgeVertices)
      }
      const first = selectedPieces[0]
      if (first) {
        connector.material.color.setHex(colors?.get(first.group.id) ?? first.group.color)
      }
      syncConnector()
    },
    setAmount: (next: number) => {
      next = readExplodeAmount(next)
      if (next === amount) {
        return
      }
      amount = next
      const fade = Math.min(1, amount / FADE_IN)
      // Keep one shader variant throughout the fade. Single-pass double-sided
      // rendering avoids a second draw without compiling another program mid-motion.
      material.depthWrite = fade === 1
      material.opacity = fade
      mesh.visible = amount > ASSEMBLED
      outlines.visible = mesh.visible
      outlines.material.opacity = theme.edgeOpacity * fade
      amountUniform.value = amount
      for (const piece of pieces) {
        const offset = piece.group.offset
        matrix.makeTranslation(offset.x * amount, offset.y * amount, offset.z * amount)
        mesh.setMatrixAt(piece.instanceId, matrix)
      }
      mesh.computeBoundingBox()
      outlines.geometry.boundingBox!.copy(mesh.boundingBox!)
      syncConnector()
    },
    dispose: () => {
      object.clear()
      mesh.dispose()
      material.dispose()
      for (const drawn of [outlines, source, sourceOutlines, connector]) {
        drawn.geometry.dispose()
        drawn.material.dispose()
      }
    },
  }
}
