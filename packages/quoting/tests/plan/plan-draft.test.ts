import { applyDraftAction, type PlanRules } from '@toolpath/plan'
import { describe, expect, it } from 'vitest'

import type { PlanDraft } from '../../src/plan'

const up = { x: 0, y: 0, z: 1 }

const rules: PlanRules = { regionsOf: () => [], kernel: '0.17.0' }

const saved: PlanDraft = {
  setups: [],
  done: [],
  doneKernel: null,
  kernelVersion: null,
  editedAt: '2026-10-21T12:00:00.000Z',
  version: 3,
  changed: false,
  inputs: {
    materialId: 'aluminum-6061',
    machineProfileId: 'vf2',
    toolCrib: [],
    stock: { policy: null, profileId: null },
  },
}

describe('the quoting draft in plan mode', () => {
  it('takes an edit as the constraints it holds, and keeps the app fields as they were', () => {
    const result = applyDraftAction(saved, { kind: 'addSetup', direction: up, id: 'top' }, rules)
    if ('refused' in result) {
      throw new Error(result.refused)
    }
    // The answer is the app's draft type, not the bare constraints: no cast is needed to keep it.
    // `pnpm check-types` checks this line, because the tests are in the tsconfig; vitest does not.
    const draft: PlanDraft = result.draft
    expect(draft.setups.map((setup) => setup.id)).toEqual(['top'])
    expect({ ...draft, setups: saved.setups }).toEqual(saved)
  })
})
