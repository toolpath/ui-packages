import { describe, expect, it } from 'vitest'
import type { Constraints } from '../src/plan-draft'
import {
  planSession,
  startSession,
  type SessionEvent,
  type SessionRules,
} from '../src/plan-session'

const applied: Constraints = { setups: [], done: [], doneKernel: null }

const rules: SessionRules<Constraints> = { regionsOf: () => [], kernel: 'k1' }

const refusedAct: SessionEvent<Constraints> = {
  type: 'act',
  action: { kind: 'renameFolder', id: 'gone', name: 'Top' },
}

describe('planSession, an event type not on the list', () => {
  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__'])(
    'changes no draft for %s, a name every object inherits, and clears the last notes',
    (type) => {
      const refused = planSession(startSession(applied), refusedAct, rules)
      expect(refused.refused).not.toBeNull()
      const next = planSession(refused, { type } as unknown as SessionEvent<Constraints>, rules)
      expect(next).toEqual({ ...refused, refused: null })
      expect(next.draft).toBe(refused.draft)
    },
  )
})
