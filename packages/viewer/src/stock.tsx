import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'
import { parseStockGlb } from './render/stock-mesh.js'
import { createStockMeshBuffer } from './render/stock-mesh-buffer.js'
import {
  type BoxStockInput,
  boxStockGeometry,
  createStock,
  cylinderStockGeometry,
  type CylinderStockInput,
} from './render/stock.js'

export interface StockAppearanceProps {
  /** Keep the preceding decoded GLB visible until its replacement is ready. Key by part/run to reset. */
  retainPrevious?: boolean
  /** Reproduce the legacy Workpiece's materials, duplicate surface pass and edge ordering. */
  renderStyle?: 'overlay' | 'legacy-workpiece'
  color?: number
  /** Unlit surface contribution, useful for readable workpiece shading beside the CAD model. */
  emissive?: number
  /** Shade each triangle independently without changing the source's vertices or normals. */
  flatShading?: boolean
  opacity?: number
  edgeColor?: number
  edgeOpacity?: number
  showEdges?: boolean
}

interface StockSources {
  /** Caller-owned geometry; Stock never disposes it. */
  geometry: BufferGeometry
  /** Caller-provided GLB bytes; Stock owns and cleans up the decoded geometry. */
  glb: ArrayBuffer
  /** Resolved box corners/frame, or part-relative box preview options. */
  box: BoxStockInput
  /** Resolved cylinder placement, or part-relative cylinder preview options. */
  cylinder: CylinderStockInput
}

/** Exactly one source, in the same millimetre, Z-up coordinates as the part. */
export type StockSource = {
  [K in keyof StockSources]: Pick<StockSources, K> &
    Partial<Record<Exclude<keyof StockSources, K>, never>>
}[keyof StockSources]

export type StockProps = StockAppearanceProps & StockSource

/** Translucent stock, included in Fit but ignored by picking, sections and measurements. */
export const Stock = ({ geometry, glb, box, cylinder, ...appearance }: StockProps) =>
  geometry ? (
    <GeometryStock geometry={geometry} {...appearance} />
  ) : glb ? (
    <GlbStock glb={glb} {...appearance} />
  ) : (
    <ShapeStock box={box} cylinder={cylinder} {...appearance} />
  )

/** One renderer for caller-owned geometry and internally decoded GLB meshes. */
const GeometryStock = ({
  geometry,
  renderStyle = 'overlay',
  color = renderStyle === 'legacy-workpiece' ? 0xffffff : 0xb9cbe2,
  emissive = renderStyle === 'legacy-workpiece' ? 0x3c4051 : 0x000000,
  flatShading = renderStyle === 'legacy-workpiece',
  opacity = 0.2,
  edgeColor = renderStyle === 'legacy-workpiece' ? 0x000000 : 0xa8bdd8,
  edgeOpacity = renderStyle === 'legacy-workpiece' ? 0.5 : 0.75,
  showEdges = true,
}: StockAppearanceProps & { geometry: BufferGeometry }) => {
  const invalidate = useThree((state) => state.invalidate)
  const stock = useMemo(
    () => createStock(geometry, renderStyle === 'legacy-workpiece'),
    [geometry, renderStyle],
  )
  useEffect(() => () => stock.dispose(), [stock])
  useLayoutEffect(() => {
    stock.material.color.setHex(color)
    stock.material.emissive.setHex(emissive)
    if (stock.material.flatShading !== flatShading) {
      stock.material.flatShading = flatShading
      stock.material.needsUpdate = true
    }
    stock.material.opacity = opacity
    stock.material.depthWrite = renderStyle === 'legacy-workpiece' && opacity === 1
    stock.material.polygonOffset = renderStyle === 'legacy-workpiece' && opacity === 1
    stock.material.polygonOffsetFactor = 1
    stock.material.polygonOffsetUnits = 1
    stock.edgeMaterial.color.setHex(edgeColor)
    stock.edgeMaterial.opacity = edgeOpacity
    stock.showEdges(showEdges)
    invalidate()
  }, [
    color,
    emissive,
    flatShading,
    edgeColor,
    edgeOpacity,
    invalidate,
    opacity,
    renderStyle,
    showEdges,
    stock,
  ])
  return <primitive object={stock.object} dispose={null} />
}

const GlbStock = ({
  glb,
  retainPrevious = false,
  ...appearance
}: StockAppearanceProps & { glb: ArrayBuffer }) => {
  const buffer = useMemo(() => createStockMeshBuffer(), [])
  const [decoded, setDecoded] = useState<{
    source: ArrayBuffer
    geometries?: BufferGeometry[]
    error?: Error
  } | null>(null)

  useEffect(() => () => buffer.dispose(), [buffer])
  useLayoutEffect(() => {
    buffer.commit(decoded?.geometries ?? [])
  }, [buffer, decoded])
  useEffect(
    () =>
      buffer.request(
        () => parseStockGlb(glb),
        (geometries) => {
          setDecoded({ source: glb, geometries })
        },
        (cause: unknown) => {
          setDecoded({
            source: glb,
            error: cause instanceof Error ? cause : new Error(String(cause)),
          })
        },
      ),
    [buffer, glb],
  )

  // Retention is opt-in: playback can hold its current IPG through the next decode.
  if (!decoded || (!retainPrevious && decoded.source !== glb)) return null
  if (decoded.error) throw decoded.error
  return decoded.geometries?.map((geometry) => (
    <GeometryStock key={geometry.uuid} geometry={geometry} {...appearance} />
  ))
}

/** Figure geometry is owned here; equivalent figures do not rebuild it. */
const ShapeStock = ({
  box,
  cylinder,
  ...appearance
}: StockAppearanceProps & {
  box?: BoxStockInput
  cylinder?: CylinderStockInput
}) => {
  const isBox = box !== undefined
  const partGeometry = box?.partGeometry ?? cylinder?.partGeometry
  const figure = JSON.stringify(
    box
      ? box.partGeometry
        ? {
            dimensions: box.dimensions,
            allowance: box.allowance,
            offset: box.offset,
            position: box.position,
            positionOffset: box.positionOffset,
          }
        : { frame: box.frame, lower: box.lower, upper: box.upper }
      : cylinder!.partGeometry
        ? {
            diameter: cylinder!.diameter,
            length: cylinder!.length,
            position: cylinder!.position,
            positionOffset: cylinder!.positionOffset,
          }
        : {
            origin: cylinder!.origin,
            axis: cylinder!.axis,
            diameter: cylinder!.diameter,
            length: cylinder!.length,
          },
  )
  const geometry = useMemo(() => {
    const options = JSON.parse(figure)
    const input = partGeometry ? { ...options, partGeometry } : options
    return isBox
      ? boxStockGeometry(input as BoxStockInput)
      : cylinderStockGeometry(input as CylinderStockInput)
  }, [figure, isBox, partGeometry])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <GeometryStock geometry={geometry} {...appearance} />
}
