import {
  isHeld,
  planSession,
  sameJson,
  startSession,
  type PlanRules,
  type PlanSession,
  type SessionEvent,
  type SessionRules,
} from '@toolpath/plan'

import { sameStock } from '../inputs/stock'
import type { Intent, PartInputsHeld, PlanDraft } from './plan-draft'

export type { DraftAction, DraftFacts, PlanRules } from '@toolpath/plan'

/*
  The quoting app's Plan page holds an `Intent` in its `PlanSession`: the constraints and the part's
  inputs, with no save stamps. These are the rules that session needs beyond plan mode's own, and
  the session with them in place (`quotingPlan`), so the app has no rules of its own to forget.
*/

/** The setups, done faces and inputs alone: a draft's save stamps are left out of the session. */
export const intentOf = (draft: Intent): Intent => ({
  setups: draft.setups,
  done: draft.done,
  doneKernel: draft.doneKernel,
  inputs: draft.inputs,
})

/** Whether two lists of DFM rule set ids name the same sets, in any order. */
const sameRuleSetIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/**
 * Whether two sets of inputs are the same: the stock compared as a policy, whatever its key order,
 * and the rule sets whatever their order.
 */
const sameInputs = (a: PartInputsHeld, b: PartInputsHeld): boolean =>
  a === b ||
  (a.materialId === b.materialId &&
    a.machineProfileId === b.machineProfileId &&
    sameRuleSetIds(a.dfmRuleSetIds, b.dfmRuleSetIds) &&
    a.stock.profileId === b.stock.profileId &&
    sameStock(a.stock.policy, b.stock.policy) &&
    sameJson(a.toolCrib, b.toolCrib))

/**
 * Whether two intents are the same plan: compared as written, but with each object's keys in order,
 * so a folder rebuilt with its fields in another order is still the same folder.
 */
export const sameIntent = (a: Intent, b: Intent): boolean =>
  a.doneKernel === b.doneKernel &&
  (a.setups === b.setups || sameJson(a.setups, b.setups)) &&
  (a.done === b.done || sameJson(a.done, b.done)) &&
  sameInputs(a.inputs, b.inputs)

/**
 * The intent held, onto a plan applied since (`now`): the constraints stay as held, and each input
 * edited here — not as `was`, the plan it was edited from, had it — stays held; each other input
 * follows `now`, so another tab's machine is not put back by these edits.
 */
export const rebaseIntent = (held: Intent, was: Intent, now: Intent): Intent => {
  const keep = <K extends keyof PartInputsHeld>(key: K): PartInputsHeld[K] =>
    sameJson(held.inputs[key], was.inputs[key]) ? now.inputs[key] : held.inputs[key]
  return {
    ...held,
    inputs: {
      materialId: keep('materialId'),
      machineProfileId: keep('machineProfileId'),
      toolCrib: keep('toolCrib'),
      stock: keep('stock'),
      dfmRuleSetIds: keep('dfmRuleSetIds'),
    },
  }
}

/** The session rules of the quoting app's Plan page, for the part `rules` reads. */
export const intentSessionRules = (rules: PlanRules): SessionRules<Intent> => ({
  ...rules,
  same: sameIntent,
  rebase: rebaseIntent,
})

/** The quoting app's Plan page session: its edits to a part's constraints and inputs. */
export type IntentSession = PlanSession<Intent>

/** Everything an `IntentSession` can be told. */
export type IntentEvent = SessionEvent<Intent>

/** What an `IntentSession` reads of the part, and whether the plan can be changed now. */
export interface IntentRules extends PlanRules {
  locked?: boolean
}

/**
 * The quoting app's Plan page session, with its rules (`sameIntent`, `rebaseIntent`) in place: the
 * app gives only what it reads of the part, and whether the plan is locked.
 */
export const quotingPlan = {
  /**
   * A session on the plan as saved, at its save version, with `held` — edits kept from before a
   * reload — if any.
   */
  start: (saved: PlanDraft, held?: Intent | null): IntentSession =>
    startSession(intentOf(saved), { held: held ?? undefined, version: saved.version }),

  /**
   * The session after `event`: a new session, the one given left as it was (`@toolpath/plan`'s
   * `planSession`, with the app's rules).
   */
  update: (session: IntentSession, event: IntentEvent, rules: IntentRules): IntentSession =>
    planSession(session, event, { ...intentSessionRules(rules), locked: rules.locked }),

  /**
   * Whether the page has edits not applied yet: the draft is not the plan as applied. What Apply
   * and Discard need. `@toolpath/plan`'s `isHeld`, compared by `sameIntent`.
   */
  hasEdits: (session: IntentSession): boolean => isHeld(session, { same: sameIntent }),

  /** The plan as saved, read again, as an event: its save stamps left out, its version kept. */
  read: (saved: PlanDraft): IntentEvent => ({
    type: 'read',
    saved: intentOf(saved),
    version: saved.version,
  }),
}
