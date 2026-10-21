import { planSession, startSession, type SessionEvent } from '@toolpath/plan'
import { describe, expect, it } from 'vitest'

import { intentOf, intentSessionRules, rebaseIntent, sameIntent, type Intent } from '../../src/plan'

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
