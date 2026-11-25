import { describe, expect, it, vi } from 'vitest'
import { createUnmountRelease } from '../src/render/unmount-release.js'

describe('createUnmountRelease', () => {
  const lifetime = () => {
    const gone = vi.fn()
    return { gone, release: createUnmountRelease({ gone }) }
  }

  it('disposes nothing when the canvas mounts again, as StrictMode does', () => {
    vi.useFakeTimers()
    try {
      const { gone, release } = lifetime()
      release.mounted()

      release.unmounted()
      release.mounted()
      vi.runAllTimers()

      expect(gone).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('disposes on the next task once the canvas has gone', () => {
    vi.useFakeTimers()
    try {
      const { gone, release } = lifetime()
      release.mounted()

      release.unmounted()
      expect(gone).not.toHaveBeenCalled()
      vi.advanceTimersByTime(0)
      expect(gone).toHaveBeenCalledOnce()

      vi.runAllTimers()
      expect(gone).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
