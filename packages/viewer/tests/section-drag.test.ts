import { describe, expect, it, vi } from 'vitest'
import { endOnRelease } from '../src/render/section-drag.js'

/** A pointer event of `type` for pointer `pointerId`. */
const pointer = (type: string, pointerId: number): Event =>
  Object.assign(new Event(type), { pointerId })

describe('endOnRelease', () => {
  it('ends the drag when the pointer is cancelled or its capture is lost', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    endOnRelease(element, 1, onEnd)

    element.dispatchEvent(pointer('pointercancel', 1))
    element.dispatchEvent(pointer('lostpointercapture', 1))

    expect(onEnd).toHaveBeenCalledTimes(2)
  })

  it('ignores another pointer being cancelled or losing its capture', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    endOnRelease(element, 1, onEnd)

    element.dispatchEvent(pointer('pointercancel', 2))
    element.dispatchEvent(pointer('lostpointercapture', 2))

    expect(onEnd).not.toHaveBeenCalled()
  })

  it('ignores the pointer releasing normally, which the handle hears itself', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    endOnRelease(element, 1, onEnd)

    element.dispatchEvent(pointer('pointerup', 1))

    expect(onEnd).not.toHaveBeenCalled()
  })

  it('stops listening once removed', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    const remove = endOnRelease(element, 1, onEnd)

    remove()
    element.dispatchEvent(pointer('pointercancel', 1))
    element.dispatchEvent(pointer('lostpointercapture', 1))

    expect(onEnd).not.toHaveBeenCalled()
  })
})
