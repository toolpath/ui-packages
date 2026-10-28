import { describe, expect, it } from 'vitest'
import type { EnginePlan } from '../src/engine-plan'
import { planFromResults, type DraftSetup } from '../src/plan-draft'
import { classifyFaces, planFeaturesOf } from '../src/coverage'
import { planView, rowsOf, type PlanPart } from '../src/plan-view'
import { resultsView, setupOf } from '../src/results-view'
import { trimmedFeature } from './trimmed-feature'

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }
const down = { x: 0, y: 0, z: -1 }

const part: PlanPart = {
  directionIndex: (direction) => [up, side, down].findIndex((d) => d === direction),
  featureLabel: (tag) => `Feature ${tag}`,
  featureType: () => 'pocket',
}

const plan = (overrides: Partial<EnginePlan> = {}): EnginePlan => ({
  planId: 'plan-1',
  jobId: null,
  level: 'toolpathed',
  kernelVersion: 'k1',
  issues: [],
  setups: [
    {
      idx: 0,
      direction: up,
      unmachined: ['c', 'd'],
      actions: [
        { idx: 0, toolName: 'Face mill', featureTags: ['a'] },
        { idx: 1, toolName: 'End mill', featureTags: ['b', 'a', 'c'] },
      ],
    },
    {
      idx: 1,
      direction: side,
      unmachined: [],
      actions: [{ idx: 0, toolName: 'Drill', featureTags: ['e'] }],
    },
  ],
  setupPlan: null,
  trimmedFeatures: [],
  ...overrides,
})

const setup = (overrides: Partial<DraftSetup>): DraftSetup => ({
  id: 'f1',
  name: 'Top',
  direction: up,
  features: [],
  folders: [],
  ...overrides,
})

describe('resultsView', () => {
  it('is empty with no plan', () => {
    expect(resultsView({ plan: null, constraints: null, part })).toEqual({
      setups: [],
      leftOut: [],
    })
  })

  it('names a setup by the constraint folder facing its way, else Setup N, and lists left-out frames', () => {
    const constraints = {
      setups: [
        setup({ id: 'f1', name: 'Top' }),
        setup({ id: 'f2', name: 'Under', direction: down }),
      ],
    }
    const { setups, leftOut } = resultsView({ plan: plan(), constraints, part })
    expect(setups.map((each) => [each.idx, each.name, each.fromFolder])).toEqual([
      [0, 'Top', 'f1'],
      [1, 'Setup 2', null],
    ])
    expect(leftOut).toEqual([{ folderId: 'f2', name: 'Under' }])
  })

  it('names a tilt frame by its setup and the tilt', () => {
    const constraints = {
      setups: [
        setup({
          id: 'f1',
          name: 'Top',
          process: '3+2',
          folders: [{ id: 't1', name: 'Tilt', direction: side, features: [], folders: [] }],
        }),
      ],
    }
    const { setups } = resultsView({ plan: plan(), constraints, part })
    expect(setups.map((each) => each.name)).toEqual(['Top', 'Top › Tilt'])
    expect(setups[1]!.fromFolder).toBe('t1')
  })

  it('lists each setup’s rows with their tools, marks, and what no pass cuts after them', () => {
    const [top] = resultsView({ plan: plan(), constraints: null, part }).setups
    expect(top!.rows.map((row) => [row.tag, row.tool, row.mark])).toEqual([
      ['a', 'Face mill, End mill', false],
      ['b', 'End mill', false],
      // Roughed by a pass but on the unmachined list: not finished.
      ['c', 'End mill', 'notFinished'],
      // Meant to be machined here and cut by nothing: listed after the rows, unmachined.
      ['d', null, 'notMachined'],
    ])
    expect(top!.rows[3]).toMatchObject({ label: 'Feature d', type: 'pocket' })
    expect(top!.orientations[0]!.directionIndex).toBe(0)
  })

  it('names nothing and leaves nothing out with no applied constraints to read the plan against', () => {
    const { setups, leftOut } = resultsView({
      plan: plan(),
      constraints: null,
      part,
    })
    expect(setups.map((each) => [each.name, each.fromFolder])).toEqual([
      ['Setup 1', null],
      ['Setup 2', null],
    ])
    expect(leftOut).toEqual([])
  })

  it('matches a frame against every orientation of a 3+2 setup: its tilt is not left out', () => {
    const stated = plan({
      setups: [plan().setups[0]!],
      setupPlan: {
        setups: [
          {
            orientations: [
              { direction: up, features: ['a'] },
              { direction: side, features: ['b'] },
            ],
          },
        ],
      },
    })
    const constraints = {
      setups: [
        setup({
          id: 'f1',
          name: 'Top',
          process: '3+2',
          folders: [{ id: 't1', name: 'Tilt', direction: side, features: [], folders: [] }],
        }),
      ],
    }
    const { setups, leftOut } = resultsView({ plan: stated, constraints, part })
    // Named by the first match: the setup's own frame.
    expect(setups.map((each) => [each.name, each.fromFolder])).toEqual([['Top', 'f1']])
    expect(leftOut).toEqual([])
  })

  it('lists a tag two orientations share once, under the first', () => {
    const stated = plan({
      setups: [plan().setups[0]!],
      setupPlan: {
        setups: [
          {
            orientations: [
              { direction: up, features: ['a', 'b'] },
              { direction: side, features: ['B', 'c'] },
            ],
          },
        ],
      },
    })
    const [only] = resultsView({ plan: stated, constraints: null, part }).setups
    expect(only!.rows.map((row) => row.tag)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('takes every direction of a 3+2 setup from the plan’s statement', () => {
    const stated = plan({
      setups: [plan().setups[0]!],
      setupPlan: {
        setups: [
          {
            orientations: [
              { direction: up, features: ['a'] },
              { direction: side, features: ['b'] },
            ],
          },
        ],
      },
    })
    const [only] = resultsView({ plan: stated, constraints: null, part }).setups
    expect(only!.orientations.map((o) => o.direction)).toEqual([up, side])
    expect(only!.process).toBe('3+2')
  })
})

describe('resultsView, with trimmed features', () => {
  // The part's report: a and b pockets, h a blind hole with its bore read.
  const reported: Record<string, string> = { a: 'pocket', b: 'pocket', h: 'blind_hole' }
  const bore = { diameter: 6, label: '⌀6 mm' }
  const reportPart: PlanPart = {
    ...part,
    featureType: (tag) => reported[tag.toLowerCase()],
    featureBore: (tag) => (tag.toLowerCase() === 'h' ? bore : undefined),
  }
  const cutting = (tags: Array<string>, trimmedFeatures: EnginePlan['trimmedFeatures']) =>
    plan({
      setups: [
        {
          idx: 0,
          direction: up,
          unmachined: [],
          actions: [{ idx: 0, toolName: 'End mill', featureTags: tags }],
        },
      ],
      trimmedFeatures,
    })
  const rowsCutting = (...args: Parameters<typeof cutting>) =>
    resultsView({ plan: cutting(...args), constraints: null, part: reportPart }).setups[0]!.rows
  // The plan cuts a' (a trimmed by an ignored face) and t (trimmed, its origin unsaid).
  const trimmedPlan = cutting(
    ["A'", 'b', 'T'],
    [
      trimmedFeature({ featureTag: "a'", regionIdxs: [1], fromFeatureTag: 'a' }),
      trimmedFeature({ featureTag: 't', featureType: 'open_pocket', regionIdxs: [2] }),
    ],
  )

  it('labels a trimmed row by its origin, else its type, and marks it trimmed', () => {
    const [only] = resultsView({ plan: trimmedPlan, constraints: null, part: reportPart }).setups
    expect(
      only!.rows.map(({ tag, label, type, trimmed }) => ({ tag, label, type, trimmed })),
    ).toEqual([
      { tag: "A'", label: 'Feature a (trimmed)', type: 'pocket', trimmed: true },
      { tag: 'b', label: 'Feature b', type: 'pocket', trimmed: undefined },
      { tag: 'T', label: 'Open pocket (trimmed)', type: 'open_pocket', trimmed: true },
    ])
  })

  it('reads a trimmed tag the report lists as the report’s feature, in its row and its faces', () => {
    const clash = [trimmedFeature({ featureTag: 'B', featureType: 'wall', regionIdxs: [2] })]
    expect(rowsCutting(['b'], clash)).toEqual([
      { tag: 'b', label: 'Feature b', type: 'pocket', tool: 'End mill', mark: false },
    ])
    const features = planFeaturesOf(
      [{ tag: 'b', featureType: 'pocket', regionIdxs: [1, 2] }],
      cutting(['b'], clash),
    )
    expect(features).toEqual([
      { tag: 'b', featureType: 'pocket', regionIdxs: [1, 2], fromFeatureTag: null },
    ])
    const regions = [1, 2, 3].map((idx) => ({ idx, area: 1 }))
    const { faces } = classifyFaces({ regions, features, machined: new Set(['b']) })
    expect(faces.machined.map((face) => face.region)).toEqual([1, 2])
  })

  it('takes its origin’s bore where the trimming kept its type, and none where it did not', () => {
    const [kept, changed] = rowsCutting(
      ["h'", 'h2'],
      [
        trimmedFeature({ featureTag: "h'", featureType: 'blind_hole', fromFeatureTag: 'h' }),
        trimmedFeature({ featureTag: 'h2', featureType: 'pocket', fromFeatureTag: 'h' }),
      ],
    )
    expect(kept).toMatchObject({ type: 'blind_hole', trimmed: true, bore })
    expect(changed).toMatchObject({ type: 'pocket', trimmed: true })
    expect(changed).not.toHaveProperty('bore')
  })

  it('pins its trimmed rows from the plan where they were planned, as the others', () => {
    let count = 0
    const { setups } = resultsView({ plan: trimmedPlan, constraints: null, part: reportPart })
    expect(planFromResults(setups, () => `id-${(count += 1)}`)).toEqual([
      { id: 'id-1', name: 'Folder 1', direction: up, features: ["A'", 'b', 'T'], folders: [] },
    ])
  })

  it('labels and marks a trimmed tag only the unmachined list names', () => {
    const left = plan({
      setups: [{ idx: 0, direction: up, unmachined: ["X'"], actions: [] }],
      trimmedFeatures: [
        trimmedFeature({
          featureTag: "x'",
          featureType: 'boss',
          regionIdxs: [3],
          fromFeatureTag: 'x',
        }),
      ],
    })
    const [only] = resultsView({ plan: left, constraints: null, part: reportPart }).setups
    expect(only!.notMachined).toEqual([
      { tag: "X'", label: 'Feature x (trimmed)', type: 'boss', trimmed: true },
    ])
    expect(only!.rows).toEqual([
      {
        tag: "X'",
        label: 'Feature x (trimmed)',
        type: 'boss',
        trimmed: true,
        tool: null,
        mark: 'notMachined',
      },
    ])
  })

  it('reads a plan without trimmed features as before', () => {
    const { setups, setupPlan } = plan()
    const views = planView({ setups, setupPlan, trimmedFeatures: [] }, part)
    // A plan read without the field at all lays out the same.
    expect(planView({ setups, setupPlan }, part)).toEqual(views)
    expect(views.flatMap(rowsOf).some((row) => 'trimmed' in row)).toBe(false)
    expect(resultsView({ plan: plan(), constraints: null, part }).setups[0]!.rows[0]).toEqual({
      tag: 'a',
      label: 'Feature a',
      type: 'pocket',
      tool: 'Face mill, End mill',
      mark: false,
    })
  })
})

describe('setupOf', () => {
  it('finds the setup that machines a feature, in any case, and none for one nothing cuts', () => {
    const { setups } = resultsView({ plan: plan(), constraints: null, part })
    expect(setupOf(setups, 'E')?.idx).toBe(1)
    expect(setupOf(setups, 'c')?.idx).toBe(0)
    expect(setupOf(setups, 'd')).toBeNull()
    expect(setupOf(setups, 'zz')).toBeNull()
  })
})
