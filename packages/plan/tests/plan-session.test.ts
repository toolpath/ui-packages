import { describe, expect, it } from 'vitest'
import type { Constraints, DraftSetup } from '../src/plan-draft'
import {
  canRedo,
  canUndo,
  HISTORY,
  isHeld,
  planSession,
  startSession,
  type PlanSession,
  type SessionEvent,
  type SessionRules,
} from '../src/plan-session'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

/** An app's draft: the constraints, and a field of its own held with them. */
interface Draft extends Constraints {
  machine: string | null
  stock: number | null
}

const applied: Draft = { setups: [], done: [], doneKernel: null, machine: null, stock: null }

const rules: SessionRules<Draft> = { regionsOf: () => [1, 2], kernel: 'k1' }

const setup = (id: string, features: Array<string> = []): DraftSetup => ({
  id,
  name: id,
  direction: id === 'bottom' ? down : up,
  features,
  folders: [],
})

/** Every event in turn, from a session on `saved`. */
const run = (
  events: ReadonlyArray<SessionEvent<Draft>>,
  saved: Draft = applied,
  with_: SessionRules<Draft> = rules,
): PlanSession<Draft> =>
  events.reduce((now, event) => planSession(now, event, with_), startSession(saved))

const addTop: SessionEvent<Draft> = {
  type: 'act',
  action: { kind: 'addSetup', direction: up, id: 'top' },
}
const addBottom: SessionEvent<Draft> = {
  type: 'act',
  action: { kind: 'addSetup', direction: down, id: 'bottom' },
}
const machine = (id: string | null, coalesce?: string): SessionEvent<Draft> => ({
  type: 'edit',
  change: () => ({ machine: id }),
  coalesce,
})
const stock = (size: number | null, coalesce?: string): SessionEvent<Draft> => ({
  type: 'edit',
  change: () => ({ stock: size }),
  coalesce,
})
const ids = (session: PlanSession<Draft>) => session.draft.setups.map((each) => each.id)

describe('planSession', () => {
  it('starts on the draft as applied, or on edits kept from before a reload', () => {
    expect(isHeld(startSession(applied))).toBe(false)
    const kept = startSession(applied, { held: { ...applied, machine: 'mill' } })
    expect(isHeld(kept)).toBe(true)
    // Kept edits are held, but there is nothing to undo.
    expect(canUndo(kept)).toBe(false)
  })

  it('builds each edit on the one before, one step each, and saves none', () => {
    const session = run([addTop, addBottom])
    expect(ids(session)).toEqual(['top', 'bottom'])
    expect(session.past.map((draft) => draft.setups.length)).toEqual([0, 1])
    expect(session.saved).toBe(applied)
    expect(isHeld(session)).toBe(true)
  })

  it('walks back and forth with Undo and Redo, and a new edit drops what Redo had', () => {
    const back = run([addTop, addBottom, { type: 'undo' }])
    expect(ids(back)).toEqual(['top'])
    expect(canRedo(back)).toBe(true)
    expect(ids(planSession(back, { type: 'redo' }, rules))).toEqual(['top', 'bottom'])
    const other = planSession(back, machine('mill'), rules)
    expect(canRedo(other)).toBe(false)
    expect(ids(other)).toEqual(['top'])
  })

  it('answers the same session where an event changes nothing', () => {
    const start = startSession(applied)
    expect(planSession(start, { type: 'undo' }, rules)).toBe(start)
    expect(planSession(start, { type: 'redo' }, rules)).toBe(start)
    expect(planSession(start, { type: 'discard' }, rules)).toBe(start)
    expect(planSession(start, machine(null), rules)).toBe(start)
    expect(planSession(start, { type: 'nothing' } as unknown as SessionEvent<Draft>, rules)).toBe(
      start,
    )
  })

  it('says why an action was refused, and changes no draft', () => {
    const twice = run([
      addTop,
      { type: 'act', action: { kind: 'addSetup', direction: up, id: 'again' } },
    ])
    expect(twice.refused).toMatch(/direction already/)
    expect(ids(twice)).toEqual(['top'])
    expect(twice.past).toHaveLength(1)
    // The next event clears it.
    expect(planSession(twice, { type: 'undo' }, rules).refused).toBeNull()
  })

  it('names the folder an action made, for the page to open', () => {
    const session = run([
      addTop,
      { type: 'act', action: { kind: 'addFolder', parentId: 'top', id: 'holes', workId: 'w1' } },
    ])
    expect(session.folderId).toBe('holes')
    expect(planSession(session, machine('mill'), rules).folderId).toBeNull()
  })

  it('puts the plan back as applied on Discard: one step, which Undo takes back', () => {
    const discarded = run([addTop, addBottom, machine('mill'), { type: 'discard' }])
    expect(discarded.draft).toBe(applied)
    expect(isHeld(discarded)).toBe(false)
    expect(canRedo(discarded)).toBe(false)
    const undone = planSession(discarded, { type: 'undo' }, rules)
    expect(ids(undone)).toEqual(['top', 'bottom'])
    expect(undone.draft.machine).toBe('mill')
  })

  it('holds the app’s own fields with the constraints, one history for both', () => {
    const session = run([machine('mill'), addTop, { type: 'undo' }])
    expect(ids(session)).toEqual([])
    expect(session.draft.machine).toBe('mill')
    expect(run([machine('mill'), addTop, { type: 'undo' }, { type: 'undo' }]).draft).toBe(applied)
  })

  describe('a run of edits joined as one step', () => {
    it('joins edits with the same key, and the next run is a step of its own', () => {
      const joined = run([machine('mill'), stock(60, 'stock-1'), stock(70, 'stock-1')])
      expect(joined.draft.stock).toBe(70)
      const undone = planSession(joined, { type: 'undo' }, rules)
      expect(undone.draft).toMatchObject({ machine: 'mill', stock: null })
      const next = [
        { type: 'redo' as const },
        stock(80, 'stock-2'),
        { type: 'undo' as const },
      ].reduce((now, event: SessionEvent<Draft>) => planSession(now, event, rules), undone)
      expect(next.draft.stock).toBe(70)
    })

    it('takes the step off where a run goes back to where it started', () => {
      const back = run([stock(60, 'stock-1'), stock(null, 'stock-1')])
      expect(isHeld(back)).toBe(false)
      expect(canUndo(back)).toBe(false)
      expect(canUndo(planSession(back, stock(70, 'stock-1'), rules))).toBe(true)
    })

    it('ends at any other edit, Undo or Redo', () => {
      const broken = run([stock(60, 'stock-1'), addTop, stock(70, 'stock-1')])
      expect(broken.past).toHaveLength(3)
      const undone = run([stock(60, 'stock-1'), { type: 'undo' }, stock(70, 'stock-1')])
      expect(undone.past).toHaveLength(1)
      const redone = run([
        stock(60, 'stock-1'),
        addTop,
        { type: 'undo' },
        { type: 'redo' },
        stock(70, 'stock-1'),
      ])
      expect(redone.past).toHaveLength(3)
    })

    it('starts again after an Apply, though the editor stays open', () => {
      const first = run([stock(60, 'stock-1')])
      const sent = planSession(first, { type: 'applied', sent: first.draft }, rules)
      const after = planSession(sent, stock(70, 'stock-1'), rules)
      expect(planSession(after, { type: 'undo' }, rules).draft.stock).toBe(60)
    })
  })

  it('keeps no more than HISTORY steps', () => {
    const events = Array.from({ length: HISTORY + 5 }, (_, n) => stock(n + 1))
    const session = run(events)
    expect(session.past).toHaveLength(HISTORY)
    expect(session.past[0]?.stock).toBe(5)
  })

  it('takes Apply as the plan applied, keeping an edit made while it saved', () => {
    const sending = run([addTop])
    const sent = sending.draft
    const meanwhile = planSession(sending, machine('mill'), rules)
    const done = planSession(meanwhile, { type: 'applied', sent }, rules)
    expect(done.saved).toBe(sent)
    expect(done.draft.machine).toBe('mill')
    expect(isHeld(done)).toBe(true)
    expect(isHeld(planSession(sending, { type: 'applied', sent }, rules))).toBe(false)
  })

  describe('the plan read again', () => {
    const elsewhere: Draft = { ...applied, done: [5], doneKernel: 'k1', machine: 'lathe' }

    it('follows it where nothing is held', () => {
      const session = run([{ type: 'read', saved: elsewhere }])
      expect(session.draft).toBe(elsewhere)
      expect(isHeld(session)).toBe(false)
    })

    it('keeps held edits, and takes the fields not edited here from it', () => {
      const session = run([addTop, stock(60), { type: 'read', saved: elsewhere }])
      expect(ids(session)).toEqual(['top'])
      expect(session.draft).toMatchObject({ stock: 60, machine: 'lathe', done: [] })
      expect(session.saved).toBe(elsewhere)
      expect(canUndo(session)).toBe(true)
    })

    it('keeps a field edited here, though the plan read has another', () => {
      const session = run([machine('mill'), { type: 'read', saved: elsewhere }])
      expect(session.draft.machine).toBe('mill')
    })

    it('rebases as the app says, where it says', () => {
      const keepAll: SessionRules<Draft> = { ...rules, rebase: (held) => held }
      const session = run([stock(60), { type: 'read', saved: elsewhere }], applied, keepAll)
      expect(session.draft.machine).toBeNull()
    })
  })

  it('counts a reorder of a folder’s pins as held, but not the same folder with its keys reordered', () => {
    const top = setup('top', ['a', 'b'])
    const saved: Draft = { ...applied, setups: [top] }
    const rebuilt = { folders: [], features: ['a', 'b'], direction: up, name: 'top', id: 'top' }
    expect(isHeld(startSession(saved, { held: { ...saved, setups: [rebuilt] } }))).toBe(false)
    const reordered = { ...saved, setups: [{ ...top, features: ['b', 'a'] }] }
    expect(isHeld(startSession(saved, { held: reordered }))).toBe(true)
  })

  it('changes no constraints through an edit: those take an action', () => {
    const sneaky: SessionEvent<Draft> = {
      type: 'edit',
      change: (draft) => ({ ...draft, setups: [setup('top')], done: [1], machine: 'mill' }),
    }
    const session = run([sneaky])
    expect(session.draft).toEqual({ ...applied, machine: 'mill' })
    expect(
      run([{ type: 'edit', change: (draft) => ({ ...draft, setups: [setup('top')] }) }]).past,
    ).toHaveLength(0)
  })

  it('says what the last action did beyond the draft, until the next event', () => {
    const ignored: Draft = {
      ...applied,
      setups: [setup('top', ['f1'])],
      done: [1, 2],
      doneKernel: 'k1',
    }
    const session = run([{ type: 'act', action: { kind: 'unignore', regions: [1] } }], ignored)
    expect(session.facts).toMatchObject({ unignored: [1] })
    expect(planSession(session, { type: 'undo' }, rules).facts).toBeNull()
  })

  it('compares drafts as the app says, where it says', () => {
    const machineBlind: SessionRules<Draft> = {
      ...rules,
      same: (a, b) => a.setups.length === b.setups.length,
    }
    const session = run([machine('mill')], applied, machineBlind)
    expect(session.past).toHaveLength(0)
    expect(isHeld(session, machineBlind)).toBe(false)
  })

  it('carries out a plan action as applyDraftAction does', () => {
    const session = run([
      addTop,
      { type: 'act', action: { kind: 'pinFrom', tag: 'f1', direction: up, newId: 'n1' } },
    ])
    expect(session.draft.setups[0]?.features).toEqual(['f1'])
  })

  describe('a plan that can’t be changed', () => {
    const locked: SessionRules<Draft> = { ...rules, locked: true }

    it('takes no edit, Undo, Redo or Discard, and says Undo and Redo can’t', () => {
      const held = run([addTop, addBottom, { type: 'undo' }])
      for (const event of [
        addTop,
        machine('mill'),
        { type: 'undo' },
        { type: 'redo' },
        { type: 'discard' },
      ] as const) {
        expect(planSession(held, event, locked)).toBe(held)
      }
      expect(canUndo(held)).toBe(true)
      expect(canUndo(held, locked)).toBe(false)
      expect(canRedo(held, locked)).toBe(false)
    })

    it('still takes the plan as applied, read again', () => {
      const elsewhere = { ...applied, machine: 'lathe' }
      const session = planSession(startSession(applied), { type: 'read', saved: elsewhere }, locked)
      expect(session.draft).toBe(elsewhere)
    })
  })

  describe('save versions', () => {
    it('takes no plan read older than the one applied: a read answered after an Apply moved on', () => {
      const start = startSession(applied, { version: 5 })
      const editing = planSession(start, addTop, rules)
      const sent = editing.draft
      const done = planSession(editing, { type: 'applied', sent, version: 6 }, rules)
      expect(done.version).toBe(6)
      const late = { ...applied, done: [9], doneKernel: 'k1' }
      const after = planSession(done, { type: 'read', saved: late, version: 5 }, rules)
      expect(after.saved).toBe(sent)
      expect(isHeld(after)).toBe(false)
      const newer = planSession(done, { type: 'read', saved: late, version: 7 }, rules)
      expect(newer.saved).toBe(late)
      expect(newer.version).toBe(7)
    })

    it('takes every read where the app counts no versions', () => {
      const late = { ...applied, machine: 'lathe' }
      expect(run([{ type: 'read', saved: late }]).version).toBeNull()
      expect(run([{ type: 'read', saved: late }]).saved).toBe(late)
    })
  })
})
