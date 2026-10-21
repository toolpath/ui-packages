import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  draftDone,
  fingerprintText,
  planInputsOf,
  stockSent,
  type DraftRow,
  type FingerprintPart,
} from '../../src/pipeline'

/** The app's fingerprint: SHA-256 of the text, as `server/lib/plan-hash.ts` hashes it. */
const fingerprintOf = (part: FingerprintPart, draft: DraftRow | null) =>
  createHash('sha256')
    .update(fingerprintText(planInputsOf(part, draft)))
    .digest('hex')

/**
 * Parts and drafts with the fingerprint the quoting app's own `fingerprintOf(planInputsOf(…))` gave
 * for each, so a part fingerprinted here reads as the same inputs there.
 */
const SAMPLES: Array<{
  name: string
  part: FingerprintPart
  draft: DraftRow | null
  fingerprint: string
}> = [
  {
    name: 'never edited',
    part: {},
    draft: null,
    fingerprint: '8fd06d3b4e6fcbfb0516b2857a2be5dbe41911d5d10f6faeaf20d12aeb3f4cc1',
  },
  {
    name: 'every input',
    part: {
      machiningStock: { mode: 'automaticFlatBar', oversizeX: 2, snapZ: 0.5 },
      materialId: 'al-6061',
      machineProfileId: 'haas-vf2',
      toolCrib: [
        { kind: 'implicit', id: 'lib-b' },
        { kind: 'implicit', id: 'lib-a' },
      ],
    },
    draft: {
      setups: [
        {
          id: 'top',
          name: 'Top',
          direction: { x: 0, y: 0, z: 1 },
          features: ['pocket', 'bore'],
          folders: [],
        },
        {
          id: 'bottom',
          name: 'Bottom',
          direction: { x: 0, y: 0, z: -1 },
          features: ['chamfer'],
          folders: [],
        },
      ],
      doneRegions: [7, 3, 12],
      doneKernelVersion: 'k2',
      kernelVersion: 'k1',
    },
    fingerprint: '7e588d8b96b8f1dbd1ae320b13a6a6f384976186177994cde35bbb9ef4c9237a',
  },
  {
    name: 'every input, other order and names',
    part: {
      toolCrib: [
        { kind: 'implicit', id: 'lib-b' },
        { kind: 'implicit', id: 'lib-a' },
      ],
      machineProfileId: 'haas-vf2',
      materialId: 'al-6061',
      machiningStock: { snapZ: 0.5, oversizeX: 2, mode: 'automaticFlatBar' },
    },
    draft: {
      setups: [
        {
          id: 's1',
          name: 'Renamed',
          direction: { x: 0, y: 0, z: 1 },
          features: ['bore', 'pocket'],
          folders: [],
        },
        {
          id: 's2',
          name: 'Under',
          direction: { x: 0, y: 0, z: -1 },
          features: ['chamfer'],
          folders: [],
        },
      ],
      doneRegions: [12, 7, 3],
      doneKernelVersion: 'k2',
      kernelVersion: 'k1',
    },
    fingerprint: '7e588d8b96b8f1dbd1ae320b13a6a6f384976186177994cde35bbb9ef4c9237a',
  },
  {
    name: 'crib in another order',
    part: {
      machiningStock: { mode: 'automaticFlatBar', oversizeX: 2, snapZ: 0.5 },
      materialId: 'al-6061',
      machineProfileId: 'haas-vf2',
      toolCrib: [
        { kind: 'implicit', id: 'lib-a' },
        { kind: 'implicit', id: 'lib-b' },
      ],
    },
    draft: {
      setups: [
        {
          id: 'top',
          name: 'Top',
          direction: { x: 0, y: 0, z: 1 },
          features: ['pocket', 'bore'],
          folders: [],
        },
        {
          id: 'bottom',
          name: 'Bottom',
          direction: { x: 0, y: 0, z: -1 },
          features: ['chamfer'],
          folders: [],
        },
      ],
      doneRegions: [7, 3, 12],
      doneKernelVersion: 'k2',
      kernelVersion: 'k1',
    },
    fingerprint: 'ada223466f5e84c37f5bfa251effddc31a41f4288f888cbebf0cba08fdf06180',
  },
  {
    name: 'ignored before the kernel was kept',
    part: {
      machiningStock: {
        mode: 'fixedBox',
        dimensions: { x: 100, y: 60, z: 30 },
        position: 'modelCentered',
      },
    },
    draft: { setups: [], doneRegions: [4], doneKernelVersion: null, kernelVersion: 'k9' },
    fingerprint: 'c49fae396cde7efd0f63dd187caa23f30c09823057341e56b3f76d2db60a6131',
  },
  {
    name: 'an empty folder in a setup',
    part: {},
    draft: {
      setups: [
        {
          id: 'top',
          name: 'Top',
          direction: { x: 0, y: 0, z: 1 },
          features: [],
          folders: [
            { id: 'holes', name: 'Holes', features: ['h1'], folders: [] },
            { id: 'empty', name: 'Empty', features: [], folders: [] },
          ],
        },
      ],
      doneRegions: [],
      doneKernelVersion: null,
      kernelVersion: 'k1',
    },
    fingerprint: 'c40557097220ebc06e6ef84417af32b1a222ccce046cf9477782cda052b94b5f',
  },
]

describe('the fingerprint text', () => {
  it.each(SAMPLES)('hashes as the app’s does: $name', ({ part, draft, fingerprint }) => {
    expect(fingerprintOf(part, draft)).toBe(fingerprint)
  })

  it('reads features, faces and keys in any order, and no names, as the same inputs', () => {
    const [, every, reordered] = SAMPLES
    expect(fingerprintOf(reordered!.part, reordered!.draft)).toBe(
      fingerprintOf(every!.part, every!.draft),
    )
  })

  it('keeps the tool crib in its order: the first library is the one tried first', () => {
    const [, every, , crib] = SAMPLES
    expect(fingerprintOf(crib!.part, crib!.draft)).not.toBe(
      fingerprintOf(every!.part, every!.draft),
    )
  })
})

describe('a part’s inputs', () => {
  it('are none but its row’s, never edited', () => {
    expect(planInputsOf({}, null)).toEqual({
      statement: null,
      done: null,
      stock: null,
      materialId: null,
      machineProfileId: null,
      toolCrib: [],
    })
  })

  it('name the kernel the faces were ignored on, or the plan’s where none was kept', () => {
    const row = { doneRegions: [4], doneKernelVersion: null, kernelVersion: 'k9' }
    expect(draftDone(row)).toEqual({ kernelVersion: 'k9', regions: [4] })
    expect(draftDone({ ...row, doneKernelVersion: 'k2' })).toEqual({
      kernelVersion: 'k2',
      regions: [4],
    })
    expect(draftDone({ ...row, kernelVersion: null })).toEqual({ kernelVersion: '', regions: [4] })
    expect(draftDone({ ...row, doneRegions: [] })).toBeNull()
  })

  it('send a fixed box only with a first folder facing along an axis', () => {
    const box = SAMPLES[4]!
    expect(stockSent(box.part, box.draft)).toEqual(expect.any(String))
    expect(stockSent({}, box.draft)).toBeNull()
    const automatic = SAMPLES[1]!
    expect(stockSent(automatic.part, automatic.draft)).toEqual(automatic.part.machiningStock)
  })
})
