import {
  planPage,
  type EnginePlan,
  type PartAnalysis,
  type PlanPage,
  type PlanPagePart,
} from '@toolpath/plan'

import { quotingPlan, type IntentSession } from './intent-session'
import type { PlanDraft } from './plan-draft'

/*
  The quoting app's Plan page: `@toolpath/plan`'s `planPage`, made from what the app holds — the plan
  as saved, the session with its edits, and Toolpath's plan — so the app works out none of its inputs.
*/

/** The plan as saved, with its stamps, and the session that holds the page's edits to it. */
export interface QuotingPlanLoaded {
  saved: PlanDraft
  session: IntentSession
}

export interface QuotingPageInputs {
  /** Null before the plan as saved is read. */
  loaded: QuotingPlanLoaded | null
  /** Toolpath's plan; null before one is read. */
  plan: EnginePlan | null
  /** No newer plan is on its way from Toolpath: `plan` is the latest. */
  planSettled: boolean
  part: PlanPagePart
  /** Null before the part's analysis is read. */
  analysis: PartAnalysis | null
}

/**
 * The quoting app's Plan page. The draft is the session's edits over the plan as saved, which keeps
 * the kernel its pins name. Toolpath's setups are named by the folders they are from only while
 * the plan is of the plan as saved: no edits held, nothing changed since, and no newer plan on its
 * way. Make a new page when an input changes.
 */
export const quotingPage = ({
  loaded,
  plan,
  planSettled,
  part,
  analysis,
}: QuotingPageInputs): PlanPage =>
  planPage({
    draft: loaded && { ...loaded.saved, ...loaded.session.draft },
    saved: loaded?.saved ?? null,
    plan,
    part,
    analysis,
    planIsOfSaved: loaded !== null && planIsOfSaved(loaded, planSettled),
  })

const planIsOfSaved = ({ saved, session }: QuotingPlanLoaded, planSettled: boolean): boolean =>
  !quotingPlan.hasEdits(session) && !saved.changed && planSettled
