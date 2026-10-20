import type { ArtifactState } from './artifact-state'
import { isSignedOff, type PartState } from './part-state'

/*
  Where a part is in its quote's pipeline: the actions a person takes on it, one after another —
  Plan Part (its constraints, stock, material and machine), Review Plan (Toolpath's plan, read),
  Estimate, Quote. One stage at a time is the one that can be changed — the constraints only in
  Plan Part, the estimate only in Estimate — so the two never move under each other. The stage is
  stored (`parts.stage`) and set only by a move, or by Apply, which moves the part on to Review
  Plan with the constraints it persists; what the stage needs — a plan, an estimate — reads as
  pending, failed or available beside it (`artifact-state.ts`), so a part may be moved
  to any stage, and the stage shows what it is still waiting for.
*/

export type PartStage = 'setup' | 'review' | 'estimate' | 'quote'

export const PART_STAGES: ReadonlyArray<PartStage> = ['setup', 'review', 'estimate', 'quote']

/**
 * A stored stage as one of the four: any other value reads as Plan Part, so nothing past the
 * server's read ever sees a stage it does not know.
 */
export const asPartStage = (value: string): PartStage =>
  PART_STAGES.includes(value as PartStage) ? (value as PartStage) : 'setup'

/** What each stage is called, everywhere a part's stage is shown. */
export const PART_STAGE_LABELS: Record<PartStage, string> = {
  setup: 'Plan Part',
  review: 'Review Plan',
  estimate: 'Estimate',
  quote: 'Quote',
}

/** The Plan page's stages: Plan Part is its Constraints view, Review Plan its Results view. */
export const onPlanPage = (stage: PartStage): boolean => stage === 'setup' || stage === 'review'

/** Whether `to` is further along than `from`. */
export const isForward = (from: PartStage, to: PartStage): boolean =>
  PART_STAGES.indexOf(to) > PART_STAGES.indexOf(from)

/** What a move reads of a part: its stage, its state, and whether its estimate is for its inputs. */
export interface StagedPart {
  stage: PartStage
  state: PartState
  estimate: ArtifactState
}

/** What a part on the Plan page is waiting on or needs, for its card. Null past it. */
export type PlanDetail = 'reading' | 'calculating' | 'failed' | 'changed' | 'ready'

/**
 * Ready only with a plan of the part as it stands (`plan`): a part timed, but whose plan is not
 * of these inputs — edited since, or priced without a plan — needs one calculated.
 */
export const planDetailOf = ({
  stage,
  state,
  plan,
}: Pick<StagedPart, 'stage' | 'state'> & { plan: ArtifactState }): PlanDetail | null => {
  if (!onPlanPage(stage)) {
    return null
  }
  switch (state.kind) {
    case 'analyzing':
      return 'reading'
    case 'planning':
    case 'updating':
      return 'calculating'
    case 'analysis_failed':
    case 'plan_failed':
    case 'update_failed':
    case 'gone':
      return 'failed'
    case 'priced':
      return plan === 'available' ? 'ready' : 'changed'
  }
}

/**
 * What moving a part from one stage to another does, or why it cannot. Every way of moving a part —
 * dropping its card, its Move to menu — asks this, so they agree on what each move means. A move
 * never sends anything to Toolpath: a persist does that. A part may move to any stage, up or
 * down; a stage whose artifact is not there yet shows it pending.
 *
 * - `move`: the stage set and nothing else — into Plan Part or Review Plan; into Estimate once
 *   timed, its estimate pending, failed or available as it is; into Quote with no estimate of the
 *   part as it stands yet, its approval waiting on one.
 * - `withoutTimes`: price a part that has never been timed without the times it is waiting on, or
 *   was refused: planning or plan failed — blank, since it has no earlier times to start from.
 * - `approve`: into Quote, its estimate approved — from any stage, once that estimate is
 *   available — or, in Quote already with no approval yet, the approval alone (`Approve estimate`).
 * Out of Quote, whichever way, the server takes the approval back with the move.
 */
export type StageMove =
  | { kind: 'move' }
  | { kind: 'withoutTimes' }
  | { kind: 'approve' }
  | { kind: 'refused'; reason: string }

/** Why a part whose model Toolpath has not read cannot be estimated: the server's move says the same. */
export const MODEL_UNREAD = 'The model is still being read.'
export const MODEL_FAILED = 'Try again first: Toolpath could not read the model.'

export const moveFor = (
  { stage: from, state, estimate }: StagedPart,
  to: PartStage,
): StageMove | null => {
  if (from === to) {
    // In Quote with its estimate landed since it moved there: the approval is what is left.
    return from === 'quote' && estimate === 'available' && !isSignedOff(state)
      ? { kind: 'approve' }
      : null
  }
  // Nothing to do at all once Toolpath has let the model go.
  if (state.kind === 'gone') {
    return { kind: 'refused', reason: MODEL_FAILED }
  }
  // Out of Quote, the approval is taken back with the move, by the server.
  if (from === 'quote') {
    return { kind: 'move' }
  }
  // Nothing to price until Toolpath has read the model.
  const prices = to === 'estimate' || to === 'quote'
  if (prices && state.kind === 'analyzing') {
    return { kind: 'refused', reason: MODEL_UNREAD }
  }
  if (prices && state.kind === 'analysis_failed') {
    return { kind: 'refused', reason: MODEL_FAILED }
  }
  if (to === 'quote') {
    return estimate === 'available' ? { kind: 'approve' } : { kind: 'move' }
  }
  if (to === 'estimate' && (state.kind === 'planning' || state.kind === 'plan_failed')) {
    return { kind: 'withoutTimes' }
  }
  return { kind: 'move' }
}
