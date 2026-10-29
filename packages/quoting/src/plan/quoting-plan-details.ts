import {
  planDetails,
  type EnginePlan,
  type PartAnalysis,
  type PlanDetails,
  type PlanDetailsPart,
} from '@toolpath/plan'

import { quotingPlan, type IntentSession } from './intent-session'
import type { PlanDraft } from './plan-draft'

/*
  The quoting app's plan details: `@toolpath/plan`'s `planDetails`, made from what the app holds — the plan
  as saved, the session with its edits, and Toolpath's plan — so the app works out none of its inputs.
*/

/** The plan as saved, with its stamps, and the session that holds the page's edits to it. */
export interface QuotingPlanLoaded {
  saved: PlanDraft
  session: IntentSession
}

export interface QuotingPlanDetailsInputs {
  /** Null before the plan as saved is read. */
  loaded: QuotingPlanLoaded | null
  /** Toolpath's plan; null before one is read. */
  plan: EnginePlan | null
  /** No newer plan is on its way from Toolpath: `plan` is the latest. */
  planSettled: boolean
  part: PlanDetailsPart
  /** Null before the part's analysis is read. */
  analysis: PartAnalysis | null
}

/**
 * The quoting app's plan details. The draft is the session's edits over the plan as saved, which keeps
 * the kernel its pins name. Toolpath's setups are named by the folders they are from only while
 * the plan is of the plan as saved: no edits held, nothing changed since, and no newer plan on its
 * way. Call it again when an input changes.
 */
export const quotingPlanDetails = ({
  loaded,
  plan,
  planSettled,
  part,
  analysis,
}: QuotingPlanDetailsInputs): PlanDetails =>
  planDetails({
    draft: loaded && { ...loaded.saved, ...loaded.session.draft },
    saved: loaded?.saved ?? null,
    plan,
    part,
    analysis,
    planIsOfSaved: loaded !== null && planIsOfSaved(loaded, planSettled),
  })

const planIsOfSaved = ({ saved, session }: QuotingPlanLoaded, planSettled: boolean): boolean =>
  !quotingPlan.hasEdits(session) && !saved.changed && planSettled
