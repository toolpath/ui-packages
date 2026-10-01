import { BufferGeometry } from 'three'
import { expectTypeOf, it } from 'vitest'
import type { BoxStockProps, StockProps } from '../src/stock.js'

it('accepts one geometry or GLB source, with shared appearance props', () => {
  expectTypeOf({ geometry: new BufferGeometry(), opacity: 0.3 }).toExtend<StockProps>()
  expectTypeOf({ glb: new ArrayBuffer(0), showEdges: false }).toExtend<StockProps>()
  // @ts-expect-error Exactly one source is required.
  expectTypeOf({ geometry: new BufferGeometry(), glb: new ArrayBuffer(0) }).toExtend<StockProps>()
  // @ts-expect-error A source cannot be omitted.
  expectTypeOf({ opacity: 0.3 }).toExtend<StockProps>()
  expectTypeOf<BoxStockProps>().not.toHaveProperty('glb')
})
