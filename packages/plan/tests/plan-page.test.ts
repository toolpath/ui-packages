import { describe, expect, it, vi } from 'vitest'

import type { EnginePlan } from '../src/engine-plan'
import { planPage, type PlanPageInputs, type PlanPagePart } from '../src/plan-page'
import type { Constraints } from '../src/plan-draft'
import { DONE_COLOR, PART_ROW, UNMACHINED_FACE_COLOR } from '../src/plan-view'

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }

const part = (): PlanPagePart => ({
  directionIndex: (direction) => (direction.z === 1 ? 0 : -1),
  featureLabel: (tag) => `Pocket ${tag}`,
  feature: vi.fn((tag: string) => ({ type: 'pocket', label: `Pocket ${tag}`, direction: up })),
})

/** One setup, Top, facing up, with `a` pinned in it, and face 3 ignored under kernel k1. */
const constraints: Constraints = {
  setups: [{ id: 's1', name: 'Top', direction: up, features: ['a'], folders: [] }],
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

/** Face 1 is `a`'s, face 2 is `b`'s, face 3 is no feature's. */
const analysis = {
  regions: [
    { idx: 1, area: 30 },
    { idx: 2, area: 20 },
    { idx: 3, area: 10 },
  ],
  features: [
    { tag: 'a', featureType: 'pocket', regionIdxs: [1] },
    { tag: 'b', featureType: 'pocket', regionIdxs: [2] },
  ],
}

const inputs = (overrides: Partial<PlanPageInputs> = {}): PlanPageInputs => ({
  draft: { ...constraints, kernelVersion: 'k1' },
  saved: constraints,
  plan,
  part: part(),
  analysis,
  kernel: 'k1',
  directions: { analyzed: [up], discovered: [up], pending: false },
  planIsOfSaved: true,
  changedSincePlan: false,
  ...overrides,
})

const regions = (faces: ReadonlyArray<{ region: number }> | undefined) =>
  faces?.map((face) => face.region)

describe('planPage: the constraints', () => {
  it('lays out the draft, and reads each face as pinned, ignored or open', () => {
    const { constraints: page } = planPage(inputs())
    expect(page.setups.map((setup) => setup.name)).toEqual(['Top'])
    expect(page.folders.map((folder) => folder.id)).toEqual(['s1'])
    expect(regions(page.coverage?.faces.pinned)).toEqual([1])
    expect(regions(page.coverage?.faces.open)).toEqual([2])
    expect(page.ignored).toEqual([3])
    expect(page.counts).toEqual({ pinned: 1, ignored: 1, open: 1 })
  })

  it('lets go of faces ignored under another kernel', () => {
    const { constraints: page } = planPage(inputs({ kernel: 'k2' }))
    expect(page.ignored).toEqual([])
    expect(page.counts.ignored).toBe(0)
  })

  it('checks a pin whose feature the part does not have', () => {
    const unknown = { ...part(), feature: () => null }
    expect(planPage(inputs({ part: unknown })).constraints.checks).toContainEqual(
      expect.objectContaining({ tone: 'blocking' }),
    )
  })
})

describe('planPage: the results', () => {
  it('names a setup by its folder while the plan is of the constraints as applied', () => {
    expect(planPage(inputs()).results.setups.map((setup) => setup.name)).toEqual(['Top'])
    expect(
      planPage(inputs({ planIsOfSaved: false })).results.setups.map((setup) => setup.name),
    ).toEqual(['Setup 1'])
  })

  it('reads each face as machined, ignored or not machined, and gathers the not machined', () => {
    const { results } = planPage(inputs())
    expect(regions(results.coverage?.faces.machined)).toEqual([1])
    expect(regions(results.coverage?.faces.notMachined)).toEqual([2])
    expect(results.notMachined.map((group) => group.tag)).toEqual(['b'])
    expect(results.counts).toEqual({ machined: 1, ignored: 1, notMachined: 1 })
    expect(results.planCounts).toEqual({ setups: 1, orientations: 1 })
  })

  it('is all clear when the plan machines every face of constraints that have not changed', () => {
    const whole = { regions: [analysis.regions[0]!], features: [analysis.features[0]!] }
    const { results } = planPage(inputs({ analysis: whole }))
    expect(results.changed).toBe(false)
    expect(results.allClear).toBe(true)
  })

  it('checks the folders of the constraints the plan is of, not a folder added since', () => {
    const added = { id: 's2', name: 'Side', direction: side, features: [], folders: [] }
    const draft = { ...constraints, setups: [...constraints.setups, added], kernelVersion: 'k1' }
    const { results } = planPage(inputs({ draft }))
    expect(results.confirm).not.toContainEqual(
      expect.objectContaining({ show: { kind: 'folder', setupId: 's2' } }),
    )
  })

  it('says the constraints changed since the results, and so is not all clear', () => {
    const { results } = planPage(inputs({ changedSincePlan: true }))
    expect(results.changed).toBe(true)
    expect(results.allClear).toBe(false)
  })
})

describe('planPage: before anything is read', () => {
  it('shows nothing, and classifies no face', () => {
    const page = planPage(
      inputs({ draft: null, saved: null, plan: null, analysis: null, planIsOfSaved: false }),
    )
    expect(page.constraints.setups).toEqual([])
    expect(page.constraints.coverage).toBeNull()
    expect(page.constraints.checks).toEqual([])
    expect(page.results.setups).toEqual([])
    expect(page.results.coverage).toBeNull()
    expect(page.results.changed).toBe(false)
    expect(page.find.pinOf('a')).toBeNull()
    expect(page.paint({ tab: 'results', openId: PART_ROW, colorOf: () => 0 })).toEqual({
      faces: [],
      hatches: [],
    })
  })
})

describe('planPage: find', () => {
  const { find } = planPage(inputs())

  it('looks up a folder, its path and a pin', () => {
    expect(find.folder('s1')?.folder.name).toBe('Top')
    expect(find.path('s1')).toBe('Top')
    expect(find.pinOf('A')).toEqual({ folderId: 's1', tag: 'a' })
  })

  it('finds where a pin from a direction goes, or null where pinning adds a setup', () => {
    expect(find.pinTarget(up)).toBe('s1')
    expect(find.pinTarget(side)).toBeNull()
  })

  it('says which folder or setup of the plan holds a feature', () => {
    expect(find.holds('s1', 'a')).toBe(true)
    expect(find.holds('s1', 'b')).toBe(false)
    expect(find.holds(0, 'a')).toBe(true)
    expect(find.resultSetup('A')?.idx).toBe(0)
  })
})

describe('planPage: paint', () => {
  const page = planPage(inputs())
  const colorOf = () => 0xff0000

  it('paints the constraints: pins in their folder’s colour, ignored faces slate', () => {
    const { faces } = page.paint({ tab: 'constraints', openId: PART_ROW, colorOf })
    expect(faces).toContainEqual(expect.objectContaining({ region: 1, color: 0xff0000 }))
    expect(faces).toContainEqual(expect.objectContaining({ region: 3, color: DONE_COLOR }))
  })

  it('paints the results: what nothing machines red, unless the app paints there', () => {
    const red = expect.objectContaining({ region: 2, color: UNMACHINED_FACE_COLOR })
    expect(page.paint({ tab: 'results', openId: PART_ROW, colorOf }).faces).toContainEqual(red)
    expect(
      page.paint({ tab: 'results', openId: PART_ROW, colorOf, uncovered: false }).faces,
    ).not.toContainEqual(red)
  })
})

describe('planPage: work done', () => {
  it('works a part out only when it is read, and only once', () => {
    const checked = part()
    const page = planPage(inputs({ part: checked }))
    expect(page.constraints.setups).toHaveLength(1)
    expect(checked.feature).not.toHaveBeenCalled()
    const checks = page.constraints.checks
    const calls = vi.mocked(checked.feature).mock.calls.length
    expect(calls).toBeGreaterThan(0)
    expect(page.constraints.checks).toBe(checks)
    expect(checked.feature).toHaveBeenCalledTimes(calls)
  })
})
