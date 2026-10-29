import { Box3, BoxGeometry, BufferGeometry, Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { collectionBounds, collectionExplodeOffsets } from '../src/model/collection.js'
import { createExplodeAmount } from '../src/model/explode-amount.js'
import type { Vec3 } from '../src/model/types.js'
import { createCollectionPlacement, offsetsKey } from '../src/render/collection-placement.js'

/** A box body of the given size, centred at the given point. */
const body = (id: string, size: Vec3, at: Vec3 = { x: 0, y: 0, z: 0 }) => ({
  id,
  geometry: new BoxGeometry(size.x, size.y, size.z).translate(at.x, at.y, at.z),
})

const cube = (id: string, edge: number, at?: Vec3) => body(id, { x: edge, y: edge, z: edge }, at)

/** Each body's box once moved by its full offset. */
const exploded = (
  items: ReadonlyArray<{ id: string; geometry: BufferGeometry }>,
  offsets: ReadonlyMap<string, Vec3>,
) =>
  items.map(({ id, geometry }) => {
    geometry.computeBoundingBox()
    const offset = offsets.get(id)!
    return geometry.boundingBox!.clone().translate(new Vector3(offset.x, offset.y, offset.z))
  })

/** The largest space between two boxes along any one axis; negative when they overlap. */
const spaceBetween = (a: Box3, b: Box3) =>
  Math.max(
    ...(['x', 'y', 'z'] as const).map((axis) =>
      Math.max(b.min[axis] - a.max[axis], a.min[axis] - b.max[axis]),
    ),
  )

const gapOf = (items: ReadonlyArray<{ id: string; geometry: BufferGeometry }>, gap = 0.05) =>
  gap * collectionBounds(items).getSize(new Vector3()).length()

describe('collectionExplodeOffsets', () => {
  it('leaves an empty collection empty and a single body where it is', () => {
    expect(collectionExplodeOffsets([]).size).toBe(0)
    const offsets = collectionExplodeOffsets([cube('only', 10, { x: 40, y: 0, z: 0 })])
    expect(offsets.get('only')).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('moves a touching neighbour along the line from the centre until the gap is clear', () => {
    const items = [cube('a', 10, { x: -5, y: 0, z: 0 }), cube('b', 10, { x: 5, y: 0, z: 0 })]
    const offsets = collectionExplodeOffsets(items)
    // Equally far from the centre: `a` comes first in the list, so it stays.
    expect(offsets.get('a')).toEqual({ x: 0, y: 0, z: 0 })
    const b = offsets.get('b')!
    expect(b.x).toBeCloseTo(gapOf(items))
    expect(b.y).toBe(0)
    expect(b.z).toBe(0)
  })

  it('spreads bodies centred on the collection up, stacked in list order', () => {
    const items = [cube('shell', 20), cube('core', 4), cube('pin', 2)]
    const offsets = collectionExplodeOffsets(items)
    const gap = gapOf(items)
    expect(offsets.get('shell')).toEqual({ x: 0, y: 0, z: 0 })
    const core = offsets.get('core')!
    const pin = offsets.get('pin')!
    expect([core.x, core.y, pin.x, pin.y]).toEqual([0, 0, 0, 0])
    // Above the shell, then above the core, each a gap clear.
    expect(core.z - 2).toBeCloseTo(10 + gap)
    expect(pin.z - 1).toBeCloseTo(core.z + 2 + gap)
  })

  it('clears every pair of boxes by the gap, moving each away from the centre', () => {
    // Overlapping bodies of different sizes, nested and off-centre, placed by a fixed sequence.
    let seed = 7
    const next = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const items = Array.from({ length: 12 }, (_, index) =>
      body(
        `body-${index}`,
        { x: 2 + next() * 30, y: 2 + next() * 30, z: 2 + next() * 30 },
        { x: next() * 40 - 20, y: next() * 40 - 20, z: next() * 40 - 20 },
      ),
    )
    const offsets = collectionExplodeOffsets(items)
    const boxes = exploded(items, offsets)
    const gap = gapOf(items)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(spaceBetween(boxes[i]!, boxes[j]!)).toBeGreaterThanOrEqual(gap - 1e-9)
      }
    }
    const centre = collectionBounds(items).getCenter(new Vector3())
    for (const { id, geometry } of items) {
      const offset = offsets.get(id)!
      const moved = new Vector3(offset.x, offset.y, offset.z)
      const away = geometry.boundingBox!.getCenter(new Vector3()).sub(centre)
      expect(moved.clone().cross(away).length()).toBeLessThan(1e-6 * (1 + moved.length()))
      expect(moved.dot(away)).toBeGreaterThanOrEqual(0)
    }
    // Something had to move, and the same bodies give the same answer.
    expect([...offsets.values()].some(({ x, y, z }) => x || y || z)).toBe(true)
    expect(offsetsKey(collectionExplodeOffsets(items))).toBe(offsetsKey(offsets))
  })

  it('takes the gap as a fraction of the collection diagonal', () => {
    const items = [cube('a', 10, { x: -5, y: 0, z: 0 }), cube('b', 10, { x: 5, y: 0, z: 0 })]
    // Touching boxes are already clear without a gap.
    expect(collectionExplodeOffsets(items, { gap: 0 }).get('b')).toEqual({ x: 0, y: 0, z: 0 })
    expect(collectionExplodeOffsets(items, { gap: 0.2 }).get('b')!.x).toBeCloseTo(gapOf(items, 0.2))
  })

  it('gives a body with no geometry no offset, and rejects ambiguous identities', () => {
    const offsets = collectionExplodeOffsets([
      cube('a', 10),
      { id: 'empty', geometry: new BufferGeometry() },
      cube('b', 4),
    ])
    expect(offsets.get('empty')).toEqual({ x: 0, y: 0, z: 0 })
    expect(offsets.get('b')!.z).toBeGreaterThan(0)
    expect(() => collectionExplodeOffsets([cube('a', 1), cube('a', 2)])).toThrow(/Duplicate/)
  })
})

describe('collectionBounds with offsets', () => {
  it('holds every item both in place and moved by its full offset', () => {
    const items = [cube('a', 10), cube('b', 2, { x: 20, y: 0, z: 0 })]
    const assembled = collectionBounds(items)
    expect(collectionBounds(items, {})).toEqual(assembled)
    const apart = collectionBounds(items, { offsets: new Map([['b', { x: 0, y: 0, z: 30 }]]) })
    expect(apart.min.toArray()).toEqual([-5, -5, -5])
    expect(apart.max.toArray()).toEqual([21, 5, 31])
    // Moved toward the middle, the item still counts where it starts.
    const inward = collectionBounds(items, { offsets: new Map([['b', { x: -20, y: 0, z: 0 }]]) })
    expect(inward).toEqual(assembled)
    // Measuring does not move the geometry.
    expect(items[1]!.geometry.boundingBox!.min.z).toBe(-1)
  })
})

describe('collection placement', () => {
  it('moves each group by its offset times the amount, and writes only on a change', () => {
    const placement = createCollectionPlacement()
    const [a, b] = [new Group(), new Group()]
    placement.add('a', a)
    placement.add('b', b)
    const offsets = new Map([['a', { x: 10, y: -4, z: 2 }]])
    expect(placement.place(offsets, 0.5)).toBe(true)
    expect(a.position.toArray()).toEqual([5, -2, 1])
    expect(b.position.toArray()).toEqual([0, 0, 0])
    expect(placement.place(offsets, 0.5)).toBe(false)
    // Clamped like every explode amount.
    expect(placement.place(offsets, 3)).toBe(true)
    expect(a.position.toArray()).toEqual([10, -4, 2])

    const amount = createExplodeAmount(0)
    placement.place(offsets, amount)
    expect(a.position.length()).toBe(0)
    amount.set(0.25)
    expect(placement.place(offsets, amount)).toBe(true)
    expect(a.position.x).toBe(2.5)

    // A group added later is placed on the next call, and no offsets put everything back.
    const c = new Group()
    const release = placement.add('c', c)
    expect(placement.place(new Map([['c', { x: 0, y: 8, z: 0 }]]), 1)).toBe(true)
    expect(c.position.y).toBe(8)
    expect(placement.place(null, amount)).toBe(true)
    expect([a, b, c].map((group) => group.position.length())).toEqual([0, 0, 0])
    release()
    c.position.set(1, 1, 1)
    placement.place(new Map([['c', { x: 0, y: 8, z: 0 }]]), 1)
    expect(c.position.toArray()).toEqual([1, 1, 1])
  })
})
