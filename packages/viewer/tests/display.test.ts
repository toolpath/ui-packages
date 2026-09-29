import { MeshLambertMaterial, Plane, Raycaster, Vector3 } from 'three'
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
