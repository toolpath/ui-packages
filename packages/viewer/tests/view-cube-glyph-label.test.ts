import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { LIFT, glyphLabelGeometry } from '../src/render/view-cube-glyph-label.js'
import { cubeZones } from '../src/render/view-cube.js'

describe('glyphLabelGeometry', () => {
  it('lays every face’s name on that face, just proud of it', () => {
    const faces = cubeZones().filter((zone) => zone.kind === 'face')
    expect(faces).toHaveLength(6)

    for (const zone of faces) {
      const geometry = glyphLabelGeometry(zone)
      const normal = new Vector3(zone.direction.x, zone.direction.y, zone.direction.z)
      const positions = geometry.getAttribute('position')
      expect(positions.count, zone.name).toBeGreaterThan(0)

      const point = new Vector3()
      for (let index = 0; index < positions.count; index += 1) {
        point.fromBufferAttribute(positions, index)
        expect(point.dot(normal), zone.name).toBeCloseTo(1 + LIFT, 6)
      }
      geometry.dispose()
    }
  })
})
