import { describe, expect, it } from 'vitest'
import type { EnginePlan } from '../src/engine-plan'
import { planView, type PlanPart } from '../src/plan-view'

const part: PlanPart = {
  directionIndex: () => 0,
  featureLabel: (tag) => `Pocket ${tag}`,
}

const plan: EnginePlan = {
  planId: 'plan-1',
  jobId: null,
  level: 'planned',
  kernelVersion: null,
  issues: [],
  setups: [
    {
      idx: 3,
      direction: null,
      unmachined: ['c'],
      actions: [{ idx: 0, toolName: 'Flat', featureTags: ['a'] }],
    },
  ],
  setupPlan: null,
}

describe('planView, with no statement', () => {
  it('lists no direction for a setup served without one, its passes and what it left kept', () => {
    const [setup] = planView(plan, part)
    expect(setup).toMatchObject({
      id: 'setup-3',
      name: 'Setup 1',
      process: '3axis',
      orientations: [],
      notMachined: [{ tag: 'c', label: 'Pocket c' }],
      operations: 1,
    })
  })
})
