import { EXCLUDE_FROM_FRAME } from './camera.js'
import { regionEdgesGeometry } from './edges.js'
import { DEFAULT_EXPLODE_THEME, type ExplodeTheme } from './explode-theme.js'
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
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Vector3,
  Uint32BufferAttribute,
} from 'three'
import { explodeAmount, explodeTriangleCount, extractExplodeGroup } from './explode-geometry.js'
import type { ExplodeGroup } from '../model/explode.js'

const ignoreRay = () => {}
const WHITE = new Color(0xffffff)
const idsOf = (value: string | ReadonlyArray<string> | null) =>
  value === null ? [] : typeof value === 'string' ? [value] : value

/** One surface batch and one outline draw, with feature identities kept outside GPU batching. */
export const createExplodeBatch = (
  model: PartModel,
  geometry: BufferGeometry,
  groups: readonly ExplodeGroup[],
) => {
  const triangles = explodeTriangleCount(model, geometry, groups)
  if (groups.length === 0) {
    throw new Error('An explode batch needs at least one group.')
  }
  const material = new MeshLambertMaterial({
    color: 0xffffff,
    emissive: DEFAULT_EXPLODE_THEME.emissive,
    side: DoubleSide,
    forceSinglePass: true,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const mesh = new BatchedMesh(groups.length, triangles * 3, 0, material)
  mesh.name = 'explode-surfaces'
  mesh.renderOrder = 3
  mesh.frustumCulled = false
  // Three r159 already batches unique geometries, but predates separate instances
  // and per-instance colors. Keep the published peer floor: only the color storage
  // changes there, using the same shared geometry and matrix/raycast APIs.
  const instanceColors = typeof mesh.setColorAt === 'function'
  material.vertexColors = true
  let vertexStart = 0
  const edgeArrays: Array<Float32Array> = []
  let edgeVertices = 0
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
    const edgeStart = edgeVertices
    edgeVertices += points.length / 3
    edgeArrays.push(points)
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
    // BatchedMesh copied these attributes into its shared buffers.
    extracted.geometry.dispose()
    edges.dispose()
    return piece
  })
  const byId = new Map(pieces.map((piece) => [piece.group.id, piece]))
  const positions = new Float32Array(edgeVertices * 3)
  const offsets = new Float32Array(edgeVertices * 3)
  for (const [index, piece] of pieces.entries()) {
    positions.set(edgeArrays[index]!, piece.edgeStart * 3)
    for (let vertex = piece.edgeStart; vertex < piece.edgeStart + piece.edgeCount; vertex += 1) {
      offsets[vertex * 3] = piece.group.offset.x
      offsets[vertex * 3 + 1] = piece.group.offset.y
      offsets[vertex * 3 + 2] = piece.group.offset.z
    }
  }
  const edgeGeometry = new BufferGeometry()
  edgeGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  edgeGeometry.setAttribute('aExplodeOffset', new Float32BufferAttribute(offsets, 3))
  edgeGeometry.boundingBox = new Box3()
  const amountUniform = { value: 0 }
  const edgeMaterial = new LineBasicMaterial({
    color: DEFAULT_EXPLODE_THEME.edge,
    transparent: true,
    depthWrite: false,
  })
  edgeMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uExplodeAmount = amountUniform
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
  const edges = new LineSegments(edgeGeometry, edgeMaterial)
  edges.name = 'explode-edges'
  edges.renderOrder = 4
  edges.frustumCulled = false
  edges.raycast = ignoreRay

  // The source highlight shares the batch's immutable vertex buffers. Changing
  // selection changes draw ranges, not geometry, materials, or shader programs.
  const originGeometry = new BufferGeometry()
  originGeometry.setAttribute('position', mesh.geometry.getAttribute('position'))
  originGeometry.setAttribute('normal', mesh.geometry.getAttribute('normal'))
  originGeometry.setIndex(new Uint32BufferAttribute(new Uint32Array(triangles * 3), 1))
  originGeometry.setDrawRange(0, 0)
  const originMaterial = new MeshLambertMaterial({
    color: new Color(DEFAULT_EXPLODE_THEME.source).lerp(WHITE, 0.45),
    emissive: DEFAULT_EXPLODE_THEME.emissive,
    side: DoubleSide,
    transparent: true,
    forceSinglePass: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const origin = new Mesh(originGeometry, originMaterial)
  origin.name = 'explode-origin'
  origin.visible = false
  origin.renderOrder = 3
  origin.frustumCulled = false
  origin.raycast = ignoreRay
  origin.userData[EXCLUDE_FROM_FRAME] = true
  const originEdgesGeometry = new BufferGeometry()
  originEdgesGeometry.setAttribute('position', edgeGeometry.getAttribute('position'))
  originEdgesGeometry.setIndex(new Uint32BufferAttribute(new Uint32Array(edgeVertices), 1))
  originEdgesGeometry.setDrawRange(0, 0)
  const originEdgesMaterial = new LineBasicMaterial({
    color: DEFAULT_EXPLODE_THEME.edge,
    transparent: true,
    opacity: DEFAULT_EXPLODE_THEME.edgeOpacity,
  })
  const originEdges = new LineSegments(originEdgesGeometry, originEdgesMaterial)
  originEdges.visible = false
  originEdges.renderOrder = 4
  originEdges.frustumCulled = false
  originEdges.raycast = ignoreRay
  originEdges.userData[EXCLUDE_FROM_FRAME] = true
  const connectorGeometry = new BufferGeometry()
  connectorGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3))
  const connectorMaterial = new LineBasicMaterial({
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const connector = new LineSegments(connectorGeometry, connectorMaterial)
  connector.visible = false
  connector.frustumCulled = false
  connector.raycast = ignoreRay
  connector.userData[EXCLUDE_FROM_FRAME] = true
  const object = new Group()
  object.add(mesh, edges, origin, originEdges, connector)
  const matrix = new Matrix4()
  const color = new Color()
  const selectedColor = new Color()
  const highlightColor = new Color()
  let theme = DEFAULT_EXPLODE_THEME
  let selectedPieces: typeof pieces = []
  const sourceBounds = new Box3()
  const placedBounds = new Box3()
  const movedBounds = new Box3()
  const point = new Vector3()
  let amount = -1
  let previousColors: ReadonlyMap<string, number> | undefined
  let previousRegionColors: ReadonlyMap<string, ReadonlyMap<number, number>> | undefined
  let previousSelected: string | ReadonlyArray<string> | null | undefined
  let previousHovered: string | ReadonlyArray<string> | null | undefined
  let previousSelectedIds = new Set<string>()
  let previousHoveredIds = new Set<string>()
  let appearanceSet = false
  const syncConnector = () => {
    const visible = selectedPieces.length > 0 && amount > 0.0001
    origin.visible = visible
    originEdges.visible = visible
    connector.visible = visible
    if (selectedPieces.length === 0) {
      return
    }
    const points = connectorGeometry.getAttribute('position')
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
  return {
    object,
    mesh,
    pieces,
    hit: (batchId: number | undefined, faceIndex: number | undefined) => {
      if (batchId === undefined || faceIndex === undefined) {
        return null
      }
      const piece = pieces[batchId]
      const local = piece ? faceIndex - piece.range.start / 3 : -1
      return piece && local >= 0 && local < piece.sourceTriangles.length
        ? { group: piece.group, triangleIndex: piece.sourceTriangles[local]! }
        : null
    },
    setAppearance: (
      colors: ReadonlyMap<string, number> | undefined,
      selected: string | ReadonlyArray<string> | null,
      hovered: string | ReadonlyArray<string> | null,
      nextTheme: ExplodeTheme = DEFAULT_EXPLODE_THEME,
      regionColors?: ReadonlyMap<string, ReadonlyMap<number, number>>,
    ) => {
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
        originMaterial.emissive.setHex(theme.emissive)
        originMaterial.color.setHex(theme.source).lerp(WHITE, 0.45)
        edgeMaterial.color.setHex(theme.edge)
        edgeMaterial.opacity = theme.edgeOpacity * Math.min(1, Math.max(0, amount) / 0.1)
        originEdgesMaterial.color.setHex(theme.edge)
        originEdgesMaterial.opacity = theme.edgeOpacity
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
        const tint = selectedIds.has(id) ? 0.45 : hoveredIds.has(id) ? 0.25 : 0
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
        const indices = originGeometry.index!
        const edgeIndices = originEdgesGeometry.index!
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
        originGeometry.setDrawRange(0, vertices)
        originEdgesGeometry.setDrawRange(0, edgeVertices)
      }
      const first = selectedPieces[0]
      if (first) {
        selectedColor.setHex(colors?.get(first.group.id) ?? first.group.color)
        connectorMaterial.color.copy(selectedColor)
      }
      syncConnector()
    },
    setAmount: (next: number) => {
      next = explodeAmount(next)
      if (next === amount) {
        return
      }
      amount = next
      const fade = Math.min(1, amount / 0.1)
      // Keep one shader variant throughout the fade. Single-pass double-sided
      // rendering avoids a second draw without compiling another program mid-motion.
      material.depthWrite = fade === 1
      material.opacity = fade
      mesh.visible = amount > 0.0001
      edges.visible = mesh.visible
      edgeMaterial.opacity = theme.edgeOpacity * fade
      amountUniform.value = amount
      for (const piece of pieces) {
        const offset = piece.group.offset
        matrix.makeTranslation(offset.x * amount, offset.y * amount, offset.z * amount)
        mesh.setMatrixAt(piece.instanceId, matrix)
      }
      mesh.computeBoundingBox()
      edgeGeometry.boundingBox!.copy(mesh.boundingBox!)
      syncConnector()
    },
    dispose: () => {
      object.clear()
      mesh.dispose()
      material.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      originGeometry.dispose()
      originMaterial.dispose()
      originEdgesGeometry.dispose()
      originEdgesMaterial.dispose()
      connectorGeometry.dispose()
      connectorMaterial.dispose()
    },
  }
}
