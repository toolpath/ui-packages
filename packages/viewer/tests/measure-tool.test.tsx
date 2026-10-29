// @vitest-environment jsdom
/*
 * `<MeasureTool>`'s list across input events, as the input hands them over:
 * two in one tick, with no render between them, as a slow first tap on React
 * Native leaves them. The input is stubbed for its handlers; what a pick
 * does to the list is the real `clickPick`'s.
 */
import { act, cleanup, render } from '@testing-library/react'
import { type RefObject, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PartContext } from '../src/part-context.js'
import { surfaceCache } from '../src/render/face-measure.js'
import type { MeasureGroup, MeasurePick } from '../src/render/measure-picks.js'
import type { PointerHandlers } from '../src/render/measure-under.js'
import { BOX_FACE, box } from './measure-parts.js'

/** The handlers the tool gave its input, and the list it last drew. */
const tool = vi.hoisted(() => ({
  handlers: null as RefObject<PointerHandlers> | null,
  drawn: [] as ReadonlyArray<readonly MeasureGroup[]>,
}))

vi.mock('../src/viewer.js', async () => {
  const { createSectionStore } = await import('../src/render/section-store.js')
  const store = createSectionStore()
  return { useSectionStore: () => store, useRetarget: () => null }
})
vi.mock('../src/measure-pointer.js', () => ({
  useMeasurePointer: (_part: unknown, handlers: RefObject<PointerHandlers>) => {
    tool.handlers = handlers
    return null
  },
}))
vi.mock('../src/measure-readout.js', () => ({
  Measurements: ({ groups }: { groups: readonly MeasureGroup[] }) => {
    tool.drawn = [...tool.drawn, groups]
    return null
  },
  HoverEdge: () => null,
  labelClassOf: () => '',
  measureColor: () => 0,
}))
vi.mock('../src/measure-labels.js', () => ({ MeasureLabelChrome: () => null }))

const { MeasureTool } = await import('../src/measure-tool.js')
const { pairsOn } = await import('../src/render/measure-picks.js')

const part = box(20, 10, 6)
const pairs = pairsOn(surfaceCache(part.model, part.geometry))
const face = (region: number): MeasurePick => ({ kind: 'face', region, point: [0, 0, 0] })
const [px, nx, pz] = [face(BOX_FACE.px), face(BOX_FACE.nx), face(BOX_FACE.pz)]

/** The tool's input, as of the last render. */
const input = (): PointerHandlers => tool.handlers!.current
const pick = (at: MeasurePick, keep = false) => input().onPick(at, keep, pairs)
const drawn = (): readonly MeasureGroup[] | undefined => tool.drawn[tool.drawn.length - 1]

/** An app that owns the list, and takes every change, or none. */
const Owner = ({
  onChange,
  declines,
}: {
  onChange: (next: readonly MeasureGroup[]) => void
  declines: boolean
}) => {
  const [measurements, setMeasurements] = useState<readonly MeasureGroup[]>([])
  return (
    <MeasureTool
      measurements={measurements}
      onChange={(next) => {
        onChange(next)
        if (!declines) {
          setMeasurements(next)
        }
      }}
    />
  )
}

const mount = (owned: 'controlled' | 'uncontrolled', declines = false) => {
  const onChange = vi.fn()
  render(
    <PartContext.Provider value={part}>
      {owned === 'controlled' ? (
        <Owner onChange={onChange} declines={declines} />
      ) : (
        <MeasureTool onChange={onChange} />
      )}
    </PartContext.Provider>,
  )
  return onChange
}

afterEach(() => {
  cleanup()
  tool.handlers = null
  tool.drawn = []
})

describe.each(['controlled', 'uncontrolled'] as const)('the measure tool, %s', (owned) => {
  it('keeps both of two picks made before it draws again', () => {
    const onChange = mount(owned)
    act(() => {
      pick(px)
      pick(nx)
    })
    expect(onChange).toHaveBeenLastCalledWith([[px, nx]])
    expect(drawn()).toEqual([[px, nx]])
  })

  it('picks onto what a drop left, in the same tick', () => {
    const onChange = mount(owned)
    act(() => pick(px))
    act(() => pick(nx))
    act(() => {
      input().onDrop()
      pick(pz)
    })
    expect(onChange).toHaveBeenLastCalledWith([[px, pz]])
    expect(drawn()).toEqual([[px, pz]])
  })

  it('drops twice in the same tick', () => {
    const onChange = mount(owned)
    act(() => pick(px))
    act(() => pick(nx))
    act(() => {
      expect(input().onDrop()).toBe(true)
      expect(input().onDrop()).toBe(true)
      expect(input().onDrop()).toBe(false)
    })
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(drawn()).toEqual([])
  })

  it('picks onto nothing after a clear, in the same tick', () => {
    const onChange = mount(owned)
    act(() => pick(px))
    act(() => pick(nx))
    act(() => {
      input().onClear()
      pick(pz, true)
    })
    expect(onChange).toHaveBeenLastCalledWith([[pz]])
    expect(drawn()).toEqual([[pz]])
  })
})

describe('the measure tool, owned by an app that declines a change', () => {
  it('builds the next pick on what the app shows', () => {
    const onChange = mount('controlled', true)
    act(() => pick(px))
    expect(onChange).toHaveBeenLastCalledWith([[px]])
    expect(drawn()).toEqual([])
    // The app kept nothing, so the same face again is a pick, not a toggle off.
    act(() => pick(px))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith([[px]])
  })
})
