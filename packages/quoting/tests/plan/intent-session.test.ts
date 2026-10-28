import { planSession, startSession, type SessionEvent } from '@toolpath/plan'
import { describe, expect, it } from 'vitest'

import {
  intentOf,
  intentSessionRules,
  quotingPlan,
  rebaseIntent,
  sameIntent,
  type Intent,
  type IntentRules,
  type PlanDraft,
} from '../../src/plan'

const up = { x: 0, y: 0, z: 1 }

const applied: Intent = {
  setups: [],
  done: [],
  doneKernel: null,
  inputs: {
    materialId: null,
    machineProfileId: null,
    toolCrib: [],
    stock: { policy: null, profileId: null },
    dfmRuleSetIds: [],
  },
}

const box = {
  mode: 'fixedBox' as const,
  dimensions: { x: 50, y: 40, z: 20 },
  position: 'offsetFromTop' as const,
}

const rules = intentSessionRules({ regionsOf: () => [], kernel: 'k1' })

const withInputs = (inputs: Partial<Intent['inputs']>): SessionEvent<Intent> => ({
  type: 'edit',
  change: (intent) => ({ inputs: { ...intent.inputs, ...inputs } }),
})

describe('the quoting app’s session rules', () => {
  it('leaves the save stamps out of the intent', () => {
    const draft = { ...applied, kernelVersion: 'k1', editedAt: 'now', version: 4, changed: true }
    expect(intentOf(draft)).toEqual(applied)
  })

  it('reads a stock with its keys in another order as the same', () => {
    const reordered = {
      position: box.position,
      dimensions: { z: 20, y: 40, x: 50 },
      mode: box.mode,
    }
    const a = { ...applied, inputs: { ...applied.inputs, stock: { policy: box, profileId: null } } }
    const b = {
      ...applied,
      inputs: { ...applied.inputs, stock: { policy: reordered, profileId: null } },
    }
    expect(sameIntent(a, b)).toBe(true)
    expect(sameIntent(a, applied)).toBe(false)
  })

  it('reads the same DFM rule sets in another order as the same', () => {
    const sets = (dfmRuleSetIds: Array<string>) => ({
      ...applied,
      inputs: { ...applied.inputs, dfmRuleSetIds },
    })
    expect(sameIntent(sets(['a', 'b']), sets(['b', 'a']))).toBe(true)
    expect(sameIntent(sets(['a']), sets(['a', 'b']))).toBe(false)
  })

  it('keeps DFM rule sets chosen here over another tab’s, and takes its others', () => {
    const held = { ...applied, inputs: { ...applied.inputs, dfmRuleSetIds: ['mine'] } }
    const now = { ...applied, inputs: { ...applied.inputs, dfmRuleSetIds: ['theirs'] } }
    expect(rebaseIntent(held, applied, now).inputs.dfmRuleSetIds).toEqual(['mine'])
    expect(rebaseIntent(applied, applied, now).inputs.dfmRuleSetIds).toEqual(['theirs'])
  })

  it('takes another tab’s inputs under held edits that did not change them', () => {
    const held = {
      ...applied,
      inputs: { ...applied.inputs, stock: { policy: box, profileId: null } },
    }
    const now = {
      ...applied,
      inputs: {
        ...applied.inputs,
        machineProfileId: 'lathe',
        stock: { policy: null, profileId: 'flat' },
      },
    }
    expect(rebaseIntent(held, applied, now).inputs).toEqual({
      ...applied.inputs,
      machineProfileId: 'lathe',
      stock: { policy: box, profileId: null },
    })
  })

  it('holds the inputs in one history with the constraints', () => {
    const events: Array<SessionEvent<Intent>> = [
      withInputs({ machineProfileId: 'mill' }),
      { type: 'act', action: { kind: 'addSetup', direction: up, id: 'top' } },
      { type: 'undo' },
    ]
    const session = events.reduce(
      (now, event) => planSession(now, event, rules),
      startSession(applied),
    )
    expect(session.draft.setups).toEqual([])
    expect(session.draft.inputs.machineProfileId).toBe('mill')
  })

  it('keeps the inputs edited here when the plan is read again, through the session', () => {
    const now: Intent = {
      ...applied,
      done: [4],
      doneKernel: 'k1',
      inputs: { ...applied.inputs, materialId: 'steel', machineProfileId: 'lathe' },
    }
    const events: Array<SessionEvent<Intent>> = [
      withInputs({ machineProfileId: 'mill' }),
      { type: 'read', saved: now },
    ]
    const session = events.reduce(
      (at, event) => planSession(at, event, rules),
      startSession(applied),
    )
    expect(session.draft.inputs).toMatchObject({ materialId: 'steel', machineProfileId: 'mill' })
    expect(session.draft.done).toEqual([])
  })
})

describe('the quoting app’s session', () => {
  const part: IntentRules = { regionsOf: () => [], kernel: 'k1' }

  const saved = (version: number, intent: Intent = applied): PlanDraft => ({
    ...intent,
    kernelVersion: 'k1',
    editedAt: 'then',
    version,
    changed: false,
  })

  const withRuleSets = (dfmRuleSetIds: Array<string>): Intent => ({
    ...applied,
    inputs: { ...applied.inputs, dfmRuleSetIds },
  })

  it('starts on the plan as saved, its stamps left out and its version kept', () => {
    const session = quotingPlan.start(saved(3))
    expect(session.saved).toEqual(applied)
    expect(session.version).toBe(3)
    expect(quotingPlan.hasEdits(session)).toBe(false)
  })

  it('starts with the edits kept from before a reload', () => {
    const kept = withRuleSets(['mine'])
    expect(quotingPlan.start(saved(3), kept).draft).toBe(kept)
  })

  it('holds no edits when only the order of the DFM rule sets differs', () => {
    const session = quotingPlan.start(saved(1, withRuleSets(['a', 'b'])), withRuleSets(['b', 'a']))
    expect(quotingPlan.hasEdits(session)).toBe(false)
  })

  it('changes nothing while the plan is locked', () => {
    const session = quotingPlan.start(saved(1))
    const next = quotingPlan.update(session, withInputs({ materialId: 'steel' }), {
      ...part,
      locked: true,
    })
    expect(next).toBe(session)
  })

  it('keeps the inputs edited here when the plan is read again', () => {
    const now = { ...applied, inputs: { ...applied.inputs, machineProfileId: 'lathe' } }
    const edited = quotingPlan.update(
      quotingPlan.start(saved(1)),
      withInputs({ materialId: 'steel' }),
      part,
    )
    const read = quotingPlan.update(edited, quotingPlan.read(saved(2, now)), part)
    expect(read.draft.inputs).toMatchObject({ materialId: 'steel', machineProfileId: 'lathe' })
    expect(read.version).toBe(2)
  })

  it('takes an Apply as the plan as applied, even while the plan is locked', () => {
    const edited = quotingPlan.update(
      quotingPlan.start(saved(1)),
      withInputs({ materialId: 'steel' }),
      part,
    )
    const applied = quotingPlan.update(
      edited,
      { type: 'applied', sent: edited.draft },
      { ...part, locked: true },
    )
    expect(quotingPlan.hasEdits(applied)).toBe(false)
  })

  it('takes an edit back with Undo', () => {
    const edited = quotingPlan.update(
      quotingPlan.start(saved(1)),
      withInputs({ materialId: 'steel' }),
      part,
    )
    expect(quotingPlan.hasEdits(quotingPlan.update(edited, { type: 'undo' }, part))).toBe(false)
  })

  it('does not take a plan older than the one it has', () => {
    const session = quotingPlan.start(saved(4))
    const read = quotingPlan.update(
      session,
      quotingPlan.read(saved(3, withRuleSets(['old']))),
      part,
    )
    expect(read.saved).toEqual(applied)
  })
})
