import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { normalizePartReport } from '../src/engine/normalize.js'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { createExplodeBatch } from '../src/render/explode.js'

// Opt-in, local files only. Actual CAD remains outside the public repository.
const sampleDir = process.env.VIEWER_STRESS_SAMPLE_DIR
it.skipIf(!sampleDir)(
  'preserves every copied source triangle and group identity on a dense real part',
  async () => {
    const snapshot = JSON.parse(await readFile(join(sampleDir!, 'analysis.json'), 'utf8'))
    const model = normalizePartReport(snapshot.report ?? snapshot)
    const bytes = await readFile(join(sampleDir!, 'mesh.glb'))
    const geometry = await parsePartGeometry(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      model.mesh,
    )
    const original = geometry.getAttribute('position')
    const positions = original.array.slice()
    const groups = model.features
      .filter((f) => f.regionIdxs.length > 0)
      .map((f, index) => ({
        id: `caller-piece-${index}`,
        regionIdxs: f.regionIdxs,
        offset: { x: index * 2, y: 10, z: 20 },
        color: 0x7dd3fc,
      }))
    expect(groups.length).toBeGreaterThanOrEqual(300)
    const batch = createExplodeBatch(model, geometry, groups)
    const copied = batch.mesh.geometry.getAttribute('position')
    let mappingsMatch = true
    let copiesMatch = true
    for (const piece of batch.pieces) {
      for (const [local, source] of piece.sourceTriangles.entries()) {
        const hit = batch.hit(piece.instanceId, piece.range.start / 3 + local)
        mappingsMatch &&= hit?.group.id === piece.group.id && hit.triangleIndex === source
        for (let corner = 0; corner < 9; corner += 1) {
          copiesMatch &&=
            copied.array[piece.range.start * 3 + local * 9 + corner] ===
            positions[source * 9 + corner]
        }
      }
    }
    batch.setAppearance({})
    batch.setAmount(0.5)
    expect(mappingsMatch).toBe(true)
    expect(copiesMatch).toBe(true)
    expect(batch.pieces).toHaveLength(groups.length)
    expect(geometry.getAttribute('position')).toBe(original)
    expect(Array.from(original.array)).toEqual(Array.from(positions))
    batch.dispose()
    geometry.dispose()
  },
)
