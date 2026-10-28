import type { EnginePlan, PartAnalysis, PlanDetailsPart } from '@toolpath/plan'
import { describe, expect, it } from 'vitest'

import {
  intentOf,
  quotingPlanDetails,
  quotingPlan,
  type Intent,
  type PlanDraft,
  type QuotingPlanDetailsInputs,
} from '../../src/plan'

const up = { x: 0, y: 0, z: 1 }
const side = { x: 1, y: 0, z: 0 }

const part: PlanDetailsPart = {
  directionIndex: (direction) => (direction.z === 1 ? 0 : -1),
  featureLabel: (tag) => `Pocket ${tag}`,
  feature: (tag) => ({ type: 'pocket', label: `Pocket ${tag}`, direction: up }),
}

/** The plan as saved: one setup, Top, facing up, with `a` pinned in it by kernel k1. */
const saved: PlanDraft = {
  setups: [{ id: 's1', name: 'Top', direction: up, features: ['a'], folders: [] }],
  done: [],
  doneKernel: null,
  kernelVersion: 'k1',
  editedAt: '2026-10-01T00:00:00Z',
  version: 3,
  changed: false,
  inputs: {
    materialId: null,
    machineProfileId: null,
    toolCrib: [],
    stock: { policy: null, profileId: null },
    dfmRuleSetIds: [],
  },
}

/** Toolpath's plan, by kernel k1: one setup facing up, cutting `a`. */
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

const analysis: PartAnalysis = {
  regions: [{ idx: 1, area: 30 }],
  features: [{ tag: 'a', featureType: 'pocket', regionIdxs: [1] }],
  kernelVersion: 'k1',
  directions: { analyzed: [up], discovered: [up, side], pending: false },
}

/** The same plan with a Side setup added: an edit held and not applied. */
const edited: Intent = {
  ...intentOf(saved),
  setups: [...saved.setups, { id: 's2', name: 'Side', direction: side, features: [], folders: [] }],
}

const inputs = (
  overrides: Partial<QuotingPlanDetailsInputs> = {},
  held: Intent | null = null,
): QuotingPlanDetailsInputs => ({
  loaded: { saved, session: quotingPlan.start(saved, held) },
  plan,
  planSettled: true,
  part,
  analysis,
  ...overrides,
})

const resultNames = (details: ReturnType<typeof quotingPlanDetails>) =>
  details.results.setups.map((setup) => setup.name)

describe('quotingPlanDetails', () => {
  it('shows the edits held over the plan as saved', () => {
    const details = quotingPlanDetails(inputs({}, edited))
    expect(details.constraints.setups.map((setup) => setup.name)).toEqual(['Top', 'Side'])
  })

  it('names Toolpath’s setups by their folders while the plan is of the plan as saved', () => {
    expect(resultNames(quotingPlanDetails(inputs()))).toEqual(['Top'])
  })

  it('does not name them by folder while edits are held', () => {
    expect(resultNames(quotingPlanDetails(inputs({}, edited)))).toEqual(['Setup 1'])
  })

  it('does not name them by folder while a newer plan is on its way', () => {
    expect(resultNames(quotingPlanDetails(inputs({ planSettled: false })))).toEqual(['Setup 1'])
  })

  it('says the results are out of date when the plan as saved changed since', () => {
    const loaded = { saved: { ...saved, changed: true }, session: quotingPlan.start(saved) }
    const details = quotingPlanDetails(inputs({ loaded }))
    expect(details.results.changed).toBe(true)
    expect(resultNames(details)).toEqual(['Setup 1'])
  })

  it('warns when the pins are named by a kernel other than the plan’s', () => {
    const loaded = {
      saved: { ...saved, kernelVersion: 'k0' },
      session: quotingPlan.start(saved),
    }
    expect(quotingPlanDetails(inputs({ loaded })).constraints.checks).toContainEqual(
      expect.objectContaining({ tone: 'warning', text: expect.stringContaining('updated since') }),
    )
  })

  it('shows nothing before the plan as saved is read', () => {
    const details = quotingPlanDetails(inputs({ loaded: null }))
    expect(details.constraints.setups).toEqual([])
    expect(resultNames(details)).toEqual(['Setup 1'])
  })
})
