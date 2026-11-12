import { BoxGeometry, BufferGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  collectionBounds,
  collectionExplodeOffsets,
  collectionItemAnchor,
} from '../src/model/collection.js'
import type { Vec3 } from '../src/model/types.js'
import {
  ASSEMBLY_APPEARANCE,
  ASSEMBLY_DEPTH_LAYER,
  collectionItemProps,
  type PartCollectionItem,
} from '../src/part-collection.js'
import { assemblyControl } from '../src/viewer-toolbar-context.js'
import { cubeModel } from './fixtures.js'

/** A cube body of the given edge, centred at the given point. */
const cube = (id: string, edge: number, at: Vec3) => ({
  id,
  geometry: new BoxGeometry(edge, edge, edge).translate(at.x, at.y, at.z),
})

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 }

describe('collectionBounds with a subject', () => {
  const part = cube('part', 10, ORIGIN)
  const fixture = cube('fixture', 10, { x: 100, y: 0, z: 0 })

  it('measures every item without a subject: the whole assembly', () => {
    const box = collectionBounds([part, fixture])
    expect(box.min.toArray()).toEqual([-5, -5, -5])
    expect(box.max.toArray()).toEqual([105, 5, 5])
    expect(collectionBounds([part, fixture], { subject: null }).equals(box)).toBe(true)
  })

  it('leaves the assembly round the subject out', () => {
    const box = collectionBounds([part, fixture], { subject: 'part' })
    expect(box.min.toArray()).toEqual([-5, -5, -5])
    expect(box.max.toArray()).toEqual([5, 5, 5])
  })

  it('measures nothing for a subject drawn outside the collection, as for an empty one', () => {
    const box = collectionBounds([part, fixture], { subject: 'elsewhere' })
    expect(box.isEmpty()).toBe(true)
    expect(box.equals(collectionBounds([]))).toBe(true)
  })

  it('leaves the assembly out of the explode extent too, even with nothing else', () => {
    const offsets = new Map<string, Vec3>([
      ['part', { x: 0, y: 0, z: 20 }],
      ['fixture', { x: 0, y: 0, z: 200 }],
    ])
    const box = collectionBounds([part, fixture], { offsets, subject: 'part' })
    expect(box.max.toArray()).toEqual([5, 5, 25])
    const none = collectionBounds([part, fixture], { offsets, subject: 'elsewhere' })
    expect(none.isEmpty()).toBe(true)
  })

  it('still refuses two items with one id, whatever the subject', () => {
    expect(() =>
      collectionBounds([part, { ...fixture, id: 'part' }], { subject: 'fixture' }),
    ).toThrow(/Duplicate/)
  })
})

describe('collectionExplodeOffsets with a subject', () => {
  const a = cube('a', 10, { x: -5, y: 0, z: 0 })
  const b = cube('b', 10, { x: 5, y: 0, z: 0 })
  const housing = cube('housing', 40, { x: 30, y: 0, z: 0 })

  it('pulls every item apart without a subject', () => {
    const offsets = collectionExplodeOffsets([a, b, housing])
    expect([...offsets.values()].some((offset) => offset !== ORIGIN)).toBe(true)
  })

  it('moves nothing given a subject: it stays, and the assembly round it stays', () => {
    for (const subject of ['a', 'housing', 'elsewhere']) {
      const offsets = collectionExplodeOffsets([a, b, housing], { subject })
      expect([...offsets.values()]).toEqual([ORIGIN, ORIGIN, ORIGIN])
    }
  })
})

describe('collectionItemAnchor', () => {
  const item = cube('part', 10, { x: 1, y: 2, z: 3 })

  it('is the top face’s centre by default, in the geometry’s own frame', () => {
    expect(collectionItemAnchor(item)).toEqual({ x: 1, y: 2, z: 8 })
    expect(collectionItemAnchor(item, 'top')).toEqual({ x: 1, y: 2, z: 8 })
  })

  it('is the box’s centre or its bottom face’s', () => {
    expect(collectionItemAnchor(item, 'centre')).toEqual({ x: 1, y: 2, z: 3 })
    expect(collectionItemAnchor(item, 'bottom')).toEqual({ x: 1, y: 2, z: -2 })
  })

  it('is the origin for an empty geometry', () => {
    expect(collectionItemAnchor({ id: 'empty', geometry: new BufferGeometry() })).toEqual(ORIGIN)
  })
})

describe('collectionItemProps', () => {
  const model = cubeModel()
  const geometry = new BoxGeometry()
  const item = (props: Partial<PartCollectionItem> = {}): PartCollectionItem => ({
    id: 'fixture',
    model,
    geometry,
    ...props,
  })
  /** Worked on as a part drawn elsewhere: the item is of the assembly round it. */
  const around = { subject: 'part' }

  it('draws the assembly faded and inert, with no hover and no cut, behind the subject', () => {
    const props = collectionItemProps(item(), around)
    expect(props).toMatchObject({
      opacity: ASSEMBLY_APPEARANCE.opacity,
      theme: ASSEMBLY_APPEARANCE.theme,
      display: 'solid',
      depthLayer: ASSEMBLY_DEPTH_LAYER,
      inert: true,
      hover: false,
      section: { enabled: false },
    })
    expect(ASSEMBLY_DEPTH_LAYER).toBe(63)
    expect(ASSEMBLY_APPEARANCE).toEqual({
      opacity: 0.5,
      theme: { part: 0x9ca3af, edgeOpacity: 0.6 },
      display: 'solid',
      depthLayer: 63,
    })
  })

  it("takes the collection's appearance over the defaults, and the item's own over both", () => {
    const appearance = { opacity: 0.7, theme: { part: 0xf59e0b }, display: 'wireframe' as const }
    expect(collectionItemProps(item(), { ...around, assembly: { appearance } })).toMatchObject({
      ...appearance,
      // The default edges stay unless a theme gives its own.
      theme: { part: 0xf59e0b, edgeOpacity: 0.6 },
      depthLayer: 63,
    })
    const own = collectionItemProps(item({ opacity: 0.6, theme: { edgeOpacity: 0.5 } }), {
      ...around,
      assembly: { appearance },
    })
    expect(own.opacity).toBe(0.6)
    // A theme replaces the one under it rather than merging with it, colour and all.
    expect(own.theme).toEqual({ edgeOpacity: 0.5 })
    expect(own.display).toBe('wireframe')
    // An undefined prop is no override.
    expect(collectionItemProps(item({ opacity: undefined }), around).opacity).toBe(0.5)
  })

  it('forces hover off, and keeps a section or depth layer the item gives', () => {
    const section = { enabled: true, offset: 0.5 }
    const props = collectionItemProps(item({ hover: true, section, depthLayer: 4 }), {
      ...around,
      assembly: { appearance: { depthLayer: 10 } },
    })
    expect(props.hover).toBe(false)
    expect(props.section).toBe(section)
    expect(props.depthLayer).toBe(4)
    const layered = { ...around, assembly: { appearance: { depthLayer: 10 } } }
    expect(collectionItemProps(item(), layered).depthLayer).toBe(10)
  })

  it('leaves the subject as it is, and every item without one', () => {
    const subject = item({ opacity: 0.5 })
    const assembly = { appearance: { opacity: 0.9 } }
    expect(collectionItemProps(subject, { subject: 'fixture', assembly })).toBe(subject)
    expect(collectionItemProps(subject, { subject: null, assembly })).toBe(subject)
    expect(collectionItemProps(subject)).toBe(subject)
  })
})

describe('assemblyControl', () => {
  const state = { shown: true, onToggle: vi.fn() }
  const one = [{ id: 'part' }]
  const two = [{ id: 'part' }, { id: 'vice' }]

  it('is undefined for a lone part, the subject or not', () => {
    expect(assemblyControl(one, null, state)).toBeUndefined()
    expect(assemblyControl(one, undefined, state)).toBeUndefined()
    expect(assemblyControl(one, 'part', state)).toBeUndefined()
    expect(assemblyControl([], 'part', state)).toBeUndefined()
  })

  it('is pressed while shown where the subject has a part round it', () => {
    const control = assemblyControl(two, 'part', state)
    expect(control).toEqual({ pressed: true, onClick: state.onToggle })
    control?.onClick()
    expect(state.onToggle).toHaveBeenCalledOnce()
    expect(assemblyControl(two, 'part', { ...state, shown: false })?.pressed).toBe(false)
  })

  it('counts a subject drawn outside the collection', () => {
    expect(assemblyControl(one, 'elsewhere', state)).toBeDefined()
  })

  it('is undefined with no subject: every part is a subject, and nothing would hide', () => {
    expect(assemblyControl(two, null, state)).toBeUndefined()
    expect(assemblyControl(two, undefined, state)).toBeUndefined()
  })
})
