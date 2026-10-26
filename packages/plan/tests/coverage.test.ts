import { describe, expect, it } from 'vitest'
import {
  COVERAGE_KINDS,
  areaOf,
  classifyFaces,
  groupFaces,
  planFeaturesOf,
  planTags,
  type Coverage,
  type CoverageFeature,
  type CoverageKind,
  type Face,
} from '../src/coverage'
import type { TrimmedFeature } from '../src/engine-plan'
import { trimmedFeature } from './trimmed-feature'

describe('classifyFaces', () => {
  const regions = [1, 2, 3, 4, 5, 6].map((idx) => ({ idx, area: idx }))
  const features: Array<CoverageFeature> = [
    { tag: 'Pin', featureType: 'pocket', regionIdxs: [1, 2] },
    { tag: 'Cut', featureType: 'pocket', regionIdxs: [2, 3] },
    { tag: 'Last', featureType: 'pocket', regionIdxs: [4] },
    { tag: 'None', featureType: 'pocket', regionIdxs: [5] },
  ]

  const regionsOf = (faces: Coverage['faces'], kind: CoverageKind) =>
    faces[kind].map((face) => face.region)

  it('reads the constraints: ignored first, then pinned, the rest open', () => {
    const { total, faces } = classifyFaces({
      regions,
      features,
      pinned: new Set(['pin']),
      ignored: [1, 3],
    })
    // Face 1 is the pin's and ignored: ignored outranks pinned.
    expect(regionsOf(faces, 'pinned')).toEqual([2])
    expect(regionsOf(faces, 'ignored')).toEqual([3, 1])
    expect(regionsOf(faces, 'open')).toEqual([6, 5, 4])
    expect(regionsOf(faces, 'machined')).toEqual([])
    expect(regionsOf(faces, 'notMachined')).toEqual([])
    expect(COVERAGE_KINDS.reduce((sum, kind) => sum + areaOf(faces[kind]), 0)).toBe(total)
    expect(total).toBe(21)
  })

  it('reads the results: ignored first, then machined, the rest not machined', () => {
    const { faces } = classifyFaces({
      regions,
      features,
      ignored: [3],
      machined: new Set(['cut', 'last']),
    })
    expect(regionsOf(faces, 'ignored')).toEqual([3])
    expect(regionsOf(faces, 'machined')).toEqual([4, 2])
    expect(regionsOf(faces, 'notMachined')).toEqual([6, 5, 1])
    expect(regionsOf(faces, 'pinned')).toEqual([])
    expect(regionsOf(faces, 'open')).toEqual([])
  })

  it('matches tags whatever their case', () => {
    const { faces } = classifyFaces({ regions, features, machined: new Set(['cut']) })
    expect(faces.machined.map((face) => face.region)).toEqual([3, 2])
    expect(
      classifyFaces({ regions, features, pinned: new Set(['pin']) }).faces.pinned.map(
        (face) => face.region,
      ),
    ).toEqual([2, 1])
  })

  it('reads one view at a time: pins and Toolpath’s plan together do not type-check', () => {
    // `pnpm check-types` holds this; at run time the pins are read.
    // @ts-expect-error -- the constraints and the results are never classified together
    const both = classifyFaces({ regions, features, pinned: new Set(), machined: new Set() })
    expect(both.faces.machined).toEqual([])
  })
})

describe('planTags', () => {
  it('is every tag a plan cuts, lower case', () => {
    expect(planTags([{ actions: [{ featureTags: ['A', 'b'] }, { featureTags: null }] }])).toEqual(
      new Set(['a', 'b']),
    )
  })
})

describe('planFeaturesOf', () => {
  const up = { x: 0, y: 0, z: 1 }
  const side = { x: 1, y: 0, z: 0 }
  const regions = [1, 2, 3, 4, 5, 6].map((idx) => ({ idx, area: idx }))
  const report: Array<CoverageFeature & { machiningDirection: typeof up }> = [
    { tag: 'A', featureType: 'pocket', regionIdxs: [1, 2, 3], machiningDirection: up },
    { tag: 'C', featureType: 'pocket', regionIdxs: [4, 5, 6], machiningDirection: up },
    { tag: 'D', featureType: 'wall', regionIdxs: [6], machiningDirection: side },
  ]
  const kinds = (
    features: ReadonlyArray<CoverageFeature>,
    cut: Array<string>,
    ignored: Array<number> = [],
  ) => {
    const { faces } = classifyFaces({ regions, features, ignored, machined: new Set(cut) })
    return COVERAGE_KINDS.map((kind) => [kind, faces[kind].map((face) => face.region).sort()])
  }

  it('lists the report’s features, then the plan’s trimmed ones shaped as features', () => {
    const cut = trimmedFeature({ featureTag: "A'", regionIdxs: [1, 2], fromFeatureTag: 'A' })
    expect(planFeaturesOf(report, { trimmedFeatures: [cut] })).toEqual([
      ...report.map((feature) => ({ ...feature, fromFeatureTag: null })),
      {
        tag: "A'",
        featureType: 'pocket',
        regionIdxs: [1, 2],
        machiningDirection: up,
        trimmed: true,
        fromFeatureTag: 'A',
      },
    ])
  })

  it('reads a feature trimmed by ignored faces as machined, where the plan cuts its tag', () => {
    const cut = trimmedFeature({ featureTag: "a'", regionIdxs: [1, 2], fromFeatureTag: 'A' })
    const features = planFeaturesOf(report, { trimmedFeatures: [cut] })
    // Face 3 ignored; the plan names only the trimmed tag.
    expect(kinds(features, ["a'"], [3])).toEqual([
      ['pinned', []],
      ['ignored', [3]],
      ['open', []],
      ['machined', [1, 2]],
      ['notMachined', [4, 5, 6]],
    ])
    // Joined to the report alone, the same faces read as not machined.
    expect(kinds(report, ["a'"], [3])[3]).toEqual(['machined', []])
  })

  it('reads what a pin from another direction leaves of a feature as machined', () => {
    // D, pinned from the side, shares face 6 with C: C' is what is left of C from above.
    const cut = trimmedFeature({ featureTag: "c'", regionIdxs: [4, 5], fromFeatureTag: 'C' })
    const features = planFeaturesOf(report, { trimmedFeatures: [cut] })
    expect(kinds(features, ['d', "c'"])).toEqual([
      ['pinned', []],
      ['ignored', []],
      ['open', []],
      ['machined', [4, 5, 6]],
      ['notMachined', [1, 2, 3]],
    ])
  })

  it('reads a plan with no trimmed features, or none, as the report alone', () => {
    const joined = (plan: { trimmedFeatures?: Array<TrimmedFeature> } | null) =>
      kinds(planFeaturesOf(report, plan), ['a'])
    expect(joined({ trimmedFeatures: [] })).toEqual(kinds(report, ['a']))
    expect(joined({})).toEqual(kinds(report, ['a']))
    expect(joined(null)).toEqual(kinds(report, ['a']))
  })

  it('drops a trimmed feature whose tag the report lists already', () => {
    expect(planFeaturesOf(report, null).some((feature) => 'trimmed' in feature)).toBe(false)
    const clash = trimmedFeature({ featureTag: 'c', regionIdxs: [4], fromFeatureTag: 'C' })
    expect(planFeaturesOf(report, { trimmedFeatures: [clash] }).map((f) => f.tag)).toEqual([
      'A',
      'C',
      'D',
    ])
  })

  it('reads a pinned trimmed feature in the constraints view, and no unpinned one', () => {
    const plan = {
      trimmedFeatures: [
        trimmedFeature({ featureTag: "C'", regionIdxs: [4, 5], fromFeatureTag: 'C' }),
        trimmedFeature({ featureTag: "A'", regionIdxs: [1, 2], fromFeatureTag: 'A' }),
      ],
    }
    const pinned = new Set(["c'", 'd'])
    const features = planFeaturesOf(report, plan, pinned)
    expect(features.filter((f) => f.trimmed).map((f) => f.tag)).toEqual(["C'"])
    const { faces } = classifyFaces({ regions, features, pinned })
    expect(faces.pinned.map((face) => face.region).sort()).toEqual([4, 5, 6])
    expect(faces.open.map((face) => face.region).sort()).toEqual([1, 2, 3])
  })

  it('gathers a trimmed feature’s faces under its own tag', () => {
    const cut = trimmedFeature({ featureTag: "c'", regionIdxs: [4, 5], fromFeatureTag: 'C' })
    const features = planFeaturesOf(report, { trimmedFeatures: [cut] })
    const { faces } = classifyFaces({ regions, features, machined: new Set(['a', 'd']) })
    expect(groupFaces(faces.notMachined, features).map((group) => group.tag)).toEqual(["c'"])
  })
})

describe('groupFaces', () => {
  const face = (region: number, area: number, owners: Array<string>): Face => ({
    region,
    area,
    owners,
  })
  const features: Array<CoverageFeature> = [
    { tag: 'pocket', featureType: 'pocket', regionIdxs: [1, 2, 3, 4, 5] },
    { tag: 'floor', featureType: 'face', regionIdxs: [1] },
    { tag: 'wall', featureType: 'wall', regionIdxs: [2] },
    { tag: 'hole', featureType: 'blind_hole', regionIdxs: [3, 4] },
    { tag: 'profile', featureType: 'profile', regionIdxs: Array.from({ length: 40 }, (_, i) => i) },
  ]

  it('gathers faces under the feature that includes the most of them', () => {
    const faces = [
      face(1, 10, ['pocket', 'floor']),
      face(2, 5, ['pocket', 'wall']),
      face(3, 4, ['pocket']),
    ]
    expect(groupFaces(faces, features)).toEqual([{ tag: 'pocket', area: 19, faces }])
  })

  it('takes a profile only for a face nothing else includes', () => {
    const groups = groupFaces(
      [face(1, 10, ['floor', 'profile']), face(2, 5, ['wall', 'profile']), face(3, 4, ['profile'])],
      features,
    )
    expect(groups.map((group) => [group.tag, group.faces.map((each) => each.region)])).toEqual([
      ['floor', [1]],
      ['wall', [2]],
      ['profile', [3]],
    ])
  })

  it('prefers the more specific feature among equals', () => {
    const groups = groupFaces(
      [face(1, 10, ['wall', 'hole']), face(2, 5, ['wall', 'hole'])],
      features,
    )
    expect(groups.map((group) => group.tag)).toEqual(['hole'])
  })

  // A stud or round boss read as a `boss` before the kernel reported `circular_wall`; a turned
  // outline read as a `wall`. Standing on a floor or not, the type alone ranks it, with the bosses.
  it('ranks a circular wall with the bosses, ahead of an edge or a wall among equals', () => {
    const shapes: Array<CoverageFeature> = [
      { tag: 'stud', featureType: 'circular_wall', regionIdxs: [6, 7] },
      { tag: 'edge', featureType: 'chamfer', regionIdxs: [6, 8] },
      { tag: 'side', featureType: 'wall', regionIdxs: [7, 9] },
    ]
    const first = (faces: Array<Face>) => groupFaces(faces, shapes).map((group) => group.tag)
    expect(first([face(6, 3, ['edge', 'stud'])])).toEqual(['stud'])
    expect(first([face(7, 2, ['side', 'stud'])])).toEqual(['stud'])
  })

  it('lists features largest first, then the faces no feature includes, passing over unknown owners', () => {
    const groups = groupFaces(
      [
        face(1, 30, []),
        face(2, 20, ['floor']),
        face(3, 15, ['hole']),
        face(4, 10, ['hole']),
        face(5, 40, ['ghost']),
      ],
      features,
    )
    expect(groups.map((group) => [group.tag, group.area])).toEqual([
      ['hole', 25],
      ['floor', 20],
      [null, 40],
      [null, 30],
    ])
  })
})
