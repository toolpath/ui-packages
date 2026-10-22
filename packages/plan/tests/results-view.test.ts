import { describe, expect, it } from 'vitest'
import type { EnginePlan } from '../src/engine-plan'
import type { DraftSetup } from '../src/plan-draft'
import type { PlanPart } from '../src/plan-view'
import { resultsView, setupOf } from '../src/results-view'

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

describe('setupOf', () => {
  it('finds the setup that machines a feature, in any case, and none for one nothing cuts', () => {
    const { setups } = resultsView({ plan: plan(), constraints: null, part })
    expect(setupOf(setups, 'E')?.idx).toBe(1)
    expect(setupOf(setups, 'c')?.idx).toBe(0)
    expect(setupOf(setups, 'd')).toBeNull()
    expect(setupOf(setups, 'zz')).toBeNull()
  })
})
