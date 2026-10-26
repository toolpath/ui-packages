import { describe, expect, it } from 'vitest'
import {
  COVERAGE_KINDS,
  areaOf,
  classifyFaces,
  groupFaces,
  planTags,
  type Coverage,
  type CoverageFeature,
  type CoverageKind,
  type Face,
} from '../src/coverage'

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
