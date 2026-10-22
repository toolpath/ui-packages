import { describe, expect, it, vi } from 'vitest'
import { BoxGeometry, DataTexture, Mesh, MeshBasicMaterial, Scene, ShaderMaterial } from 'three'
import { createPresenter, createRelease, disposeTree } from '../src/render/native-gl.js'

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

  it('stops presenting once removed', () => {
    const present = vi.fn()
    const context = { endFrameEXP: present }
    const effects = afterEffects()
    const remove = createPresenter(context, effects.add)

    remove()
    context.endFrameEXP()
    effects.frame()
    expect(present).not.toHaveBeenCalled()
  })
})

describe('createRelease', () => {
  it('stops presenting, empties the scene, disposes the renderer and destroys the context, in order', () => {
    const order: string[] = []
    const geometry = new BoxGeometry()
    geometry.addEventListener('dispose', () => order.push('scene'))
    const scene = new Scene().add(new Mesh(geometry, new MeshBasicMaterial()))
    const release = createRelease({
      gl: { dispose: () => order.push('renderer') },
      scene,
      stopPresenting: () => order.push('presenter'),
      destroy: () => order.push('context'),
    })

    release()
    expect(order).toEqual(['presenter', 'scene', 'renderer', 'context'])
  })

  it('does nothing the second time', () => {
    const destroy = vi.fn()
    const dispose = vi.fn()
    const release = createRelease({
      gl: { dispose },
      scene: new Scene(),
      stopPresenting: () => {},
      destroy,
    })

    release()
    release()
    expect(dispose).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
  })
})

describe('disposeTree', () => {
  const disposed = (target: { addEventListener: DataTexture['addEventListener'] }) => {
    const spy = vi.fn()
    target.addEventListener('dispose', spy)
    return spy
  }

  it('disposes geometries, materials, and the textures in them and in their uniforms', () => {
    const map = new DataTexture()
    const sampled = new DataTexture()
    const basic = new MeshBasicMaterial({ map })
    const shader = new ShaderMaterial({ uniforms: { mask: { value: sampled } } })
    const geometry = new BoxGeometry()
    const scene = new Scene().add(new Mesh(geometry, [basic, shader]))
    const spies = [map, sampled, basic, shader, geometry].map(disposed)

    disposeTree(scene)
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce()
  })
})
