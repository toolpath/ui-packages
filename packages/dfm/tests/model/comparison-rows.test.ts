import { describe, expect, it } from 'vitest'
import { comparisonRows, faceLetter } from '../../src/model/comparison-rows.js'
import type { ComparedFace } from '../../src/model/view-types.js'

const hole = (tag: string, overrides: Partial<ComparedFace> = {}): ComparedFace => ({
  feature: { tag, featureType: 'through_hole', machiningDirection: { x: 0, y: 0, z: 1 } },
  directionColor: '#4f8ef7',
  rules: [],
  measurements: [],
  ...overrides,
})

const rule = (key: string) => ({ key, color: '#f00', text: key })
const measured = (key: string, label: string, value: string) => ({
  key,
  label,
  value,
  derivation: [],
})

const byKey = (faces: readonly ComparedFace[]) =>
  Object.fromEntries(comparisonRows(faces).map((row) => [row.key, row]))

describe('comparisonRows', () => {
  it('says what each row reads, apart from its key', () => {
    const rows = comparisonRows([
      hole('a', { measurements: [measured('rules', 'Rules', '3')] }),
      hole('b', { measurements: [measured('rules', 'Rules', '3')] }),
    ])
    expect(rows.map((row) => [row.kind, row.key])).toEqual([
      ['type', 'type'],
      ['direction', 'direction'],
      ['rules', 'rules'],
      ['measurement', 'rules'],
    ])
  })

  it('reads Type, Machined from and Rules broken, then the measurements', () => {
    const rows = comparisonRows([
      hole('a', { measurements: [measured('depth', 'Depth', '5 mm')] }),
      hole('b', { measurements: [measured('depth', 'Depth', '5 mm')] }),
    ])
    expect(rows.map((row) => row.key)).toEqual(['type', 'direction', 'rules', 'depth'])
    expect(rows.every((row) => !row.differs)).toBe(true)
  })

  it('reads a face with no feature as a dash on the fixed rows', () => {
    const rows = byKey([
      hole('a', { measurements: [measured('depth', 'Depth', '5 mm')] }),
      { feature: null, directionColor: '#000', rules: [], measurements: [] },
    ])
    for (const key of ['type', 'direction', 'rules', 'depth']) {
      expect(rows[key]?.texts[1], key).toBe('—')
      expect(rows[key]?.differs, key).toBe(true)
    }
  })

  it("reads a face with no feature's own measurements", () => {
    const rows = byKey([
      hole('a'),
      {
        feature: null,
        directionColor: '#000',
        rules: [],
        measurements: [measured('depth', 'Depth', '5 mm')],
      },
    ])
    expect(rows.type?.texts[1]).toBe('—')
    expect(rows.depth?.texts).toEqual(['—', '5 mm'])
  })

  it('keeps two measurements that share a label apart, by key', () => {
    const rows = comparisonRows([
      hole('a', {
        measurements: [measured('top', 'Diameter', '5 mm'), measured('bottom', 'Diameter', '4 mm')],
      }),
      hole('b', { measurements: [measured('bottom', 'Diameter', '4 mm')] }),
    ])
    const diameters = rows.filter((row) => row.label === 'Diameter')
    expect(diameters.map((row) => [row.key, row.texts])).toEqual([
      ['top', ['5 mm', '—']],
      ['bottom', ['4 mm', '4 mm']],
    ])
  })

  it('leaves Required out unless some face says', () => {
    expect(byKey([hole('a'), hole('b')]).required).toBeUndefined()
    expect(byKey([hole('a', { required: true }), hole('b')]).required?.texts).toEqual(['Yes', 'No'])
  })

  it('marks the same count of different rules as differing', () => {
    const rules = byKey([
      hole('a', { rules: [rule('r1')] }),
      hole('b', { rules: [rule('r2')] }),
    ]).rules
    expect(rules?.texts).toEqual(['1', '1'])
    expect(rules?.differs).toBe(true)
  })

  it('reads no rules as None', () => {
    expect(byKey([hole('a')]).rules?.texts).toEqual(['None'])
  })
})

describe('faceLetter', () => {
  it('names faces A, B, C, and wraps after Z', () => {
    expect([0, 1, 2, 25, 26].map(faceLetter)).toEqual(['A', 'B', 'C', 'Z', 'A'])
  })
})
