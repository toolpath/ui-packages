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

  it('nests: an object two masks hold returns to its own layers only when both show it', () => {
    // A hidden `<PartMesh>` inside a hidden `<VisibilityGroup>`: React runs the inner effect first.
    const outerRoot = new Group()
    const innerRoot = new Group()
    const part = new Mesh()
    part.layers.set(2)
    innerRoot.add(part)
    outerRoot.add(innerRoot)
    const own = part.layers.mask
    {
      const inner = createRayMask()
      const outer = createRayMask()
      inner.hide(innerRoot)
      outer.hide(outerRoot)
      inner.show()
      expect(part.layers.mask).toBe(0)
      outer.show()
      expect(part.layers.mask).toBe(own)
    }
    // The outer shown first leaves what the inner still hides out of raycasts.
    const inner = createRayMask()
    const outer = createRayMask()
    outer.hide(outerRoot)
    inner.hide(innerRoot)
    outer.show()
    expect(outerRoot.layers.mask).toBe(1)
    expect(part.layers.mask).toBe(0)
    inner.show()
    expect(part.layers.mask).toBe(own)
    // Showing again changes nothing.
    inner.show()
    expect(part.layers.mask).toBe(own)
  })
})
