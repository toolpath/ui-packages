import type { PartModelFeature } from '../model/types.js'
import type { ThreadMark } from '../render/threads.js'
import { isFiniteNumber, isRecord } from './guards.js'

/** The datasheet kinds that carry a thread: a tapped hole's, and a stud's circular wall's. */
const THREADED_KINDS: ReadonlySet<unknown> = new Set(['Hole', 'CircularWall'])

/**
 * The thread to draw on a feature, read from its Engine datasheet: the
 * `facts.threading.spec` of a hole or a circular wall, which the Engine fills
 * for a modeled thread it cut out of the part — internal in a hole, external
 * on a stud — as the catalog thread it took it for (ISO 6H or 6g, ANSI 2B or
 * 2A, straight pipe), or as modeled where none fits. `null` for a plain hole
 * or wall, any other feature, and a datasheet of an unexpected shape.
 *
 * Only what the Engine sends is drawn: a thread it did not report is not
 * guessed at from the mesh.
 */
export function threadMark(feature: PartModelFeature, datasheet: unknown): ThreadMark | null {
  if (!isRecord(datasheet) || !isRecord(datasheet['facts'])) return null

  const facts = datasheet['facts']
  if (!THREADED_KINDS.has(facts['kind']) || !isRecord(facts['threading'])) return null

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
