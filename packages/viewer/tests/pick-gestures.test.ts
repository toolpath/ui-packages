import { describe, expect, it, vi } from 'vitest'
import {
  createPickGestures,
  type PickGestureEvent,
  type PickGestureRules,
} from '../src/render/pick-gestures.js'

interface Press extends PickGestureEvent {
  readonly stopped: () => boolean
  readonly prevented: () => boolean
}

/** A pointer event at `x`, at `timeStamp`, with `button`. */
const press = (x: number, timeStamp = 0, button = 0): Press => {
  let stopped = false
  let prevented = false
  return {
    nativeEvent: {
      clientX: x,
      clientY: 0,
      timeStamp,
      button,
      preventDefault: () => {
        prevented = true
      },
    },
    point: { x, y: 0, z: 0 },
    stopPropagation: () => {
      stopped = true
    },
    stopped: () => stopped,
    prevented: () => prevented,
  }
}

/** Gestures over an object whose every press picks `hit`, unless the rules say otherwise. */
const setup = (overrides: Partial<PickGestureRules<Press, string>> = {}) => {
  const rules: PickGestureRules<Press, string> = {
    visible: true,
    engaged: false,
    hover: true,
    claim: false,
    pick: vi.fn((_event: Press, doubled: boolean) => (doubled ? 'double' : 'hit')),
    onPick: vi.fn(),
    onMove: vi.fn(),
    onLeave: vi.fn(),
    isTap: vi.fn(() => true),
    retarget: vi.fn(),
    ...overrides,
  }
  const now = { ...rules }
  return { rules: now, gestures: createPickGestures(() => now) }
}

describe('createPickGestures', () => {
  it('picks a tap, and leaves the end of a drag alone', () => {
    const { rules, gestures } = setup()
    gestures.onClick(press(0))
    expect(rules.onPick).toHaveBeenCalledWith('hit')
    rules.isTap = () => false
    gestures.onClick(press(0, 1000))
    expect(rules.onPick).toHaveBeenCalledTimes(1)
  })

  it('reports a double click, re-aims the orbit after the pick, and pairs no further', () => {
    const order: Array<string> = []
    const { rules, gestures } = setup({
      pick: (_event, doubled) => {
        order.push('pick')
        return doubled ? 'double' : 'hit'
      },
      retarget: () => order.push('retarget'),
      onPick: (pick) => order.push(pick),
    })
    gestures.onClick(press(10, 0))
    gestures.onClick(press(10, 200))
    gestures.onClick(press(10, 300))
    expect(order).toEqual(['pick', 'hit', 'pick', 'retarget', 'double', 'pick', 'hit'])
    rules.retarget = null
    gestures.onClick(press(10, 400))
    expect(order.at(-1)).toBe('double')
  })

  it('breaks a double click on a drag and on leaving the object', () => {
    const { rules, gestures } = setup()
    gestures.onClick(press(10, 0))
    rules.isTap = () => false
    gestures.onClick(press(10, 100))
    rules.isTap = () => true
    gestures.onClick(press(10, 200))
    gestures.onPointerOut()
    gestures.onClick(press(10, 300))
    expect(rules.retarget).not.toHaveBeenCalled()
    expect(rules.onLeave).toHaveBeenCalledTimes(1)
  })

  it('takes no pick from a press that began while a tool held the pointer', () => {
    const { rules, gestures } = setup({ engaged: true })
    gestures.onPointerDown()
    gestures.onClick(press(0))
    // The tool let go on release, before the click arrived.
    rules.engaged = false
    gestures.onClick(press(0))
    gestures.onPointerUp(press(0, 0, 2))
    expect(rules.onPick).not.toHaveBeenCalled()
    gestures.onPointerDown()
    gestures.onClick(press(0))
    expect(rules.onPick).toHaveBeenCalledTimes(1)
  })

  it('judges the right button on release, and keeps the browser menu off geometry only', () => {
    const { rules, gestures } = setup()
    gestures.onPointerUp(press(0, 0, 0))
    expect(rules.onPick).not.toHaveBeenCalled()
    gestures.onPointerUp(press(0, 0, 2))
    expect(rules.onPick).toHaveBeenCalledWith('hit')
    rules.isTap = () => false
    gestures.onPointerUp(press(0, 0, 2))
    expect(rules.onPick).toHaveBeenCalledTimes(1)

    const over = press(0, 0, 2)
    gestures.onContextMenu(over)
    expect(over.prevented()).toBe(true)
    rules.pick = () => null
    const off = press(0, 0, 2)
    gestures.onContextMenu(off)
    expect(off.prevented()).toBe(false)
  })

  it('neither hovers nor picks while hidden, and keeps the browser menu', () => {
    const { rules, gestures } = setup({ visible: false })
    gestures.onPointerMove(press(0))
    gestures.onClick(press(0))
    gestures.onPointerUp(press(0, 0, 2))
    const menu = press(0, 0, 2)
    gestures.onContextMenu(menu)
    expect(rules.onMove).not.toHaveBeenCalled()
    expect(rules.onPick).not.toHaveBeenCalled()
    expect(menu.prevented()).toBe(false)
  })

  it('hovers only while hover is on and no tool holds the pointer', () => {
    const { rules, gestures } = setup({ hover: false })
    gestures.onPointerMove(press(0))
    rules.hover = true
    rules.engaged = true
    gestures.onPointerMove(press(0))
    expect(rules.onMove).not.toHaveBeenCalled()
    rules.engaged = false
    const move = press(0)
    gestures.onPointerMove(move)
    expect(rules.onMove).toHaveBeenCalledWith(move)
  })

  it('claims a hit, and lets a press that picks nothing pass through untouched', () => {
    const { rules, gestures } = setup({ claim: true })
    const hit = press(10, 0)
    gestures.onClick(hit)
    expect(hit.stopped()).toBe(true)
    const right = press(10, 100, 2)
    gestures.onPointerUp(right)
    expect(right.stopped()).toBe(true)

    rules.pick = () => null
    gestures.onClick(press(20, 1000))
    const missed = press(20, 1100)
    gestures.onClick(missed)
    expect(missed.stopped()).toBe(false)
    // A double click on nothing is not this object's to re-aim.
    expect(rules.retarget).not.toHaveBeenCalled()
  })

  it('without claiming, lets every press through and re-aims a double click over it', () => {
    const { rules, gestures } = setup({ pick: () => null })
    const first = press(10, 0)
    const second = press(10, 100)
    gestures.onClick(first)
    gestures.onClick(second)
    expect(first.stopped() || second.stopped()).toBe(false)
    expect(rules.retarget).toHaveBeenCalledWith(second.point)
    expect(rules.onPick).not.toHaveBeenCalled()
  })
})
