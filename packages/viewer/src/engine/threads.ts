import type { PartModelFeature } from '../model/types.js'
import type { ThreadMark } from '../render/threads.js'
import { isFiniteNumber, isRecord } from './guards.js'

/**
 * The thread to draw in a hole, read from its Engine datasheet: a hole's
 * `facts.threading.spec`, which the Engine fills for a modeled thread it
 * took for a catalog thread (ISO 6H, ANSI 2B, straight pipe). `null` for a
 * plain hole, any other feature, and a datasheet of an unexpected shape.
 *
 * Only what the Engine sends is drawn: a thread it did not report is not
 * guessed at from the mesh.
 */
export function threadMark(feature: PartModelFeature, datasheet: unknown): ThreadMark | null {
  if (!isRecord(datasheet) || !isRecord(datasheet['facts'])) return null

  const facts = datasheet['facts']
  if (facts['kind'] !== 'Hole' || !isRecord(facts['threading'])) return null

  const spec = facts['threading']['spec']
  if (!isRecord(spec)) return null

  const pitch = spec['threadPitch']
  const majorDiameter = spec['basicDiameter']
  if (!isFiniteNumber(pitch) || pitch <= 0 || !isFiniteNumber(majorDiameter)) return null

  return {
    regions: feature.regionIdxs,
    pitch: spec['handedness'] === 'Left' ? -pitch : pitch,
    majorDiameter,
  }
}
