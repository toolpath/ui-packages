import { applyDraftAction, type DraftAction, type DraftFacts } from './draft-action'
import type { Constraints, PlanRules } from './plan-draft'
import { sameJson } from './same-json'

/*
  A Plan page's edits, held until Apply: the draft as applied, the draft as edited, and the steps
  Undo and Redo walk. One pure function moves it on (`planSession`), so a React page holds it with
  one `useReducer` and gets Undo, Redo, Discard and the history without writing them.

  The session sends nothing. The page saves the draft on Apply, and tells the session how it went
  (`applied`, or `read` when the plan was applied elsewhere first). While the plan can't be changed
  (`SessionRules.locked`), no edit, Undo or Redo changes it.

  Start a session once the draft as applied has been read, and a new one for another part (in React,
  `key={partId}` on the page that holds it).
*/

/** How many steps Undo reaches back through. */
export const HISTORY = 100

/**
 * A page's edits to a plan. `D` is what an edit changes and Undo puts back: the constraints, and any
 * fields of the app's own held with them (a material, a stock). Keep save stamps, such as a version
 * or a time, out of it: Undo would put an old one back.
 */
export interface PlanSession<D extends Constraints> {
  /** The draft as applied: what the edits are measured from, and what Discard puts back. */
  saved: D
  /** The draft as edited here. */
  draft: D
  /** The drafts Undo goes back to, oldest first: what was done, in order. */
  past: ReadonlyArray<D>
  /** The drafts Redo goes forward to, next first. */
  future: ReadonlyArray<D>
  /** The run of edits joined as one step (`coalesce`): its key, and the draft before it. */
  run: { key: string; before: D } | null
  /** Why the last action was refused, to show the person; null when it was not. */
  refused: string | null
  /** The folder to open after the last action (`DraftResult`'s `folderId`); null for none. */
  folderId: string | null
  /** What the last action did beyond the draft, for the page to say (`DraftFacts`); null for none. */
  facts: DraftFacts | null
  /** The save version of `saved`, where the app has one: an older plan read is not taken. */
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
   * applied: every change to the setups, folders, pins and ignored faces.
   */
  | { type: 'act'; action: DraftAction; coalesce?: string }
  /**
   * The app's own fields (`AppFields`: a material, a stock), as one step. `change` is given the draft
   * as it is now, so two edits in a row build on each other, and answers the fields it changes. It
   * must be pure: React may call it twice. The constraints never change here: any it answers are
   * passed over.
   */
  | { type: 'edit'; change: (draft: D) => AppFields<D>; coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Put the draft back as applied: one step, which Undo takes back. */
  | { type: 'discard' }
  /**
   * Apply saved `sent`, as `version` where the app counts saves. It is the draft as applied now; an
   * edit made while it saved stays held.
   */
  | { type: 'applied'; sent: D; version?: number }
  /**
   * The draft as applied, read again: after another tab applied, or Toolpath made a new plan. With
   * nothing held, the draft follows it; with edits held, they stay (`SessionRules.rebase`). A read
   * whose `version` is older than the session's — answered after an Apply moved on — is not taken.
   */
  | { type: 'read'; saved: D; version?: number }

/** What a session needs to know of the part and the app. */
export interface SessionRules<D extends Constraints> extends PlanRules {
  /** The plan can't be changed now: no edit, Undo, Redo or Discard changes the draft. */
  locked?: boolean
  /**
   * Whether two drafts are the same plan: an edit to the same plan is no step. Default: the same
   * values, whatever the order of each object's keys.
   */
  same?: (a: D, b: D) => boolean
  /**
   * The edits held, onto a draft applied since (`now`), from the one they were made on (`was`).
   * Default: the constraints stay as held; each other field stays as held where it was edited here,
   * and follows `now` where it was not.
   */
  rebase?: (held: D, was: D, now: D) => D
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
const EDITS: ReadonlyArray<string> = ['act', 'edit', 'undo', 'redo', 'discard']

const sameOf = <D extends Constraints>(rules: Pick<SessionRules<D>, 'same'>) =>
  rules.same ?? ((a: D, b: D) => a === b || sameJson(a, b))

/** The default `rebase`: the constraints as held, and the app's fields edited here; the rest from `now`. */
const followSaved = <D extends Constraints>(held: D, was: D, now: D): D => {
  const next = { ...held }
  for (const key of Object.keys(now) as Array<keyof D>) {
    if (!isConstraint(key) && sameJson(held[key], was[key])) {
      next[key] = now[key]
    }
  }
  return next
}

/**
 * A session on the draft as applied, at its save `version` if the app counts saves, with `held` —
 * edits kept from before a reload — if any.
 */
export const startSession = <D extends Constraints>(
  saved: D,
  { held, version }: { held?: D; version?: number } = {},
): PlanSession<D> => ({
  saved,
  draft: held ?? saved,
  past: [],
  future: [],
  run: null,
  refused: null,
  folderId: null,
  facts: null,
  version: version ?? null,
})

/** Whether edits are held: the draft is not the plan as applied. What Apply and Discard need. */
export const isHeld = <D extends Constraints>(
  session: PlanSession<D>,
  rules: Pick<SessionRules<D>, 'same'> = {},
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

/** Whether a save `version` is older than the one the session has. */
const older = (session: PlanSession<Constraints>, version: number | undefined): boolean =>
  version !== undefined && session.version !== null && version < session.version

/** A value no event type names — from untyped code, or stored: it changes nothing. */
const unknownEvent = <S>(_event: never, session: S): S => session

/** `next` as the draft: one step Undo takes back, or part of the run `coalesce` names. */
const step = <D extends Constraints>(
  session: PlanSession<D>,
  next: D,
  coalesce: string | undefined,
  same: (a: D, b: D) => boolean,
): PlanSession<D> => {
  if (same(next, session.draft)) {
    return session
  }
  const joined = coalesce !== undefined && session.run?.key === coalesce ? session.run : null
  const moved = { ...session, draft: next, future: [] }
  if (joined && same(next, joined.before)) {
    // Back where the run started: the step is nothing, and the next edit starts another.
    return { ...moved, past: session.past.slice(0, -1), run: null }
  }
  if (joined) {
    return moved
  }
  return {
    ...moved,
    past: [...session.past.slice(-(HISTORY - 1)), session.draft],
    run: coalesce === undefined ? null : { key: coalesce, before: session.draft },
  }
}

/**
 * The session after `event`: the one function that moves it on. It answers the session as it was
 * when the event changes nothing, so React draws nothing new. A refused action changes no draft and
 * says why in `refused`.
 *
 * ```ts
 * const [session, send] = useReducer(
 *   (now: PlanSession<Draft>, event: SessionEvent<Draft>) => planSession(now, event, rules),
 *   saved,
 *   startSession,
 * )
 * ```
 */
export const planSession = <D extends Constraints>(
  session: PlanSession<D>,
  event: SessionEvent<D>,
  rules: SessionRules<D>,
): PlanSession<D> => {
  const same = sameOf(rules)
  if (rules.locked && EDITS.includes(event.type)) {
    return session
  }
  const settled =
    session.refused === null && session.folderId === null && session.facts === null
      ? session
      : { ...session, refused: null, folderId: null, facts: null }
  switch (event.type) {
    case 'act': {
      const result = applyDraftAction(session.draft, event.action, rules, session.saved)
      if ('refused' in result) {
        return { ...settled, refused: result.refused }
      }
      const next = step(settled, result.draft, event.coalesce, same)
      return { ...next, folderId: result.folderId ?? null, facts: result.facts }
    }
    case 'edit': {
      const fields = fieldsOnly(event.change(session.draft))
      return step(settled, { ...session.draft, ...fields }, event.coalesce, same)
    }
    case 'discard':
      return step(settled, session.saved, undefined, same)
    case 'undo': {
      const back = session.past.at(-1)
      return back === undefined
        ? settled
        : {
            ...settled,
            draft: back,
            past: session.past.slice(0, -1),
            future: [session.draft, ...session.future],
            run: null,
          }
    }
    case 'redo': {
      const [forward, ...rest] = session.future
      return forward === undefined
        ? settled
        : {
            ...settled,
            draft: forward,
            past: [...session.past, session.draft],
            future: rest,
            run: null,
          }
    }
    case 'applied':
      return older(session, event.version)
        ? settled
        : { ...settled, saved: event.sent, run: null, version: event.version ?? session.version }
    case 'read': {
      if (older(session, event.version)) {
        return settled
      }
      const held = !same(session.draft, session.saved)
      const rebase = rules.rebase ?? followSaved
      return {
        ...settled,
        saved: event.saved,
        draft: held ? rebase(session.draft, session.saved, event.saved) : event.saved,
        run: null,
        version: event.version ?? session.version,
      }
    }
    default:
      return unknownEvent(event, settled)
  }
}
