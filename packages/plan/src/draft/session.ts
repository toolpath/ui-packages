import { applyDraftAction, type DraftAction, type DraftFacts } from './actions'
import type { Constraints, PlanRules } from './constraints'
import { sameJson } from './compare'
import type { Refusal } from './refusals'

/*
  A Plan page's edits, kept until Apply: the draft as saved, the draft as edited, and the steps
  Undo and Redo walk. One pure function moves it on (`nextSession`), so a React page holds it with
  one `useReducer` and gets Undo, Redo, Discard and the history without writing them.

  The session sends nothing. The page saves the draft on Apply, and tells the session how it went
  (`saved`, or `reloaded` when the plan was saved elsewhere first). While the plan can't be changed
  (`SessionRules.locked`), no edit, Undo or Redo changes it.

  Start a session once the draft as saved has been read, and a new one for another part (in React,
  `key={partId}` on the page that holds it).
*/

/** How many steps Undo reaches back through, unless the app's rules say (`undoLimit`). */
export const UNDO_LIMIT = 100

/**
 * A page's edits to a plan. `D` is what an edit changes and Undo puts back: the constraints, and any
 * fields of the app's own held with them (a material, a stock). Keep save stamps, such as a version
 * or a time, out of it: Undo would put an old one back.
 */
export interface PlanSession<D extends Constraints> {
  /** The draft as saved: what the edits are measured from, and what Discard puts back. */
  saved: D
  /** The draft as edited here. */
  draft: D
  /** The drafts Undo goes back to, oldest first: what was done, in order. */
  past: ReadonlyArray<D>
  /** The drafts Redo goes forward to, next first. */
  future: ReadonlyArray<D>
  /** The run of edits joined as one step (`coalesce`): its key, and the draft before it. */
  coalescing: { key: string; before: D } | null
  /** Why the last action was refused, for the app to word; null when it was not. */
  refused: Refusal | null
  /**
   * What the last action did beyond the draft, for the page to say (`DraftFacts`); null for none.
   */
  facts: DraftFacts | null
  /** The save version of `saved`, where the app has one: an older reload is not taken. */
  version: number | null
}

/**
 * A draft's own fields beside the constraints: what an `edit` changes (a material, a stock). The
 * constraints change only through actions.
 */
export type AppFields<D extends Constraints> = Partial<Omit<D, keyof Constraints>>

/**
 * Everything a session can be told. Edits with the same `coalesce` key, one after another, are one
 * step — the changes made while a stock editor is open, say. Any other edit, Undo or Redo ends the
 * run.
 */
export type SessionEvent<D extends Constraints> =
  /**
   * A plan action, carried out by `applyDraftAction` on the draft as it is now, with the plan as
   * saved: every change to the setups, groups, assignments and done faces.
   */
  | { type: 'action'; action: DraftAction; coalesce?: string }
  /**
   * The app's own fields (`AppFields`: a material, a stock), as one step. `change` is given the draft
   * as it is now, so two edits in a row build on each other, and answers the fields it changes. It
   * must be pure: React may call it twice. The constraints never change here: any it answers are
   * passed over.
   */
  | { type: 'editFields'; change: (draft: D) => AppFields<D>; coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Put the draft back as saved: one step, which Undo takes back. */
  | { type: 'discard' }
  /**
   * Apply saved `sent`, as `version` where the app counts saves. It is the draft as saved now; an
   * edit made while it saved stays an edit.
   */
  | { type: 'saved'; sent: D; version?: number }
  /**
   * The draft as saved, read again: after another tab saved, or Toolpath made a new plan. With no
   * edits, the draft follows it; with edits, they stay (`SessionRules.rebase`). A reload whose
   * `version` is older than the session's — answered after an Apply moved on — is not taken.
   */
  | { type: 'reloaded'; saved: D; version?: number }

/** What a session needs to know of the part and the app. */
export interface SessionRules<D extends Constraints> extends PlanRules {
  /** The plan can't be changed now: no edit, Undo, Redo or Discard changes the draft. */
  locked?: boolean
  /**
   * Whether two drafts are the same plan: an edit to the same plan is no step. Default: the same
   * values, whatever the order of each object's keys.
   */
  isSame?: (a: D, b: D) => boolean
  /**
   * The edits, onto a draft saved since (`now`), from the one they were made on (`was`). Default:
   * the constraints stay as edited; each other field stays as edited where it was edited here, and
   * follows `now` where it was not.
   */
  rebase?: (edited: D, was: D, now: D) => D
  /** How many steps Undo reaches back through. Default: `UNDO_LIMIT`. */
  undoLimit?: number
}

/** Every constraint's key: a key added to `Constraints` and not here fails to compile. */
const CONSTRAINT_KEYS: Record<keyof Constraints, true> = {
  setups: true,
  done: true,
  doneKernel: true,
}

const isConstraint = (key: PropertyKey): boolean => Object.hasOwn(CONSTRAINT_KEYS, key)

/** The app's fields an edit answered, any constraint passed over. */
const fieldsOnly = <D extends Constraints>(change: AppFields<D>): Partial<D> =>
  Object.fromEntries(Object.entries(change).filter(([key]) => !isConstraint(key))) as Partial<D>

/** The events that change the draft: none is taken while the plan is locked. */
const EDITS: ReadonlyArray<string> = ['action', 'editFields', 'undo', 'redo', 'discard']

const sameOf = <D extends Constraints>(rules: Pick<SessionRules<D>, 'isSame'>) =>
  rules.isSame ?? ((a: D, b: D) => a === b || sameJson(a, b))

/**
 * The default `rebase`: the constraints as edited, and the app's fields edited here; the rest from
 * `now`.
 */
const followSaved = <D extends Constraints>(edited: D, was: D, now: D): D => {
  const next = { ...edited }
  for (const key of Object.keys(now) as Array<keyof D>) {
    if (!isConstraint(key) && sameJson(edited[key], was[key])) {
      next[key] = now[key]
    }
  }
  return next
}

/**
 * A session on the draft as saved, at its save `version` if the app counts saves, with `draft` —
 * edits kept from before a reload — if any.
 */
export const startSession = <D extends Constraints>(
  saved: D,
  { draft, version }: { draft?: D; version?: number } = {},
): PlanSession<D> => ({
  saved,
  draft: draft ?? saved,
  past: [],
  future: [],
  coalescing: null,
  refused: null,
  facts: null,
  version: version ?? null,
})

/** Whether there are edits: the draft is not the plan as saved. What Apply and Discard need. */
export const hasEdits = <D extends Constraints>(
  session: PlanSession<D>,
  rules: Pick<SessionRules<D>, 'isSame'> = {},
): boolean => !sameOf(rules)(session.draft, session.saved)

/** Whether Undo would change the draft: a step to go back to, on a plan that can be changed. */
export const canUndo = (
  session: PlanSession<Constraints>,
  rules: Pick<SessionRules<Constraints>, 'locked'> = {},
): boolean => !rules.locked && session.past.length > 0

/** Whether Redo would change the draft: a step to go forward to, on a plan that can be changed. */
export const canRedo = (
  session: PlanSession<Constraints>,
  rules: Pick<SessionRules<Constraints>, 'locked'> = {},
): boolean => !rules.locked && session.future.length > 0

/**
 * The session after `event`: the one function that moves it on. It answers the session as it was
 * when the event changes nothing, so React draws nothing new. A refused action changes no draft and
 * says why in `refused`.
 *
 * ```ts
 * const [session, send] = useReducer(
 *   (now: PlanSession<Draft>, event: SessionEvent<Draft>) => nextSession(now, event, rules),
 *   saved,
 *   startSession,
 * )
 * ```
 */
export const nextSession = <D extends Constraints>(
  session: PlanSession<D>,
  event: SessionEvent<D>,
  rules: SessionRules<D>,
): PlanSession<D> => {
  const same = sameOf(rules)
  if (rules.locked && EDITS.includes(event.type)) {
    return session
  }
  const settled = settle(session)
  // Only untyped code, or a stored event, names a type not on the list: it changes nothing.
  if (!Object.hasOwn(TAKE, event.type)) {
    return settled
  }
  // Each type's function takes that type's event; TypeScript can't pair them through the lookup.
  const take = TAKE[event.type] as Take<SessionEventType>
  return take({ session, settled, rules, same }, event)
}

/** The session with the last action's notes — `refused`, `facts` — cleared. */
const settle = <D extends Constraints>(session: PlanSession<D>): PlanSession<D> =>
  session.refused === null && session.facts === null
    ? session
    : { ...session, refused: null, facts: null }

type SessionEventType = SessionEvent<Constraints>['type']

type EventOf<D extends Constraints, K extends SessionEventType> = Extract<
  SessionEvent<D>,
  { type: K }
>

/**
 * What an event is taken into: the session as it was, the same with the last action's notes
 * cleared (`settle`), the rules, and how two drafts are compared.
 */
interface Taking<D extends Constraints> {
  session: PlanSession<D>
  settled: PlanSession<D>
  rules: SessionRules<D>
  same: (a: D, b: D) => boolean
}

/** How one type of event moves a session on. */
type Take<K extends SessionEventType> = <D extends Constraints>(
  taking: Taking<D>,
  event: EventOf<D, K>,
) => PlanSession<D>

/** A plan action on the draft as it is now: one step, or why it was refused. */
const takeAction = <D extends Constraints>(
  { session, settled, rules, same }: Taking<D>,
  event: EventOf<D, 'action'>,
): PlanSession<D> => {
  const result = applyDraftAction(session.draft, event.action, rules, session.saved)
  if ('refused' in result) {
    return { ...settled, refused: result.refused }
  }
  const next = step({ settled, rules, same }, result.draft, event.coalesce)
  return { ...next, facts: result.facts }
}

/** The app's own fields as one step, any constraint the edit answers passed over. */
const takeEditFields = <D extends Constraints>(
  { session, ...taking }: Taking<D>,
  event: EventOf<D, 'editFields'>,
): PlanSession<D> => {
  const fields = fieldsOnly(event.change(session.draft))
  return step(taking, { ...session.draft, ...fields }, event.coalesce)
}

/** The draft back as saved: one step. */
const takeDiscard = <D extends Constraints>({ session, ...taking }: Taking<D>): PlanSession<D> =>
  step(taking, session.saved, undefined)

/** One step back, where there is one. */
const takeUndo = <D extends Constraints>({ session, settled }: Taking<D>): PlanSession<D> => {
  const back = session.past.at(-1)
  if (back === undefined) {
    return settled
  }
  return {
    ...settled,
    draft: back,
    past: session.past.slice(0, -1),
    future: [session.draft, ...session.future],
    coalescing: null,
  }
}

/** One step forward, where there is one. */
const takeRedo = <D extends Constraints>({ session, settled }: Taking<D>): PlanSession<D> => {
  const [forward, ...rest] = session.future
  if (forward === undefined) {
    return settled
  }
  return {
    ...settled,
    draft: forward,
    past: [...session.past, session.draft],
    future: rest,
    coalescing: null,
  }
}

/** The draft sent as the draft as saved now, unless an Apply since moved on. */
const takeSaved = <D extends Constraints>(
  { session, settled }: Taking<D>,
  event: EventOf<D, 'saved'>,
): PlanSession<D> => {
  if (older(session, event.version)) {
    return settled
  }
  return {
    ...settled,
    saved: event.sent,
    coalescing: null,
    version: event.version ?? session.version,
  }
}

/** The draft as saved, read again: the draft follows it, or the edits move onto it. */
const takeReloaded = <D extends Constraints>(
  { session, settled, rules, same }: Taking<D>,
  event: EventOf<D, 'reloaded'>,
): PlanSession<D> => {
  if (older(session, event.version)) {
    return settled
  }
  const edited = !same(session.draft, session.saved)
  const rebase = rules.rebase ?? followSaved
  return {
    ...settled,
    saved: event.saved,
    draft: edited ? rebase(session.draft, session.saved, event.saved) : event.saved,
    coalescing: null,
    version: event.version ?? session.version,
  }
}

/** Whether a save `version` is older than the one the session has. */
const older = (session: PlanSession<Constraints>, version: number | undefined): boolean =>
  version !== undefined && session.version !== null && version < session.version

/** `next` as the draft: one step Undo takes back, or part of the run `coalesce` names. */
const step = <D extends Constraints>(
  { settled, rules, same }: Omit<Taking<D>, 'session'>,
  next: D,
  coalesce: string | undefined,
): PlanSession<D> => {
  if (same(next, settled.draft)) {
    return settled
  }
  const run = settled.coalescing
  const joined = coalesce !== undefined && run?.key === coalesce ? run : null
  const moved = { ...settled, draft: next, future: [] }
  if (joined && same(next, joined.before)) {
    // Back where the run started: the step is nothing, and the next edit starts another.
    return { ...moved, past: settled.past.slice(0, -1), coalescing: null }
  }
  if (joined) {
    return moved
  }
  const past = [...settled.past, settled.draft]
  return {
    ...moved,
    past: past.slice(Math.max(0, past.length - (rules.undoLimit ?? UNDO_LIMIT))),
    coalescing: coalesce === undefined ? null : { key: coalesce, before: settled.draft },
  }
}

/** How each type of event moves a session on. */
const TAKE: { readonly [K in SessionEventType]: Take<K> } = {
  action: takeAction,
  editFields: takeEditFields,
  undo: takeUndo,
  redo: takeRedo,
  discard: takeDiscard,
  saved: takeSaved,
  reloaded: takeReloaded,
}
