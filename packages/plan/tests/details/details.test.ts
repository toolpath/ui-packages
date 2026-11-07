import { describe, expect, it, vi } from 'vitest'

import type { EnginePlan } from '../../src/results/plan'
import {
  planDetails,
  type PartAnalysis,
  type PlanDetailsInputs,
  type PlanDetailsPart,
} from '../../src/details/details'
import type { Constraints } from '../../src/draft/constraints'
import { trimmedFeature } from '../trimmed-feature'

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }

const part = (): PlanDetailsPart => ({
  directionIndex: (direction) => (direction.z === 1 ? 0 : -1),
  featureLabel: (tag) => `Pocket ${tag}`,
  feature: vi.fn((tag: string) => ({ type: 'pocket', label: `Pocket ${tag}`, direction: up })),
})

/** One setup, Top, facing up, with `a` assigned in it, and face 3 done under kernel k1. */
const constraints: Constraints = {
  setups: [{ id: 's1', name: 'Top', direction: up, features: ['a'], groups: [] }],
  done: [3],
  doneKernel: 'k1',
}

/** Toolpath's plan: one setup facing up, cutting `a`. */
const plan: EnginePlan = {
  planId: 'plan-1',
  jobId: null,
  level: 'toolpathed',
  kernelVersion: 'k1',
  issues: [],
  setups: [
    {
      idx: 0,
      direction: up,
      unmachined: [],
      actions: [{ idx: 0, toolName: 'Flat', featureTags: ['a'] }],
    },
  ],
  setupPlan: null,
  trimmedFeatures: [],
}

/** Face 1 is `a`'s, face 2 is `b`'s, face 3 is no feature's. Read by kernel k1, facing up. */
const analysis: PartAnalysis = {
  regions: [
    { idx: 1, area: 30 },
    { idx: 2, area: 20 },
    { idx: 3, area: 10 },
  ],
  features: [
    { tag: 'a', featureType: 'pocket', regionIdxs: [1] },
    { tag: 'b', featureType: 'pocket', regionIdxs: [2] },
  ],
  kernelVersion: 'k1',
  directions: { analyzed: [up], discovered: [up, side], pending: false },
}

const inputs = (overrides: Partial<PlanDetailsInputs> = {}): PlanDetailsInputs => ({
  draft: { ...constraints, kernelVersion: 'k1' },
  saved: { ...constraints, changed: false },
  plan,
  part: part(),
  analysis,
  planIsOfSaved: true,
  ...overrides,
})

const regions = (faces: ReadonlyArray<{ region: number }> | undefined) =>
  faces?.map((face) => face.region)

describe('planDetails: the constraints', () => {
  it('lays out the draft, and reads each face as assigned, done or open', () => {
    const { constraints } = planDetails(inputs())
    expect(constraints.setups.map((setup) => setup.name)).toEqual(['Top'])
    expect(constraints.groups.map((group) => group.id)).toEqual(['s1'])
    expect(regions(constraints.coverage?.faces.assigned)).toEqual([1])
    expect(regions(constraints.coverage?.faces.open)).toEqual([2])
    expect(constraints.done).toEqual([3])
    expect(constraints.counts).toEqual({ assigned: 1, done: 1, open: 1 })
  })

  it('gives the features assigned, by tag in lower case, in every group', () => {
    const nested = {
      ...constraints,
      setups: [
        {
          ...constraints.setups[0]!,
          features: [],
          groups: [{ id: 'g1', name: 'Wall', features: ['A', 'b'], groups: [] }],
        },
      ],
      kernelVersion: 'k1',
    }
    expect([...planDetails(inputs({ draft: nested })).constraints.assigned]).toEqual(['a', 'b'])
    expect(planDetails(inputs({ draft: null })).constraints.assigned.size).toBe(0)
  })

  it('lets go of faces done under another kernel', () => {
    const { constraints } = planDetails(inputs({ analysis: { ...analysis, kernelVersion: 'k2' } }))
    expect(constraints.done).toEqual([])
    expect(constraints.counts.done).toBe(0)
  })

  it('checks an assignment whose feature the part does not have', () => {
    const unknown = { ...part(), feature: () => null }
    expect(planDetails(inputs({ part: unknown })).constraints.checks).toContainEqual(
      expect.objectContaining({ severity: 'blocking' }),
    )
  })

  it('says nothing of an assignment’s feature before the analysis is read', () => {
    const unknown = { ...part(), feature: () => null }
    expect(planDetails(inputs({ part: unknown, analysis: null })).constraints.checks).toEqual([])
  })
})

describe('planDetails: the results', () => {
  it('names a setup by its group while the plan is of the constraints as applied', () => {
    expect(planDetails(inputs()).results.setups.map((setup) => setup.name)).toEqual(['Top'])
    expect(
      planDetails(inputs({ planIsOfSaved: false })).results.setups.map((setup) => setup.name),
    ).toEqual(['Setup 1'])
  })

  it('reads each face as machined, done or not machined, and gathers the not machined', () => {
    const { results } = planDetails(inputs())
    expect(regions(results.coverage?.faces.machined)).toEqual([1])
    expect(regions(results.coverage?.faces.notMachined)).toEqual([2])
    expect(results.notMachined.map((group) => group.tag)).toEqual(['b'])
    expect(results.counts).toEqual({ machined: 1, done: 1, notMachined: 1 })
    expect(results.planCounts).toEqual({ setups: 1, orientations: 1 })
  })

  it('gives every feature the plan’s actions cut, by tag in lower case', () => {
    const cuts = {
      ...plan,
      setups: [
        plan.setups[0]!,
        {
          idx: 1,
          direction: side,
          unmachined: [],
          actions: [{ idx: 0, toolName: 'Drill', featureTags: ['C', 'a'] }],
        },
      ],
    }
    expect([...planDetails(inputs({ plan: cuts })).results.machined]).toEqual(['a', 'c'])
    expect(planDetails(inputs({ plan: null })).results.machined.size).toBe(0)
  })

  it('is all clear when the plan machines every face of constraints that have not changed', () => {
    const whole = {
      ...analysis,
      regions: [analysis.regions[0]!],
      features: [analysis.features[0]!],
    }
    const { results } = planDetails(inputs({ analysis: whole }))
    expect(results.changed).toBe(false)
    expect(results.allClear).toBe(true)
  })

  it('checks the groups of the constraints the plan is of, not a group added since', () => {
    const added = { id: 's2', name: 'Side', direction: side, features: [], groups: [] }
    const draft = { ...constraints, setups: [...constraints.setups, added], kernelVersion: 'k1' }
    const { results } = planDetails(inputs({ draft }))
    expect(results.confirm).not.toContainEqual(
      expect.objectContaining({ show: { kind: 'group', setupId: 's2' } }),
    )
  })

  it('says the constraints changed since the results, and so is not all clear', () => {
    const { results } = planDetails(inputs({ saved: { ...constraints, changed: true } }))
    expect(results.changed).toBe(true)
    expect(results.allClear).toBe(false)
  })
})

describe('planDetails: the confirm checklist', () => {
  /** Only face 1, `a`'s: the plan machines every face of it. */
  const whole: PartAnalysis = {
    ...analysis,
    regions: [analysis.regions[0]!],
    features: [analysis.features[0]!],
    directions: { analyzed: [up, side], discovered: [up, side], pending: false },
  }
  const emptyGroups = (setupId: string, count = 1) => ({
    kind: 'emptyGroups',
    severity: 'warning',
    count,
    show: { kind: 'group', setupId },
  })
  /** Top, cutting `a`, and Side, which nothing is assigned in and the plan has no setup for. */
  const withSide: Constraints = {
    ...constraints,
    setups: [
      ...constraints.setups,
      { id: 's2', name: 'Side', direction: side, features: [], groups: [] },
    ],
  }
  const of = (stated: Constraints, overrides: Partial<PlanDetailsInputs> = {}) =>
    planDetails(
      inputs({
        draft: { ...stated, kernelVersion: 'k1' },
        saved: { ...stated, changed: false },
        analysis: whole,
        ...overrides,
      }),
    ).results

  it('is all clear where every frame of the constraints is machined', () => {
    const results = of(constraints)
    expect(results.confirm).toEqual([
      { kind: 'allMachined', severity: 'ok' },
      { kind: 'allCut', severity: 'ok' },
    ])
    expect(results.allClear).toBe(true)
  })

  it('warns of a frame the plan machines nothing in', () => {
    const results = of(withSide)
    expect(results.confirm).toContainEqual(emptyGroups('s2'))
    expect(results.confirm).not.toContainEqual(
      expect.objectContaining({ show: emptyGroups('s1').show }),
    )
    expect(results.allClear).toBe(false)
  })

  it('reads a frame as machined where the plan machines something in a frame inside it', () => {
    const tilted: Constraints = {
      setups: [
        {
          id: 's1',
          name: 'Top',
          direction: up,
          process: '3+2',
          features: [],
          groups: [{ id: 'tilt', name: 'Tilt', direction: side, features: ['a'], groups: [] }],
        },
      ],
      done: [],
      doneKernel: null,
    }
    const fromSide = {
      ...part(),
      feature: () => ({ type: 'pocket', label: 'Pocket', direction: side }),
    }
    const sidePlan: EnginePlan = {
      ...plan,
      setups: [{ ...plan.setups[0]!, direction: side }],
    }
    const results = of(tilted, { plan: sidePlan, part: fromSide })
    expect(results.setups.map((setup) => setup.fromGroup)).toEqual(['tilt'])
    expect(results.confirm).not.toContainEqual(expect.objectContaining({ kind: 'emptyGroups' }))
    expect(results.allClear).toBe(true)
  })

  it('reads a frame whose setup has no rows as machining nothing', () => {
    const idle: EnginePlan = { ...plan, setups: [{ ...plan.setups[0]!, actions: [] }] }
    const results = of(constraints, { plan: idle })
    expect(results.setups.map((setup) => [setup.fromGroup, setup.rows.length])).toEqual([['s1', 0]])
    expect(results.confirm).toContainEqual(emptyGroups('s1'))
    expect(results.allClear).toBe(false)
  })

  it('checks no frame where the plan is not of the constraints as applied', () => {
    const results = of(withSide, { planIsOfSaved: false })
    expect(results.confirm).not.toContainEqual(expect.objectContaining({ kind: 'emptyGroups' }))
    expect(results.allClear).toBe(true)
  })

  it('says nothing of what is machined before the analysis is read', () => {
    const results = of(constraints, { analysis: null })
    expect(results.confirm).toEqual([{ kind: 'allCut', severity: 'ok' }])
    expect(results.allClear).toBe(true)
  })

  it('warns where Toolpath planned with another kernel than the assignments name', () => {
    const results = of(constraints, { plan: { ...plan, kernelVersion: 'k2' } })
    expect(results.confirm).toContainEqual({ kind: 'kernelMoved', severity: 'warning' })
    expect(results.allClear).toBe(false)
  })
})

describe('planDetails: trimmed features', () => {
  // The plan cuts `a` and `t`, trimmed from `b`, which holds b's face 2. `u`, trimmed too, holds
  // face 3, and no pass cuts it. The draft assigns `a` and `t`, not `u`.
  const trimmedPlan: EnginePlan = {
    ...plan,
    setups: [
      { ...plan.setups[0]!, actions: [{ idx: 0, toolName: 'Flat', featureTags: ['a', 't'] }] },
    ],
    trimmedFeatures: [
      trimmedFeature({ featureTag: 't', regionIdxs: [2], fromFeatureTag: 'b' }),
      trimmedFeature({ featureTag: 'u', regionIdxs: [3] }),
    ],
  }
  const assigning: Constraints = {
    setups: [{ id: 's1', name: 'Top', direction: up, features: ['a', 't'], groups: [] }],
    done: [],
    doneKernel: null,
  }
  const details = () =>
    planDetails(
      inputs({
        draft: { ...assigning, kernelVersion: 'k1' },
        saved: { ...assigning, changed: false },
        plan: trimmedPlan,
      }),
    )

  it('lists an assigned trimmed feature as the plan names it', () => {
    expect(details().constraints.setups[0]?.orientations[0]?.features).toEqual([
      { tag: 'a', label: 'Pocket a', type: undefined },
      { tag: 't', label: 'Pocket b (trimmed)', type: 'pocket', trimmed: true },
    ])
  })

  it('reads an assigned trimmed feature’s faces as assigned, and an unassigned one’s as no one’s', () => {
    const { constraints } = details()
    expect(regions(constraints.coverage?.faces.assigned)).toEqual([1, 2])
    expect(regions(constraints.coverage?.faces.open)).toEqual([3])
    expect(constraints.coverage?.faces.open[0]?.owners).toEqual([])
    expect(constraints.counts).toEqual({ assigned: 2, done: 0, open: 1 })
  })

  it('reads the faces a trimmed feature the plan cuts owns as machined, and one it does not as not', () => {
    const { results } = details()
    expect(regions(results.coverage?.faces.machined)).toEqual([1, 2])
    expect(regions(results.coverage?.faces.notMachined)).toEqual([3])
    expect(results.notMachined.map((group) => group.tag)).toEqual(['u'])
    expect(results.counts).toEqual({ machined: 2, done: 0, notMachined: 1 })
  })
})

describe('planDetails: before anything is read', () => {
  it('shows nothing, and classifies no face', () => {
    const details = planDetails(
      inputs({ draft: null, saved: null, plan: null, analysis: null, planIsOfSaved: false }),
    )
    expect(details.constraints.setups).toEqual([])
    expect(details.constraints.coverage).toBeNull()
    expect(details.constraints.checks).toEqual([])
    expect(details.results.setups).toEqual([])
    expect(details.results.coverage).toBeNull()
    expect(details.results.changed).toBe(false)
    expect(details.find.assignmentOf('a')).toBeNull()
    expect(details.faces({ tab: 'results', openId: null })).toEqual({ faces: [], shared: [] })
  })
})

describe('planDetails: find', () => {
  const { find } = planDetails(inputs())

  it('looks up a group, its path and an assignment', () => {
    expect(find.group('s1')?.group.name).toBe('Top')
    expect(find.path('s1')).toBe('Top')
    expect(find.assignmentOf('A')).toEqual({ groupId: 's1', tag: 'a' })
  })

  it('finds where an assignment from a direction goes, or null where assigning adds a setup', () => {
    expect(find.assignTarget(up)).toBe('s1')
    expect(find.assignTarget(side)).toBeNull()
  })

  it('says which group or setup of the plan holds a feature', () => {
    expect(find.holds('s1', 'a')).toBe(true)
    expect(find.holds('s1', 'b')).toBe(false)
    expect(find.holds(0, 'a')).toBe(true)
    expect(find.resultSetup('A')?.idx).toBe(0)
  })
})

describe('planDetails: faces', () => {
  const details = planDetails(inputs())

  it('shows the constraints: assignments in their group’s direction, done faces done', () => {
    const { faces } = details.faces({ tab: 'constraints', openId: null })
    expect(faces).toContainEqual(
      expect.objectContaining({ region: 1, kind: 'direction', direction: up }),
    )
    expect(faces).toContainEqual({ region: 3, kind: 'done' })
  })

  it('shows the results: what nothing machines, unless the app shows something else there', () => {
    const notMachined = { region: 2, kind: 'notMachined' }
    expect(details.faces({ tab: 'results', openId: null }).faces).toContainEqual(notMachined)
    expect(
      details.faces({ tab: 'results', openId: null, uncovered: false }).faces,
    ).not.toContainEqual(notMachined)
  })
})

describe('planDetails: work done', () => {
  it('works a part out only when it is read, and only once', () => {
    const checked = part()
    const details = planDetails(inputs({ part: checked }))
    expect(details.constraints.setups).toHaveLength(1)
    expect(checked.feature).not.toHaveBeenCalled()
    const checks = details.constraints.checks
    const calls = vi.mocked(checked.feature).mock.calls.length
    expect(calls).toBeGreaterThan(0)
    expect(details.constraints.checks).toBe(checks)
    expect(checked.feature).toHaveBeenCalledTimes(calls)
  })

  it('gives the same value each time a part is read', () => {
    const details = planDetails(inputs())
    expect(details.results.planCounts).toBe(details.results.planCounts)
    expect(details.results.counts).toBe(details.results.counts)
    expect(details.constraints.counts).toBe(details.constraints.counts)
  })
})
