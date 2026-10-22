import { describe, expect, it, vi } from 'vitest'
import { endOnRelease } from '../src/render/section-drag.js'

describe('endOnRelease', () => {
  it('ends the drag when the pointer is cancelled or its capture is lost', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    endOnRelease(element, onEnd)

    element.dispatchEvent(new Event('pointercancel'))
    element.dispatchEvent(new Event('lostpointercapture'))

    expect(onEnd).toHaveBeenCalledTimes(2)
  })

  it('ignores the pointer releasing normally, which the handle hears itself', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    endOnRelease(element, onEnd)

    element.dispatchEvent(new Event('pointerup'))

    expect(onEnd).not.toHaveBeenCalled()
  })

  it('stops listening once removed', () => {
    const element = new EventTarget()
    const onEnd = vi.fn()
    const remove = endOnRelease(element, onEnd)

    remove()
    element.dispatchEvent(new Event('pointercancel'))
    element.dispatchEvent(new Event('lostpointercapture'))

    expect(onEnd).not.toHaveBeenCalled()
  })
})
