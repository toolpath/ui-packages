import { describe, expect, it } from 'vitest'
import {
  MILLING_RULES,
  PRESENCE_METRIC,
  TYPE_SUBJECT,
  metricsForSubject,
  type RuleVocabulary,
} from '../../src/model/dfm-metrics.js'
import { makeRule, parseRules } from '../../src/model/dfm-rules.js'
import { turnedStretches } from '../../src/model/turned-check.js'
import { TURNING_RULES, turnedTypeLabel } from '../../src/model/turning-metrics.js'

describe.each([
  ['milling', MILLING_RULES],
  ['turning', TURNING_RULES],
] as [string, RuleVocabulary][])('the %s vocabulary', (_, vocabulary) => {
  it('names each metric and subject once', () => {
    const keys = vocabulary.metrics.map((each) => each.key)
    const values = vocabulary.subjects.map((each) => each.value)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(values).size).toBe(values.length)
  })

  it('offers only subjects and metrics it has in its short lists', () => {
    const keys = vocabulary.metrics.map((each) => each.key)
    const values = vocabulary.subjects.map((each) => each.value)
    for (const key of vocabulary.quickMetrics) expect(keys).toContain(key)
    for (const value of vocabulary.quickSubjects) expect(values).toContain(value)
    expect(keys).toContain(vocabulary.fallbackMetric.key)
  })

  it('starts every rule at a value it reads back, in both units', () => {
    for (const subject of vocabulary.subjects) {
      for (const metric of vocabulary.metrics) {
        for (const units of ['mm', 'inch'] as const) {
          const made = makeRule(subject.value, metric.key, units, undefined, vocabulary)
          expect(parseRules([made], vocabulary), `${subject.value} × ${metric.key}`).toEqual([made])
        }
      }
    }
  })

  it('offers every subject more than "any size"', () => {
    for (const subject of vocabulary.subjects) {
      expect(
        metricsForSubject(subject.value, vocabulary).some(
          (each) => each.key !== PRESENCE_METRIC.key,
        ),
        subject.value,
      ).toBe(true)
    }
  })
})

describe('the turning vocabulary', () => {
  it('names every turned feature type the Engine reports as a subject', () => {
    const types = TURNING_RULES.subjects
      .filter((each) => each.value.startsWith(TYPE_SUBJECT))
      .map((each) => each.value.slice(TYPE_SUBJECT.length))
    expect(types.sort()).toEqual(
      [
        'axial_hole',
        'face',
        'face_groove',
        'face_profile',
        'id_groove',
        'id_profile',
        'id_thread',
        'od_groove',
        'od_profile',
        'od_thread',
        'unknown',
      ].sort(),
    )
  })

  it('keeps tolerance off the short list, and falls back on "any size"', () => {
    expect(TURNING_RULES.quickMetrics).not.toContain('tolerance')
    expect(TURNING_RULES.fallbackMetric).toBe(PRESENCE_METRIC)
    expect(TURNING_RULES.fileName).toBe('dfm-turning-rules.json')
  })

  it('offers groove figures to grooves and not to holes', () => {
    const keys = (subject: string) =>
      metricsForSubject(subject, TURNING_RULES).map((each) => each.key)
    expect(keys('groove')).toContain('grooveDepth')
    expect(keys('hole')).not.toContain('grooveDepth')
    expect(keys('hole')).toContain('holeDepth')
    expect(keys('face')).not.toContain('minDiameter')
  })
})

describe('turnedTypeLabel', () => {
  it('writes OD and ID in capitals, and any other type as its words', () => {
    expect(turnedTypeLabel('od_groove')).toBe('OD groove')
    expect(turnedTypeLabel('axial_hole')).toBe('Axial hole')
    expect(turnedTypeLabel('id_profile')).toBe('ID profile')
    expect(turnedTypeLabel('face_groove')).toBe('Face groove')
    expect(turnedTypeLabel('unknown')).toBe('Unknown')
    expect(turnedTypeLabel('od_knurl_band')).toBe('OD knurl band')
  })
})

describe('featureLabel', () => {
  it('names a turned stretch by its type and the ends it is cut from', () => {
    const copy = (approach: 'PlusZ' | 'MinusZ' | null, regionIdxs = [1]) => ({
      featureTag: `${approach}-${regionIdxs[0]}`,
      featureType: 'od_groove',
      approach,
      regionIdxs,
      datasheet: null,
    })
    const [both, plus, minus, neither] = turnedStretches([
      copy('PlusZ'),
      copy('MinusZ'),
      copy('PlusZ', [2]),
      copy('MinusZ', [3]),
      copy(null, [4]),
    ])
    const label = (stretch: typeof both) => stretch && TURNING_RULES.featureLabel(stretch)
    expect(label(both)).toEqual({ name: 'OD groove', detail: 'from both ends' })
    expect(label(plus)).toEqual({ name: 'OD groove', detail: 'from the +Z end' })
    expect(label(minus)).toEqual({ name: 'OD groove', detail: 'from the −Z end' })
    expect(label(neither)).toEqual({ name: 'OD groove', detail: '' })
  })

  it('names a milled feature as the list always has', () => {
    const feature = {
      tag: 'h',
      featureType: 'blind_hole',
      machiningDirection: { x: 0, y: 0, z: -1 },
      regionIdxs: [1],
      number: 1,
    }
    expect(MILLING_RULES.featureLabel(feature)).toEqual({ name: 'Blind hole', detail: 'from −Z' })
  })
})
