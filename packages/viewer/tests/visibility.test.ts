import { Group, Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { createRayMask } from '../src/render/visibility.js'

describe('createRayMask', () => {
  it('takes a subtree out of every layer while hidden, and restores each object’s own', () => {
    const root = new Group()
    const mesh = new Mesh()
    mesh.layers.set(3)
    root.add(mesh)
    const mask = createRayMask()
    mask.hide(root)
    expect(root.layers.mask).toBe(0)
    expect(mesh.layers.mask).toBe(0)
    // Objects added while hidden are caught on the next hide, and hiding again changes nothing.
    const late = new Mesh()
    root.add(late)
    mask.hide(root)
    expect(late.layers.mask).toBe(0)
    mask.show()
    expect(root.layers.mask).toBe(1)
    expect(mesh.layers.isEnabled(3)).toBe(true)
    expect(mesh.layers.isEnabled(0)).toBe(false)
    expect(late.layers.mask).toBe(1)
  })
})
