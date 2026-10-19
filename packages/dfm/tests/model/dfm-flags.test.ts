import { describe, expect, it } from 'vitest'
import {
  checkPart,
  featureComplexity,
  requiredTags,
  withSurroundedFaces,
  type DfmSources,
} from '../../src/model/dfm-flags.js'
import { RULE_COLORS, type DfmRule } from '../../src/model/dfm-rules.js'
import { featureSheet, type FeatureSheets } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'

const [RED = '', ORANGE = '', YELLOW = '', PURPLE = ''] = RULE_COLORS.map((each) => each.value)
const UP = { x: 0, y: 0, z: 1 }
const TILTED = { x: 0.7071, y: 0, z: 0.7071 }

const feature = (tag: string, over: Partial<DfmFeature> = {}): DfmFeature => ({
  tag,
  featureType: 'pocket',
  machiningDirection: UP,
  regionIdxs: [0],
  number: 0,
  ...over,
})

const rule = (over: Partial<DfmRule> = {}): DfmRule => ({
  id: over.metric ?? 'r',
  subject: 'any',
  metric: 'present',
  op: 'gte',
  value: 0,
  color: YELLOW,
  ...over,
})

/** The sources for a check: datasheets as the API sends them, cut down to sheets the same way the worker does. */
const sourcesOf = (
  datasheets: Record<string, unknown>,
  regionAreas: [number, number][] = [],
): DfmSources => {
  const sheets: FeatureSheets = {}
  for (const [tag, datasheet] of Object.entries(datasheets))
    sheets[tag.toLowerCase()] = featureSheet(datasheet)
  return { sheets, datasheets, regionAreas: new Map(regionAreas) }
}

const tolerance = { atolIgnore: 0.01, atolDeviate: 0.02, atolMax: 0.05 }
const walled = (facts: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  zMin: -20,
  zMax: 0,
  extendedZMax: 0,
  hasWall: true,
  toleranceBand: tolerance,
  facts: { cd: { ignore: { min: 6.1, max: 40 }, deviate: { min: 6.2, max: 40 } }, ...facts },
  ...over,
})
const hole = (over: Record<string, unknown> = {}, facts: Record<string, unknown> = {}) => ({
  zMin: -40,
  zMax: 0,
  extendedZMax: 0,
  facts: { kind: 'Hole', diameter: 5, fullConeDeg: 118, ...facts },
  ...over,
})

/** The tags a rule caught, required ones. */
const caught = (features: DfmFeature[], sources: DfmSources, rules: DfmRule[]): string[][] =>
  checkPart(features, sources, rules).byRule.map(({ tags }) => tags)

describe('which features a subject names', () => {
  const features = [
    feature('drilled', { featureType: 'through_hole', regionIdxs: [0] }),
    feature('flat', { featureType: 'blind_hole', regionIdxs: [1] }),
    feature('thread', { featureType: 'thread', regionIdxs: [2] }),
    feature('tapped', { featureType: 'threaded_blind_hole', regionIdxs: [3] }),
    feature('face', { featureType: 'face', regionIdxs: [4] }),
    feature('slant', { featureType: 'slanted_face', regionIdxs: [5] }),
    feature('sink', { featureType: 'sink', regionIdxs: [6] }),
    feature('back', { featureType: 'back_sink', regionIdxs: [7] }),
    feature('uslot', { featureType: 'u_slot', regionIdxs: [8] }),
  ]
  const sources = sourcesOf({
    drilled: hole(),
    flat: hole({}, { fullConeDeg: 180 }),
    thread: hole({}, { threading: { spec: { basicDiameter: 6, threadPitch: 1 } } }),
    tapped: hole(),
    face: { facts: { kind: 'Face' } },
    slant: { facts: { kind: 'Face' } },
    sink: { facts: { kind: 'Chamfer' } },
    back: { facts: { kind: 'Chamfer' } },
    uslot: { facts: { kind: 'Tslot' } },
  })
  const names = (subject: string): string[] =>
    caught(features, sources, [rule({ subject })])[0] ?? []

  it('splits drilled from milled by the tip, so a flat-bottomed hole is milled', () => {
    expect(names('drilled')).toEqual(['drilled', 'thread', 'tapped'])
    expect(names('milled')).toContain('flat')
    expect(names('milled')).not.toContain('drilled')
  })

  it('reads a hole by its type or kind, and a threaded hole by its threading facts', () => {
    expect(names('hole')).toEqual(['drilled', 'flat', 'thread', 'tapped'])
    expect(names('threadedHole')).toEqual(['thread'])
  })

  it('matches a face by type or datasheet kind, a countersink by type alone, slots and undercuts by word', () => {
    // A slanted face reads as a face when its datasheet's kind is Face.
    expect(names('face')).toEqual(['face', 'slant'])
    expect(names('countersink')).toEqual(['sink'])
    expect(names('slot')).toEqual(['uslot'])
    expect(names('undercut')).toEqual(['uslot'])
  })

  it('names one type exactly, and everything with any', () => {
    expect(names('type:back_sink')).toEqual(['back'])
    expect(names('type:sink')).toEqual(['sink'])
    expect(names('any')).toHaveLength(9)
  })
  it('names a fillet by the word, so a filleted pocket, hole or boss is not one', () => {
    const filleted = [
      feature('outer', { featureType: 'outer_fillet', regionIdxs: [0] }),
      feature('plain', { featureType: 'fillet', regionIdxs: [1] }),
      feature('pocket', { featureType: 'filleted_pocket', regionIdxs: [2] }),
      feature('hole', { featureType: 'filleted_blind_hole', regionIdxs: [3] }),
      feature('boss', { featureType: 'filleted_boss', regionIdxs: [4] }),
      feature('tslot', { featureType: 'undercut_filleted_tslot', regionIdxs: [5] }),
    ]
    const empty = sourcesOf(Object.fromEntries(filleted.map(({ tag }) => [tag, {}])))
    expect(caught(filleted, empty, [rule({ subject: 'fillet' })])[0]).toEqual(['outer', 'plain'])
  })
})

describe('how a metric is read, and when a rule abstains', () => {
  const one = [feature('p', { regionIdxs: [0] })]
  const hit = (datasheet: unknown, over: Partial<DfmRule>): boolean =>
    caught(one, sourcesOf({ p: datasheet }), [rule(over)])[0]?.length === 1

  it('abstains on a missing figure, an infinity, or a zero that is no measurement', () => {
    expect(hit(walled({ kind: 'Pocket' }), { metric: 'diameter', op: 'lte', value: 10 })).toBe(
      false,
    )
    expect(
      hit(
        { facts: { kind: 'Pocket', maxBottomDiameter: 'inf' } },
        { metric: 'maxBottomDiameter', op: 'gte', value: 0 },
      ),
    ).toBe(false)
    expect(hit(hole({}, { diameter: 0 }), { metric: 'diameter', op: 'lte', value: 10 })).toBe(false)
    expect(
      hit(walled({ kind: 'Pocket', filletRadius: 0 }), {
        metric: 'floorFillet',
        op: 'lte',
        value: 1,
      }),
    ).toBe(false)
  })

  it('reads a sharp corner’s zero radius as a measurement', () => {
    const sharp = walled({
      kind: 'Pocket',
      cd: { ignore: { min: 0.1, max: 40 }, deviate: { min: 0.2, max: 40 } },
    })
    expect(hit(sharp, { metric: 'cornerRadius', op: 'lte', value: 1 })).toBe(true)
    expect(hit(sharp, { metric: 'sharpCorner' })).toBe(true)
    expect(hit(walled({ kind: 'Pocket' }), { metric: 'sharpCorner' })).toBe(false)
  })

  it('reads an absent yes/no field as no, a present one as yes, and a presence rule as always', () => {
    expect(hit(hole(), { metric: 'threaded' })).toBe(false)
    expect(hit(hole({}, { threading: { spec: { threadPitch: 1 } } }), { metric: 'threaded' })).toBe(
      true,
    )
    expect(hit({ facts: { kind: 'Hole', isCounterbore: false } }, { metric: 'counterbore' })).toBe(
      false,
    )
    expect(hit({ facts: { kind: 'Hole', isCounterbore: true } }, { metric: 'counterbore' })).toBe(
      true,
    )
    expect(hit({}, { metric: 'present' })).toBe(true)
  })

  it('reads the derived figures: depth below top, both L/Ds, tilt, face count, areas', () => {
    expect(hit(hole(), { metric: 'depthBelowTop', op: 'gte', value: 40 })).toBe(true)
    expect(hit(hole(), { metric: 'ld', op: 'gte', value: 8 })).toBe(true)
    expect(hit(hole({ zMax: -20 }), { metric: 'featureLd', op: 'gte', value: 4.1 })).toBe(false)
    expect(hit(hole({ zMax: -20 }), { metric: 'featureLd', op: 'gte', value: 4 })).toBe(true)
    const tilted = [feature('p', { machiningDirection: TILTED })]
    expect(caught(tilted, sourcesOf({ p: {} }), [rule({ metric: 'tilted' })])[0]).toEqual(['p'])
    expect(caught(one, sourcesOf({ p: {} }), [rule({ metric: 'tilted' })])[0]).toEqual([])
    const many = [feature('p', { regionIdxs: [0, 1, 1, 2] })]
    expect(
      caught(many, sourcesOf({ p: {} }), [rule({ metric: 'faceCount', op: 'gte', value: 3 })])[0],
    ).toEqual(['p'])
    // Surface area from the datasheet's partition, else from the faces.
    expect(
      hit(
        { areas: { floorArea: 100, wallArea: 50 } },
        { metric: 'surfaceArea', op: 'gte', value: 150 },
      ),
    ).toBe(true)
    const fromFaces = checkPart(one, sourcesOf({ p: {} }, [[0, 200]]), [
      rule({ metric: 'surfaceArea', op: 'gte', value: 150 }),
    ])
    expect(fromFaces.byRule[0]?.tags).toEqual(['p'])
  })

  it('takes the first path that answers for a multi-path metric', () => {
    expect(
      hit({ facts: { three: { maxStepdown: 2 } } }, { metric: 'maxStepdown', op: 'lte', value: 2 }),
    ).toBe(true)
  })
})

describe('required features and what a rule counts', () => {
  const features = [
    feature('alone', { regionIdxs: [0, 1] }),
    feature('shared', { regionIdxs: [1] }),
    feature('other', { regionIdxs: [2] }),
  ]

  it('requires a feature that owns a face nobody else does', () => {
    expect([...requiredTags(features)]).toEqual(['alone', 'other'])
  })

  it('counts only required features against a rule, and lists the rest separately, worst first', () => {
    const sources = sourcesOf({
      alone: hole({ zMin: -20 }),
      shared: hole({ zMin: -60 }),
      other: hole({ zMin: -40 }),
    })
    const result = checkPart(features, sources, [rule({ metric: 'ld', op: 'gte', value: 1 })])
      .byRule[0]
    expect(result?.tags).toEqual(['other', 'alone'])
    expect(result?.otherTags).toEqual(['shared'])
  })

  it('orders a ≤ rule’s hits with the smallest first, and keeps report order for a yes/no', () => {
    const sources = sourcesOf({
      alone: hole({}, { diameter: 3 }),
      shared: hole(),
      other: hole({}, { diameter: 1 }),
    })
    expect(
      caught(features, sources, [rule({ metric: 'diameter', op: 'lte', value: 10 })])[0],
    ).toEqual(['other', 'alone'])
    expect(caught(features, sources, [rule({ metric: 'present' })])[0]).toEqual(['alone', 'other'])
  })

  it('keeps every feature’s hits, required or not, for the inspector', () => {
    const check = checkPart(features, sourcesOf({ alone: {}, shared: {}, other: {} }), [rule()])
    expect(check.hitsByTag.get('shared')).toHaveLength(1)
    expect(check.required.has('shared')).toBe(false)
  })
})

describe('plainness of a reading', () => {
  it('counts edge types and qualifiers', () => {
    expect(featureComplexity('pocket')).toBe(0)
    expect(featureComplexity('outer_fillet')).toBe(1)
    expect(featureComplexity('filleted_pocket')).toBe(1)
    expect(featureComplexity('undercut_filleted_tslot')).toBe(3)
  })
})

describe('which faces are painted', () => {
  const flagAll = [rule({ metric: 'present', color: YELLOW })]
  const areas: [number, number][] = [
    [0, 10],
    [1, 10],
    [2, 10],
    [3, 100],
  ]

  it('leaves a face unpainted when some reading of it breaks no rule', () => {
    const features = [
      feature('bad', { featureType: 'pocket', regionIdxs: [0, 1] }),
      feature('clean', { featureType: 'open_pocket', regionIdxs: [1] }),
    ]
    const check = checkPart(features, sourcesOf({ bad: {}, clean: {} }, areas), [
      rule({ subject: 'type:pocket' }),
    ])
    expect([...check.paintedFaces.keys()]).toEqual([0])
    expect(check.paintedFaces.get(0)).toEqual({ tag: 'bad', color: YELLOW })
  })

  it('paints for the plainest reading, then the mildest colour, then the largest area', () => {
    const features = [
      feature('fillet', { featureType: 'outer_fillet', regionIdxs: [0] }),
      feature('pocket', { featureType: 'pocket', regionIdxs: [0] }),
      feature('big', { featureType: 'open_pocket', regionIdxs: [0, 3] }),
    ]
    const rules = [
      rule({ subject: 'type:outer_fillet', color: RED, id: 'a' }),
      rule({ subject: 'type:pocket', color: ORANGE, id: 'b' }),
      rule({ subject: 'type:open_pocket', color: ORANGE, id: 'c' }),
    ]
    const check = checkPart(features, sourcesOf({ fillet: {}, pocket: {}, big: {} }, areas), rules)
    // Both pockets are plainer than the fillet and share a colour; the larger one wins.
    expect(check.paintedFaces.get(0)).toEqual({ tag: 'big', color: ORANGE })
    // Purple sits after orange in the palette: the milder reading wins over the larger one.
    const milder = checkPart(features, sourcesOf({ fillet: {}, pocket: {}, big: {} }, areas), [
      rule({ subject: 'type:outer_fillet', color: RED, id: 'a' }),
      rule({ subject: 'type:pocket', color: PURPLE, id: 'b' }),
      rule({ subject: 'type:open_pocket', color: ORANGE, id: 'c' }),
    ])
    expect(milder.paintedFaces.get(0)).toEqual({ tag: 'pocket', color: PURPLE })
  })

  it('paints a feature in the earliest palette colour of the rules it breaks, whatever the list order', () => {
    const features = [feature('p', { regionIdxs: [0] })]
    const check = checkPart(features, sourcesOf({ p: {} }, areas), [
      rule({ color: YELLOW, id: 'y' }),
      rule({ color: RED, id: 'r' }),
    ])
    expect(check.paintedFaces.get(0)?.color).toBe(RED)
  })

  it('paints a contour surface whole only when every reading of its face breaks a rule', () => {
    const features = [
      feature('surf', { featureType: 'contour_surface', regionIdxs: [0, 1] }),
      feature('wall', { featureType: 'wall', regionIdxs: [0] }),
    ]
    const both = checkPart(features, sourcesOf({ surf: {}, wall: {} }, areas), flagAll)
    expect(both.paintedWhole.get('surf')).toEqual({ tag: 'surf', color: YELLOW })
    // The wall alone breaks a rule: the contour is no way round it, so the face is painted for the wall.
    const wallOnly = checkPart(features, sourcesOf({ surf: {}, wall: {} }, areas), [
      rule({ subject: 'wall' }),
    ])
    expect(wallOnly.paintedFaces.get(0)).toEqual({ tag: 'wall', color: YELLOW })
    expect(wallOnly.paintedWhole.size).toBe(0)
    // The contour alone: the wall cuts the shared face clean, but face 1 has only the contour reading,
    // so the surface is still painted whole; the shared face is not painted on its own.
    const surfOnly = checkPart(features, sourcesOf({ surf: {}, wall: {} }, areas), [
      rule({ subject: 'contour' }),
    ])
    expect(surfOnly.paintedFaces.size).toBe(0)
    expect(surfOnly.paintedWhole.get('surf')).toEqual({ tag: 'surf', color: YELLOW })
    // With no face of its own, a contour reading beside a clean wall paints nothing at all.
    const shared = [
      feature('surf', { featureType: 'contour_surface', regionIdxs: [0] }),
      feature('wall', { featureType: 'wall', regionIdxs: [0] }),
    ]
    const none = checkPart(shared, sourcesOf({ surf: {}, wall: {} }, areas), [
      rule({ subject: 'contour' }),
    ])
    expect(none.paintedFaces.size + none.paintedWhole.size).toBe(0)
  })

  it('fills a face its painted neighbours surround, once, without spreading', () => {
    // A pocket owns faces 0, 1, 2 and 3; a through hole also reads 2, clean. Face 3 touches only face 2.
    const features = [
      feature('pocket', { regionIdxs: [0, 1, 2, 3] }),
      feature('hole', { featureType: 'through_hole', regionIdxs: [2] }),
    ]
    const sources = sourcesOf({ pocket: {}, hole: hole() }, areas)
    const check = checkPart(features, sources, [rule({ subject: 'pocket' })])
    expect(check.paintedFaces.has(2)).toBe(false)
    const adjacency = new Map<number, Set<number>>([
      [2, new Set([0, 1, 3])],
      [3, new Set([2])],
      [0, new Set([2])],
      [1, new Set([2])],
    ])
    const filled = withSurroundedFaces(check, features, adjacency)
    expect(filled.paintedFaces.get(2)).toEqual({ tag: 'pocket', color: YELLOW })
    // Face 3 was painted already; a face only reachable through the filled one gains nothing new.
    expect(filled.paintedFaces.size).toBe(4)
  })

  it('does not fill a surrounded face the surrounding feature does not own', () => {
    const features = [
      feature('pocket', { regionIdxs: [0, 1] }),
      feature('boss', { featureType: 'boss', regionIdxs: [2] }),
    ]
    const check = checkPart(features, sourcesOf({ pocket: {}, boss: {} }, areas), [
      rule({ subject: 'pocket' }),
    ])
    const filled = withSurroundedFaces(check, features, new Map([[2, new Set([0, 1])]]))
    expect(filled.paintedFaces.has(2)).toBe(false)
  })
})
