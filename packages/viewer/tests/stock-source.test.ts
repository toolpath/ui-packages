import { BufferGeometry } from 'three'
import { expectTypeOf, it } from 'vitest'
import type { StockProps } from '../src/stock.js'

it('accepts exactly one geometry, GLB, box or cylinder source, with shared appearance props', () => {
  const box = { lower: { x: 0, y: 0, z: 0 }, upper: { x: 10, y: 20, z: 30 } }
  const cylinder = {
    origin: { x: 0, y: 0, z: 0 },
    axis: { x: 0, y: 0, z: 1 },
    diameter: 10,
    length: 20,
  }
  expectTypeOf({ geometry: new BufferGeometry(), opacity: 0.3 }).toExtend<StockProps>()
  expectTypeOf({ glb: new ArrayBuffer(0), showEdges: false }).toExtend<StockProps>()
  expectTypeOf({ glb: new ArrayBuffer(0), retainPrevious: true }).toExtend<StockProps>()
  expectTypeOf({
    glb: new ArrayBuffer(0),
    renderStyle: 'legacy-workpiece' as const,
  }).toExtend<StockProps>()
  expectTypeOf({
    glb: new ArrayBuffer(0),
    emissive: 0x3c4051,
    flatShading: true,
  }).toExtend<StockProps>()
  expectTypeOf({ box, color: 0xff0000 }).toExtend<StockProps>()
  expectTypeOf({ cylinder, edgeOpacity: 0.5 }).toExtend<StockProps>()
  expectTypeOf({
    box: {
      partGeometry: new BufferGeometry(),
      dimensions: { x: 10, y: 20, z: 30 },
      position: 'offset_from_top' as const,
      positionOffset: 2,
    },
  }).toExtend<StockProps>()
  expectTypeOf({
    box: { partGeometry: new BufferGeometry(), allowance: { wall: 2, floor: 3 } },
  }).toExtend<StockProps>()
  expectTypeOf({
    cylinder: { partGeometry: new BufferGeometry(), diameter: 10, length: 20 },
  }).toExtend<StockProps>()
  // @ts-expect-error Resolved box placement and preview options cannot be mixed.
  expectTypeOf({ box: { ...box, partGeometry: new BufferGeometry() } }).toExtend<StockProps>()
  // @ts-expect-error A resolved box is already placed; an offset would be ignored.
  expectTypeOf({ box: { ...box, offset: { x: 5, y: 0, z: 0 } } }).toExtend<StockProps>()
  // @ts-expect-error A resolved box is already sized; an allowance would be ignored.
  expectTypeOf({ box: { ...box, allowance: 3 } }).toExtend<StockProps>()
  // @ts-expect-error A resolved box is already sized; dimensions would be ignored.
  expectTypeOf({ box: { ...box, dimensions: { x: 1, y: 1, z: 1 } } }).toExtend<StockProps>()
  // @ts-expect-error A resolved box is already placed; a position would be ignored.
  expectTypeOf({ box: { ...box, position: 'offset_from_top' as const } }).toExtend<StockProps>()
  const mixedCylinder = { cylinder: { ...cylinder, partGeometry: new BufferGeometry() } }
  const mixedBoxSizing = {
    box: { partGeometry: new BufferGeometry(), dimensions: { x: 10, y: 20, z: 30 }, allowance: 2 },
  }
  const incompleteCylinder = { cylinder: { partGeometry: new BufferGeometry(), diameter: 10 } }
  // @ts-expect-error Resolved cylinder placement and preview options cannot be mixed.
  expectTypeOf(mixedCylinder).toExtend<StockProps>()
  // @ts-expect-error Fixed box dimensions and allowance sizing are alternative preview modes.
  expectTypeOf(mixedBoxSizing).toExtend<StockProps>()
  // @ts-expect-error A cylinder preview requires diameter and length.
  expectTypeOf(incompleteCylinder).toExtend<StockProps>()
  // @ts-expect-error Exactly one source is required.
  expectTypeOf({ geometry: new BufferGeometry(), glb: new ArrayBuffer(0) }).toExtend<StockProps>()
  // @ts-expect-error A source cannot be omitted.
  expectTypeOf({ opacity: 0.3 }).toExtend<StockProps>()
  // @ts-expect-error Shape sources are also mutually exclusive.
  expectTypeOf({ box, cylinder }).toExtend<StockProps>()
  // @ts-expect-error Geometry and box cannot be supplied together.
  expectTypeOf({ geometry: new BufferGeometry(), box }).toExtend<StockProps>()
  // @ts-expect-error Geometry and cylinder cannot be supplied together.
  expectTypeOf({ geometry: new BufferGeometry(), cylinder }).toExtend<StockProps>()
  // @ts-expect-error GLB and box cannot be supplied together.
  expectTypeOf({ glb: new ArrayBuffer(0), box }).toExtend<StockProps>()
  // @ts-expect-error GLB and cylinder cannot be supplied together.
  expectTypeOf({ glb: new ArrayBuffer(0), cylinder }).toExtend<StockProps>()
})
