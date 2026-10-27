import { LineBasicMaterial, MeshLambertMaterial, Plane, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { createPart } from '../src/render/part.js'
import { hitUnderRay } from '../src/render/section.js'
import { DEFAULT_THEME } from '../src/render/theme.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

describe('wireframe display', () => {
  it('keeps semantic edges and pickable faces without rebuilding geometry', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
    const part = createPart(model, geometry, DEFAULT_THEME)
    const edges = part.edges.geometry
    part.setDisplay('wireframe', false)
    expect(part.edges.visible).toBe(true)
    expect(edges.getAttribute('position').count / 2).toBe(12)
    expect(part.mesh.geometry).toBe(geometry)
    expect(part.mesh.visible).toBe(true)
    const material = part.mesh.material as MeshLambertMaterial
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    part.object.updateMatrixWorld(true)
    const ray = new Raycaster(new Vector3(0, 0, 100), new Vector3(0, 0, -1))
    expect(hitUnderRay(ray, part.object)?.object).toBe(part.mesh)
    part.setClippingPlanes([new Plane(new Vector3(0, 0, -1), -1000)])
    expect(hitUnderRay(ray, part.object)).toBeNull()
    part.setDisplay('solid', false)
    expect(part.edges.visible).toBe(false)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
    expect(part.edges.geometry).toBe(edges)
    part.dispose()
  })
})

describe('part opacity', () => {
  it('draws a see-through part without depth, keeps it pickable, and restores it', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
    const part = createPart(model, geometry, DEFAULT_THEME)
    const material = part.mesh.material as MeshLambertMaterial
    const edges = part.edges.material as LineBasicMaterial
    part.setOpacity(0.25)
    expect(material.opacity).toBe(0.25)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(edges.opacity).toBeCloseTo(DEFAULT_THEME.edgeOpacity * 0.25)
    part.object.updateMatrixWorld(true)
    const ray = new Raycaster(new Vector3(0, 0, 100), new Vector3(0, 0, -1))
    expect(hitUnderRay(ray, part.object)?.object).toBe(part.mesh)
    // Wireframe and the theme keep the fade on their edges.
    part.setDisplay('wireframe', true)
    expect(edges.opacity).toBeCloseTo(0.25)
    part.setDisplay('solid', true)
    part.setTheme(DEFAULT_THEME)
    expect(edges.opacity).toBeCloseTo(DEFAULT_THEME.edgeOpacity * 0.25)
    part.setOpacity(1)
    expect(material.opacity).toBe(1)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
    expect(edges.opacity).toBeCloseTo(DEFAULT_THEME.edgeOpacity)
    part.dispose()
  })
})

describe('part depth layers', () => {
  it('pushes the surface back a step per layer, past the step for its own edges, and no further than 63', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
    const part = createPart(model, geometry, DEFAULT_THEME)
    const material = part.mesh.material as MeshLambertMaterial
    expect(material.polygonOffsetUnits).toBe(1)
    part.setDepthLayer(2)
    expect(material.polygonOffset).toBe(true)
    expect(material.polygonOffsetUnits).toBe(9)
    part.setDepthLayer(1000)
    expect(material.polygonOffsetUnits).toBe(1 + 4 * 63)
    part.setDepthLayer(-3)
    expect(material.polygonOffsetUnits).toBe(1)
    part.dispose()
  })
})
