import { afterEach, describe, expect, it, vi } from 'vitest'
import { preventPointerDefault, readPointer } from '../src/render/pointer.js'

const rect = (left: number, top: number) => ({
  getBoundingClientRect: () => ({ left, top }) as DOMRectReadOnly,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readPointer', () => {
  it('reads a DOM pointer event as it is', () => {
    const reading = readPointer({
      type: 'pointerdown',
      clientX: 140,
      clientY: 90,
      offsetX: 1,
      offsetY: 2,
      button: 2,
      timeStamp: 1234,
      altKey: true,
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
    })

    expect(reading).toEqual({
      x: 1,
      y: 2,
      clientX: 140,
      clientY: 90,
      button: 2,
      timeStamp: 1234,
      altKey: true,
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
    })
  })

  it('makes client coordinates local to the element it is given', () => {
    const reading = readPointer(
      { clientX: 140, clientY: 90, offsetX: 1, offsetY: 2 },
      rect(100, 50),
    )

    expect(reading.x).toBe(40)
    expect(reading.y).toBe(40)
    expect(reading.clientX).toBe(140)
  })

  it('falls back to offsets when the element cannot be measured', () => {
    const reading = readPointer({ clientX: 140, clientY: 90, offsetX: 3, offsetY: 4 }, {})

    expect(reading.x).toBe(3)
    expect(reading.y).toBe(4)
  })

  it('reads a React Native touch from its page and offset coordinates', () => {
    // What fiber's native events hand R3F: `offsetX`/`offsetY` copied from
    // `locationX`/`locationY`, page coordinates, `timestamp` in lower case, and
    // none of the button or modifier fields.
    const reading = readPointer(
      {
        type: 'pointerdown',
        locationX: 30,
        locationY: 40,
        offsetX: 30,
        offsetY: 40,
        pageX: 230,
        pageY: 340,
        timestamp: 5678,
        pointerId: 3,
        pointerType: 'touch',
      },
      rect(1000, 1000),
    )

    expect(reading).toEqual({
      x: 30,
      y: 40,
      clientX: 230,
      clientY: 340,
      button: 0,
      timeStamp: 5678,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })
  })

  it('takes the offset as the client position when a native event has no page coordinates', () => {
    const reading = readPointer({ offsetX: 12, offsetY: 13 })

    expect(reading.clientX).toBe(12)
    expect(reading.clientY).toBe(13)
  })

  it('stamps an event that carries no time with the current one', () => {
    vi.spyOn(performance, 'now').mockReturnValue(42)
    expect(readPointer({}).timeStamp).toBe(42)
  })

  it('counts only a literal true as a held modifier', () => {
    const reading = readPointer({ clientX: 0, clientY: 0, shiftKey: 1, ctrlKey: 'yes' })

    expect(reading.shiftKey).toBe(false)
    expect(reading.ctrlKey).toBe(false)
  })

  it('reads nothing at all as an unpressed pointer at the origin', () => {
    expect(readPointer(null)).toMatchObject({ x: 0, y: 0, clientX: 0, clientY: 0, button: 0 })
  })
})

describe('preventPointerDefault', () => {
  it('prevents the default where the event has one', () => {
    const event = { preventDefault: vi.fn() }
    preventPointerDefault(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('does nothing for an event without one', () => {
    expect(() => preventPointerDefault({})).not.toThrow()
    expect(() => preventPointerDefault(null)).not.toThrow()
  })
})
