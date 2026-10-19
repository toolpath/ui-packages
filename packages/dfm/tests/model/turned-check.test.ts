import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RULE_COLORS, type DfmRule } from '../../src/model/dfm-rules.js'
import {
  checkTurnedPart,
  turnedStretches,
  type TurnedReportFeature,
} from '../../src/model/turned-check.js'

const [RED = '', , YELLOW = ''] = RULE_COLORS.map((each) => each.value)

/** The `turning.features` of a real report: a shaft with an OD groove and a through bore. */
const SHAFT: TurnedReportFeature[] = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/turned-shaft-features.json'),
    'utf8',
  ),
)

const rule = (over: Partial<DfmRule>): DfmRule => ({
  id: 'r',
  subject: 'any',
  metric: 'present',
  op: 'gte',
  value: 0,
  color: YELLOW,
  ...over,
})

const datasheet = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  zMin: 0,
  zMax: 10,
  rMin: 5,
  rMax: 10,
  mounting: 'Radial',
  facts: { kind: 'OdProfile' },
  toleranceBand: { atolIgnore: 0.001, atolDeviate: 0.01, atolMax: 0.05 },
  ...over,
})

const feature = (
  featureTag: string,
  over: Partial<TurnedReportFeature> = {},
): TurnedReportFeature => ({
  featureTag,
  featureType: 'od_profile',
  approach: 'PlusZ',
  regionIdxs: [1],
  datasheet: datasheet(),
  ...over,
})

/** The part checked, and the tags each rule caught. */
const check = (features: readonly TurnedReportFeature[], rules: readonly DfmRule[]) => {
  const result = checkTurnedPart(turnedStretches(features), rules)
  return { result, tags: (id: string) => result.byRule.find((each) => each.rule.id === id)?.tags }
}

describe('turnedStretches', () => {
  it('merges the per-end copies of one stretch under the first copy’s tag', () => {
    const stretches = turnedStretches([
      feature('A', { featureType: 'od_groove', regionIdxs: [3, 1] }),
      feature('B', { featureType: 'od_groove', approach: 'MinusZ', regionIdxs: [1, 3] }),
      feature('C', { regionIdxs: [3, 1] }),
    ])
    expect(stretches.map((each) => each.tag)).toEqual(['A', 'C'])
    const [groove, profile] = stretches
    expect(groove?.copies.map((each) => each.featureTag)).toEqual(['A', 'B'])
    expect(groove?.approaches).toEqual(['PlusZ', 'MinusZ'])
    expect(groove?.machiningDirection).toEqual({ x: 0, y: 0, z: 0 })
    expect(groove?.regionIdxs).toEqual([3, 1])
    expect(profile?.machiningDirection).toEqual({ x: 0, y: 0, z: 1 })
    expect(stretches.map((each) => each.number).sort()).toEqual([1, 2])
  })

  it('keeps copies with no faces apart, and points a −Z stretch down the axis', () => {
    const stretches = turnedStretches([
      feature('A', { regionIdxs: [], approach: 'MinusZ' }),
      feature('B', { regionIdxs: [], approach: null }),
    ])
    expect(stretches.map((each) => each.tag)).toEqual(['A', 'B'])
    expect(stretches[0]?.machiningDirection.z).toBe(-1)
    expect(stretches[1]?.approaches).toEqual([])
  })
})

describe('checkTurnedPart', () => {
  it('counts a stretch cut from both ends once against a rule', () => {
    const { result, tags } = check(
      [feature('A'), feature('B', { approach: 'MinusZ' })],
      [rule({ id: 'any' })],
    )
    expect(tags('any')).toEqual(['A'])
    expect(result.hitsByTag.get('a')).toHaveLength(1)
    expect(result.hitsByTag.has('b')).toBe(false)
  })

  it('never reads a groove depth off an axial hole, whose depth is its length', () => {
    const hole = feature('H', {
      featureType: 'axial_hole',
      datasheet: datasheet({
        facts: { kind: 'AxialHole', through: true, depth: 100, steps: [{ diameter: 10 }] },
      }),
    })
    const { tags } = check(
      [hole],
      [
        rule({ id: 'groove', metric: 'grooveDepth', value: 5 }),
        rule({ id: 'hole', metric: 'holeDepth', value: 50 }),
      ],
    )
    expect(tags('groove')).toEqual([])
    expect(tags('hole')).toEqual(['H'])
  })

  it('reads a corner radius of 0 as a sharp corner, and a missing one as no corner', () => {
    const rules = [
      rule({ id: 'radius', metric: 'cornerRadius', op: 'lte', value: 0.4 }),
      rule({ id: 'sharp', metric: 'sharpCorner' }),
    ]
    const sharp = check([feature('S', { datasheet: datasheet({ minConcaveRadius: 0 }) })], rules)
    expect(sharp.tags('radius')).toEqual(['S'])
    expect(sharp.tags('sharp')).toEqual(['S'])
    expect(sharp.result.hitsByTag.get('s')?.[0]?.value).toBe(0)
    const none = check([feature('N')], rules)
    expect(none.tags('radius')).toEqual([])
    expect(none.tags('sharp')).toEqual([])
  })

  it('takes a hole’s L/D as its depth over its narrowest step', () => {
    const hole = feature('H', {
      featureType: 'axial_hole',
      datasheet: datasheet({
        facts: {
          kind: 'AxialHole',
          through: false,
          depth: 40,
          steps: [{ diameter: 10 }, { diameter: 5 }],
        },
      }),
    })
    const { result } = check([hole], [rule({ id: 'ld', metric: 'ld', value: 4 })])
    expect(result.hitsByTag.get('h')?.[0]?.value).toBe(8)
  })

  describe('inside L/D, from the end each copy is cut from', () => {
    // The part runs from z 0 to 100; the bore is 10 across at z 60–90, so 40 in from +Z and 90 from −Z.
    const part = [
      feature('OD', { regionIdxs: [9], datasheet: datasheet({ zMin: 0, zMax: 100 }) }),
      ...(['PlusZ', 'MinusZ'] as const).map((approach) =>
        feature(`ID-${approach}`, {
          featureType: 'id_profile',
          approach,
          regionIdxs: [4],
          datasheet: datasheet({ zMin: 60, zMax: 90, rMin: 5, facts: { kind: 'IdProfile' } }),
        }),
      ),
    ]

    it('is clean where one end is clean', () => {
      expect(check(part, [rule({ id: 'ld', metric: 'ld', value: 5 })]).tags('ld')).toEqual([])
    })

    it('breaks where both ends break, at the easier end’s figure', () => {
      const { result, tags } = check(part, [rule({ id: 'ld', metric: 'ld', value: 3 })])
      expect(tags('ld')).toEqual(['ID-PlusZ'])
      expect(result.hitsByTag.get('id-plusz')?.[0]?.value).toBe(4)
    })

    it('divides by the entry diameter where something narrower stands in the way', () => {
      const narrowed = part.map((each) =>
        each.featureType === 'id_profile'
          ? { ...each, datasheet: { ...(each.datasheet as object), entryDiameter: 4 } }
          : each,
      )
      const { result } = check(narrowed, [rule({ id: 'ld', metric: 'ld', value: 3 })])
      expect(result.hitsByTag.get('id-plusz')?.[0]?.value).toBe(10)
    })
  })

  it('reads a missing entry diameter as nothing in the way', () => {
    const rules = [rule({ id: 'entry', metric: 'entryDiameter', op: 'lte', value: 10 })]
    expect(check([feature('A')], rules).tags('entry')).toEqual([])
    const narrow = feature('A', { datasheet: datasheet({ entryDiameter: 8 }) })
    expect(check([narrow], rules).tags('entry')).toEqual(['A'])
  })

  it('fires only "any size" on a stretch with no datasheet', () => {
    const { result } = check(
      [feature('A', { datasheet: null })],
      [
        rule({ id: 'any' }),
        rule({ id: 'big', metric: 'maxDiameter', value: 0 }),
        rule({ id: 'sharp', metric: 'sharpCorner' }),
      ],
    )
    expect(result.hitsByTag.get('a')?.map((hit) => hit.rule.id)).toEqual(['any'])
  })

  it('takes malformed fields as no figure, and does not throw', () => {
    const rules = [
      'maxDiameter',
      'minDiameter',
      'length',
      'ld',
      'grooveWidth',
      'holeDiameter',
      'holeSteps',
      'flatBottom',
      'threadPitch',
      'cornerRadius',
      'sharpCorner',
      'axialTool',
      'tolerance',
    ].map((metric) => rule({ id: metric, metric, op: 'gte', value: 0 }))
    const broken = [
      feature('A', { datasheet: 42 }),
      feature('B', { regionIdxs: [2], datasheet: [] }),
      feature('C', {
        regionIdxs: [3],
        datasheet: {
          rMax: 'big',
          rMin: null,
          zMin: '0',
          minConcaveRadius: null,
          mounting: 7,
          toleranceBand: 5,
          facts: { kind: 'AxialHole', steps: 'many', bottom: 'flat', thread: [] },
        },
      }),
      feature('D', { regionIdxs: [4], datasheet: { facts: 'oops' } }),
    ]
    const { result } = check(broken, rules)
    for (const hits of result.hitsByTag.values()) expect(hits).toEqual([])
  })

  it('requires every stretch, so nothing is left in otherTags or painted whole', () => {
    const { result } = check(
      [feature('A'), feature('B', { regionIdxs: [2] })],
      [rule({ id: 'any' })],
    )
    expect([...result.required].sort()).toEqual(['a', 'b'])
    expect(result.byRule[0]?.otherTags).toEqual([])
    expect(result.paintedWhole.size).toBe(0)
  })

  it('paints a broken stretch’s faces in its worst colour, and a shared face in the worse', () => {
    const { result } = check(
      [
        feature('A', { regionIdxs: [1, 2] }),
        feature('G', {
          featureType: 'od_groove',
          regionIdxs: [2, 3],
          datasheet: datasheet({ facts: { kind: 'OdGroove', width: 2, depth: 1 } }),
        }),
      ],
      [rule({ id: 'any', color: YELLOW }), rule({ id: 'grooves', subject: 'groove', color: RED })],
    )
    expect(result.paintedFaces.get(1)).toEqual({ tag: 'A', color: YELLOW })
    expect(result.paintedFaces.get(2)).toEqual({ tag: 'G', color: RED })
    expect(result.paintedFaces.get(3)).toEqual({ tag: 'G', color: RED })
  })

  it('reads each figure from where its kind keeps it', () => {
    const odThread = feature('OT', {
      featureType: 'od_thread',
      regionIdxs: [1],
      datasheet: datasheet({
        facts: { kind: 'OdThread', pitch: 1.5, depth: 0.9, threadSpec: { basicDiameter: 20 } },
      }),
    })
    const tappedHole = feature('TH', {
      featureType: 'axial_hole',
      regionIdxs: [2],
      datasheet: datasheet({
        mounting: 'Axial',
        facts: {
          kind: 'AxialHole',
          through: false,
          depth: 12,
          steps: [{ diameter: 8 }, { diameter: 5 }],
          bottom: { z: 0, coneDeg: 180 },
          thread: { threadSpec: { threadPitch: 0.8, basicDiameter: 6 } },
        },
      }),
    })
    const groove = feature('G', {
      featureType: 'face_groove',
      regionIdxs: [3],
      datasheet: datasheet({ facts: { kind: 'FaceGroove', width: 2, depth: 7 } }),
    })
    const figures = (metric: string) =>
      Object.fromEntries(
        [
          ...check(
            [odThread, tappedHole, groove],
            [rule({ id: metric, metric, op: 'gte', value: 0 })],
          ).result.hitsByTag,
        ].flatMap(([tag, hits]) => (hits[0] ? [[tag, hits[0].value]] : [])),
      )
    expect(figures('threadPitch')).toEqual({ ot: 1.5, th: 0.8 })
    expect(figures('threadDiameter')).toEqual({ ot: 20, th: 6 })
    expect(figures('threadDepth')).toEqual({ ot: 0.9 })
    expect(figures('holeSteps')).toEqual({ th: 2 })
    expect(figures('flatBottom')).toEqual({ th: 1 })
    expect(figures('axialTool')).toEqual({ th: 1 })
    expect(figures('grooveWidth')).toEqual({ g: 2 })
    expect(figures('grooveAspect')).toEqual({ g: 3.5 })
    expect(figures('minDiameter')).toEqual({ ot: 10, th: 10 })
  })

  it('picks out threads and holes by what the hole’s facts say', () => {
    const hole = (tag: string, region: number, facts: Record<string, unknown>) =>
      feature(tag, {
        featureType: 'axial_hole',
        regionIdxs: [region],
        datasheet: datasheet({ facts: { kind: 'AxialHole', depth: 10, steps: [], ...facts } }),
      })
    const part = [
      hole('Through', 1, { through: true }),
      hole('Blind', 2, { through: false }),
      hole('Tapped', 3, { through: false, thread: { threadSpec: { threadPitch: 1 } } }),
      feature('Thread', {
        featureType: 'id_thread',
        regionIdxs: [4],
        datasheet: datasheet({ facts: { kind: 'IdThread', pitch: 1, depth: 0.5 } }),
      }),
    ]
    const subjects = ['thread', 'throughHole', 'blindHole', 'threadedHole', 'hole', 'id']
    const { tags } = check(
      part,
      subjects.map((subject) => rule({ id: subject, subject })),
    )
    expect(tags('thread')).toEqual(['Tapped', 'Thread'])
    expect(tags('throughHole')).toEqual(['Through'])
    expect(tags('blindHole')).toEqual(['Blind', 'Tapped'])
    expect(tags('threadedHole')).toEqual(['Tapped'])
    expect(tags('hole')).toEqual(['Through', 'Blind', 'Tapped'])
    expect(tags('id')).toEqual(['Thread'])
  })

  it('counts a copy with no figure as a clean way to cut the stretch', () => {
    const rules = [rule({ id: 'sharp', metric: 'cornerRadius', op: 'lte', value: 1 })]
    const sharp = datasheet({ minConcaveRadius: 0 })
    // One end measured sharp, the other with no inside corner at all: clean.
    const mixed = [
      feature('A', { datasheet: sharp }),
      feature('B', { approach: 'MinusZ', datasheet: datasheet() }),
    ]
    expect(check(mixed, rules).tags('sharp')).toEqual([])
    // One end unmeasured: only the measured copy is asked.
    const unmeasured = [
      feature('A', { datasheet: sharp }),
      feature('B', { approach: 'MinusZ', datasheet: null }),
    ]
    expect(check(unmeasured, rules).tags('sharp')).toEqual(['A'])
  })

  it('reads a datasheet with no kind as its type says, for subject and figure alike', () => {
    const groove = feature('G', {
      featureType: 'od_groove',
      datasheet: datasheet({ facts: { width: 1 } }),
    })
    const { tags } = check(
      [groove],
      [rule({ id: 'width', subject: 'groove', metric: 'grooveWidth', op: 'lte', value: 1.5 })],
    )
    expect(tags('width')).toEqual(['G'])
  })

  it('takes a feature whose faces are not a list as one with none, and does not throw', () => {
    const odd = { ...feature('A'), regionIdxs: null } as unknown as TurnedReportFeature
    const [stretch] = turnedStretches([odd])
    expect(stretch?.regionIdxs).toEqual([])
    expect(checkTurnedPart([stretch!], [rule({ id: 'any' })]).paintedFaces.size).toBe(0)
  })

  it('reads a real shaft: eleven features as eight stretches', () => {
    const stretches = turnedStretches(SHAFT)
    expect(SHAFT).toHaveLength(11)
    expect(stretches).toHaveLength(8)
    const result = checkTurnedPart(stretches, [
      rule({ id: 'any' }),
      rule({ id: 'groove', subject: 'groove', metric: 'grooveWidth', op: 'lte', value: 4 }),
      rule({ id: 'grooveDepth', metric: 'grooveDepth', value: 1 }),
      rule({ id: 'deepHole', subject: 'hole', metric: 'ld', value: 8 }),
      rule({ id: 'sharp', metric: 'sharpCorner' }),
      rule({ id: 'tight', metric: 'tolerance', op: 'lte', value: 0.01 }),
    ])
    const tags = (id: string) => result.byRule.find((each) => each.rule.id === id)?.tags ?? []
    expect(tags('any')).toHaveLength(8)
    expect(tags('groove')).toEqual(['6800db7db501fb6f'])
    // Only the groove is a groove: the bore's 110 mm depth is no groove depth.
    expect(tags('grooveDepth')).toEqual(['6800db7db501fb6f'])
    expect(tags('deepHole')).toEqual(['133d2ae3c98c6acd'])
    expect(
      result.hitsByTag.get('133d2ae3c98c6acd')?.find((hit) => hit.rule.id === 'deepHole'),
    ).toMatchObject({ value: 11 })
    expect(tags('sharp')).toHaveLength(3)
    expect(tags('tight')).toEqual([])
  })
})
