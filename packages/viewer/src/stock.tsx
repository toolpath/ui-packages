import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { type BufferGeometry, BoxGeometry, Vector3 } from 'three'
import type { Vec3 } from './model/types.js'
import { boxStockBounds, createStock } from './render/stock.js'

export interface StockProps {
  /** Caller-owned stock mesh in the same millimetre, Z-up coordinates as the part. */
  geometry: BufferGeometry
  color?: number
  opacity?: number
  edgeColor?: number
  edgeOpacity?: number
  showEdges?: boolean
}

/** Translucent stock, included in Fit but ignored by picking, sections and measurements. */
export const Stock = ({
  geometry,
  color = 0xb9cbe2,
  opacity = 0.2,
  edgeColor = 0xa8bdd8,
  edgeOpacity = 0.75,
  showEdges = true,
}: StockProps) => {
  const invalidate = useThree((state) => state.invalidate)
  const stock = useMemo(() => createStock(geometry), [geometry])
  useEffect(() => () => stock.dispose(), [stock])
  useLayoutEffect(() => {
    stock.material.color.setHex(color)
    stock.material.opacity = opacity
    stock.edgeMaterial.color.setHex(edgeColor)
    stock.edgeMaterial.opacity = edgeOpacity
    stock.edges.visible = showEdges
    invalidate()
  }, [color, edgeColor, edgeOpacity, invalidate, opacity, showEdges, stock])
  return <primitive object={stock.object} dispose={null} />
}

export interface BoxStockProps extends Omit<StockProps, 'geometry'> {
  partGeometry: BufferGeometry
  /** Padding on each side, in millimetres. Defaults to zero. */
  allowance?: number | Vec3
  /** Translation from the part's bounding-box centre, in millimetres. */
  offset?: Vec3
}

/** An axis-aligned blank around the part. Use Stock for an arbitrary stock mesh. */
export const BoxStock = ({ partGeometry, allowance = 0, offset, ...props }: BoxStockProps) => {
  const x = typeof allowance === 'number' ? allowance : allowance.x
  const y = typeof allowance === 'number' ? allowance : allowance.y
  const z = typeof allowance === 'number' ? allowance : allowance.z
  const ox = offset?.x ?? 0
  const oy = offset?.y ?? 0
  const oz = offset?.z ?? 0
  const geometry = useMemo(() => {
    const box = boxStockBounds(partGeometry, { x, y, z }, { x: ox, y: oy, z: oz })
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    return new BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z)
  }, [ox, oy, oz, partGeometry, x, y, z])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <Stock geometry={geometry} {...props} />
}
