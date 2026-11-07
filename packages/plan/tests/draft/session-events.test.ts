import { describe, expect, it } from 'vitest'
import type { Constraints } from '../../src/draft/constraints'
import {
  nextSession,
  startSession,
  type SessionEvent,
  type SessionRules,
} from '../../src/draft/session'

const applied: Constraints = { setups: [], done: [], doneKernel: null }

const rules: SessionRules<Constraints> = { regionsOf: () => [], kernel: 'k1' }

const refusedAct: SessionEvent<Constraints> = {
  type: 'action',
  action: { kind: 'renameGroup', id: 'gone', name: 'Top' },
}

describe('nextSession, an event type not on the list', () => {
  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__'])(
    'changes no draft for %s, a name every object inherits, and clears the last notes',
    (type) => {
      const refused = nextSession(startSession(applied), refusedAct, rules)
      expect(refused.refused).not.toBeNull()
      const next = nextSession(refused, { type } as unknown as SessionEvent<Constraints>, rules)
      expect(next).toEqual({ ...refused, refused: null })
      expect(next.draft).toBe(refused.draft)
    },
  )
})
