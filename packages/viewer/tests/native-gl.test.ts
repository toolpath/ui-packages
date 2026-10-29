import { describe, expect, it, vi } from 'vitest'
import { BoxGeometry, DataTexture, Mesh, MeshBasicMaterial, Scene, ShaderMaterial } from 'three'
import {
  createPresenter,
  createSceneRelease,
  createUnmountRelease,
} from '../src/render/native-gl.js'

/** Fiber's `addAfterEffect`, run by hand: `frame()` is the end of a frame. */
const afterEffects = () => {
  const callbacks = new Set<(timestamp: number) => void>()
  return {
    add: (callback: (timestamp: number) => void) => {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    },
    frame: () => {
      for (const callback of callbacks) callback(0)
    },
  }
}

/** expo-gl's context, whose `endFrameEXP` is on its prototype. */
class ExpoContext {
  presented = vi.fn()
  endFrameEXP(): void {
    this.presented()
  }
}

describe('createPresenter', () => {
  it('presents a frame once however many renders marked it', () => {
    const present = vi.fn()
    const context = { endFrameEXP: present }
    const effects = afterEffects()
    createPresenter(context, effects.add)

    context.endFrameEXP()
    context.endFrameEXP()
    expect(present).not.toHaveBeenCalled()

    effects.frame()
    expect(present).toHaveBeenCalledOnce()
  })

  it('presents nothing for a frame nothing was drawn in', () => {
    const present = vi.fn()
    const effects = afterEffects()
    createPresenter({ endFrameEXP: present }, effects.add)

    effects.frame()
    expect(present).not.toHaveBeenCalled()
  })

  it('gives the context its own endFrameEXP back once removed', () => {
    const present = vi.fn()
    const context = { endFrameEXP: present }
    const effects = afterEffects()
    const remove = createPresenter(context, effects.add)

    remove()
    expect(context.endFrameEXP).toBe(present)
    context.endFrameEXP()
    effects.frame()
    expect(present).toHaveBeenCalledOnce()
  })

  it('leaves no endFrameEXP of its own on a context whose prototype has it', () => {
    const context = new ExpoContext()
    const remove = createPresenter(context, afterEffects().add)

    remove()
    expect(Object.hasOwn(context, 'endFrameEXP')).toBe(false)
  })

  it('presents a frame once after it is installed, removed and installed again', () => {
    const present = vi.fn()
    const context = { endFrameEXP: present }
    const effects = afterEffects()

    createPresenter(context, effects.add)()
    createPresenter(context, effects.add)
    context.endFrameEXP()
    context.endFrameEXP()
    effects.frame()

    expect(present).toHaveBeenCalledOnce()
  })

  it('presents a frame once after it is installed, removed and installed again on expo-gl’s context', () => {
    const context = new ExpoContext()
    const effects = afterEffects()

    createPresenter(context, effects.add)()
    createPresenter(context, effects.add)
    context.endFrameEXP()
    context.endFrameEXP()
    effects.frame()

    expect(context.presented).toHaveBeenCalledOnce()
  })
})

describe('createSceneRelease', () => {
  const disposed = (target: { addEventListener: DataTexture['addEventListener'] }) => {
    const spy = vi.fn()
    target.addEventListener('dispose', spy)
    return spy
  }

  const scene = () => {
    const geometry = new BoxGeometry()
    const material = new MeshBasicMaterial()
    const spy = vi.fn()
    geometry.addEventListener('dispose', spy)
    material.addEventListener('dispose', spy)
    return { scene: new Scene().add(new Mesh(geometry, material)), disposed: spy }
  }

  it('disposes nothing when the scene is hidden and shown again', () => {
    const { scene: live, disposed: spy } = scene()
    const release = createSceneRelease(live)
    release.shown()

    release.hidden()
    release.shown()
    release.gone()

    expect(spy).not.toHaveBeenCalled()
  })

  it('disposes what the scene held when it went, though it has emptied since', () => {
    const { scene: live, disposed: spy } = scene()
    const release = createSceneRelease(live)
    release.shown()

    release.hidden()
    live.clear()
    release.gone()

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('disposes geometries, materials, and the textures in them and in their uniforms', () => {
    const map = new DataTexture()
    const sampled = new DataTexture()
    const basic = new MeshBasicMaterial({ map })
    const shader = new ShaderMaterial({ uniforms: { mask: { value: sampled } } })
    const geometry = new BoxGeometry()
    const release = createSceneRelease(new Scene().add(new Mesh(geometry, [basic, shader])))
    const spies = [map, sampled, basic, shader, geometry].map(disposed)

    release.hidden()
    release.gone()
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce()
  })
})

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
