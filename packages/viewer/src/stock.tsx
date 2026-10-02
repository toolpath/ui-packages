import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'
import { parseStockGlb } from './render/stock-mesh.js'
import {
  type BoxStockInput,
  boxStockGeometry,
  createStock,
  cylinderStockGeometry,
  type CylinderStockInput,
} from './render/stock.js'

export interface StockAppearanceProps {
  color?: number
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
  color = 0xb9cbe2,
  opacity = 0.2,
  edgeColor = 0xa8bdd8,
  edgeOpacity = 0.75,
  showEdges = true,
}: StockAppearanceProps & { geometry: BufferGeometry }) => {
  const invalidate = useThree((state) => state.invalidate)
  const stock = useMemo(() => createStock(geometry), [geometry])
  useEffect(() => () => stock.dispose(), [stock])
  useLayoutEffect(() => {
    stock.material.color.setHex(color)
    stock.material.opacity = opacity
    stock.edgeMaterial.color.setHex(edgeColor)
    stock.edgeMaterial.opacity = edgeOpacity
    stock.showEdges(showEdges)
    invalidate()
  }, [color, edgeColor, edgeOpacity, invalidate, opacity, showEdges, stock])
  return <primitive object={stock.object} dispose={null} />
}

const GlbStock = ({ glb, ...appearance }: StockAppearanceProps & { glb: ArrayBuffer }) => {
  const [decoded, setDecoded] = useState<{
    source: ArrayBuffer
    geometries?: BufferGeometry[]
    error?: Error
  } | null>(null)

  useEffect(() => {
    let active = true
    let owned: BufferGeometry[] = []
    parseStockGlb(glb).then(
      (geometries) => {
        if (!active) {
          geometries.forEach((geometry) => geometry.dispose())
          return
        }
        owned = geometries
        setDecoded({ source: glb, geometries })
      },
      (cause: unknown) => {
        if (active) {
          setDecoded({
            source: glb,
            error: cause instanceof Error ? cause : new Error(String(cause)),
          })
        }
      },
    )
    return () => {
      active = false
      owned.forEach((geometry) => geometry.dispose())
    }
  }, [glb])

  // A changed source must not display the preceding action while it decodes.
  if (decoded?.source !== glb) return null
  if (decoded.error) throw decoded.error
  return decoded.geometries?.map((geometry) => (
    <GeometryStock key={geometry.uuid} geometry={geometry} {...appearance} />
  ))
}

/**
 * JSON alone writes NaN and Infinity as null, which the builders would read as
 * an absent value instead of rejecting with RangeError. No figure field is a
 * string that could be mistaken for one of these.
 */
const keepNonFinite = (_key: string, value: unknown) =>
  typeof value === 'number' && !Number.isFinite(value) ? String(value) : value
const restoreNonFinite = (_key: string, value: unknown) =>
  value === 'NaN' || value === 'Infinity' || value === '-Infinity' ? Number(value) : value

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
    keepNonFinite,
  )
  const geometry = useMemo(() => {
    const options = JSON.parse(figure, restoreNonFinite)
    const input = partGeometry ? { ...options, partGeometry } : options
    return isBox
      ? boxStockGeometry(input as BoxStockInput)
      : cylinderStockGeometry(input as CylinderStockInput)
  }, [figure, isBox, partGeometry])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <GeometryStock geometry={geometry} {...appearance} />
}
