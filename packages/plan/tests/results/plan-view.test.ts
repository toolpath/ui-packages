import { describe, expect, it } from 'vitest'

import { featureRow, trimmedByTag, trimmedOrigin, type PlanPart } from '../../src/index'
import { trimmedFeature } from '../trimmed-feature'

// The part's report: `a` a pocket, `h` a blind hole with its bore read.
const reported: Record<string, string> = { a: 'pocket', h: 'blind_hole' }
const bore = { diameter: 6, label: '⌀6 mm' }
const part: PlanPart = {
  directionIndex: () => 0,
  featureLabel: (tag) => `Feature ${tag}`,
  featureType: (tag) => reported[tag.toLowerCase()],
  featureBore: (tag) => (tag.toLowerCase() === 'h' ? bore : undefined),
}
const typeOf = (tag: string) => reported[tag.toLowerCase()]

describe('trimmedOrigin', () => {
  it('names the feature it was cut from where the trimming kept its type', () => {
    const kept = trimmedFeature({ featureType: 'blind_hole', fromFeatureTag: 'H' })
    expect(trimmedOrigin(kept, typeOf)).toBe('H')
  })

  it('names none where the trimming changed its type, or it was cut from no single feature', () => {
    expect(trimmedOrigin(trimmedFeature({ fromFeatureTag: 'h' }), typeOf)).toBeNull()
    expect(trimmedOrigin(trimmedFeature({ fromFeatureTag: null }), typeOf)).toBeNull()
  })

  it('names none where the report does not list the feature it was cut from', () => {
    expect(trimmedOrigin(trimmedFeature({ fromFeatureTag: 'gone' }), typeOf)).toBeNull()
  })
})

describe('trimmedByTag', () => {
  it('keys the plan’s trimmed features by lower-case tag, but any the report lists', () => {
    const map = trimmedByTag(
      {
        trimmedFeatures: [
          trimmedFeature({ featureTag: 'T1' }),
          trimmedFeature({ featureTag: 'A', featureType: 'wall' }),
        ],
      },
      part,
    )
    expect([...map.keys()]).toEqual(['t1'])
    expect(map.get('t1')?.featureTag).toBe('T1')
  })

  it('is empty for a plan with none', () => {
    expect(trimmedByTag({ trimmedFeatures: null }, part).size).toBe(0)
  })
})

describe('featureRow', () => {
  const trimmed = trimmedByTag(
    {
      trimmedFeatures: [
        trimmedFeature({ featureTag: "h'", featureType: 'blind_hole', fromFeatureTag: 'h' }),
        trimmedFeature({ featureTag: 'h2', featureType: 'pocket', fromFeatureTag: 'h' }),
        trimmedFeature({ featureTag: 'g1', featureType: 'face', fromFeatureTag: 'Gone' }),
      ],
    },
    part,
  )

  it('reads a report tag as the part labels it', () => {
    expect(featureRow(part, trimmed, 'H')).toEqual({
      tag: 'H',
      label: 'Feature H',
      type: 'blind_hole',
      bore,
    })
  })

  it('reads a trimmed tag by its origin, with its bore where its type is the origin’s', () => {
    expect(featureRow(part, trimmed, "H'")).toEqual({
      tag: "H'",
      label: 'Feature h (trimmed)',
      type: 'blind_hole',
      trimmed: true,
      bore,
    })
    expect(featureRow(part, trimmed, 'h2')).toEqual({
      tag: 'h2',
      label: 'Feature h (trimmed)',
      type: 'pocket',
      trimmed: true,
    })
  })

  it('reads a trimmed tag by its own type where the part has no type for its origin', () => {
    expect(featureRow(part, trimmed, 'g1')).toMatchObject({ label: 'Face (trimmed)', type: 'face' })
  })

  it('reads its origin’s label where the part reads no types at all', () => {
    const untyped: PlanPart = { directionIndex: () => 0, featureLabel: (tag) => `Feature ${tag}` }
    const all = trimmedByTag(
      { trimmedFeatures: [trimmedFeature({ fromFeatureTag: 'a' })] },
      untyped,
    )
    expect(featureRow(untyped, all, 't').label).toBe('Feature a (trimmed)')
  })
})
