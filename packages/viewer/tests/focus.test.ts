import { MeshLambertMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { DEFAULT_FOCUS_OPACITY } from '../src/render/focus.js'
import { createPart } from '../src/render/part.js'
import { DEFAULT_THEME } from '../src/render/theme.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

async function loadCube() {
  const model = cubeModel()
  const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
  return { model, part: createPart(model, geometry, DEFAULT_THEME) }
}

function faceOn(model: ReturnType<typeof cubeModel>, z: 1 | -1) {
  const face = model.features.find(
    (feature) => feature.featureType === 'face' && feature.machiningDirection.z === z,
  )
  if (!face) throw new Error('The cube fixture should have a face on each of ±Z.')
  return { tag: face.tag, region: model.regionIndex.regionsForFeature(face.tag)[0]! }
}

describe('selection-driven focus', () => {
  it('keeps selected regions solid and fades every other region', async () => {
    const { model, part } = await loadCube()
    const top = faceOn(model, 1)
    const bottom = faceOn(model, -1)

    part.setFocus([top.tag], {})

    expect(part.regionOpacity(top.region)).toBe(1)
    expect(part.regionOpacity(bottom.region)).toBeCloseTo(DEFAULT_FOCUS_OPACITY, 2)
    const material = part.mesh.material as MeshLambertMaterial
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
  })

  it('returns to a fully opaque part when there is no selected feature', async () => {
    const { model, part } = await loadCube()
    const top = faceOn(model, 1)
    const bottom = faceOn(model, -1)

    part.setFocus([top.tag], { opacity: 0.4 })
    part.setFocus([], { opacity: 0.4 })

    expect(part.regionOpacity(top.region)).toBe(1)
    expect(part.regionOpacity(bottom.region)).toBe(1)
    const material = part.mesh.material as MeshLambertMaterial
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
  })

  it('clamps a caller-supplied X-ray opacity', async () => {
    const { model, part } = await loadCube()
    const top = faceOn(model, 1)
    const bottom = faceOn(model, -1)

    part.setFocus([top.tag], { opacity: -10 })
    expect(part.regionOpacity(bottom.region)).toBe(0)

    part.setFocus([top.tag], { opacity: 10 })
    expect(part.regionOpacity(bottom.region)).toBe(1)
  })

  it('keeps X-ray transparency when wireframe is turned back off', async () => {
    const { model, part } = await loadCube()
    const top = faceOn(model, 1)
    const material = part.mesh.material as MeshLambertMaterial

    part.setFocus([top.tag], {})
    part.setDisplay('wireframe')
    part.setDisplay('solid')

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
  })
})
