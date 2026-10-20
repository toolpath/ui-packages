import type { PartStage } from './part-stage'

/*
  Where a part stands, as one value. The server stores the pipeline — which Toolpath job the part is
  waiting on, or how the last one ended — and its stage, and derives the rest from what it has:
  times, inputs edited since they were planned, and an approval. Every page renders from this and
  nothing else, so no two of them can disagree about a part.
*/

/**
 * The stored half: what the part is waiting on at Toolpath, or how its last job ended. `sending` is
 * the part held while a request is on its way to Toolpath, before it has a job. `gone` is no longer
 * written — a job Toolpath forgets fails the plan instead — and reads as a plan to send again.
 */
export type PartPipeline =
  | 'analyzing'
  | 'analysis_failed'
  | 'sending'
  | 'planning'
  | 'plan_failed'
  | 'ready'
  | 'gone'

/** What a new part starts as: its analysis running, or — with no CAD file — nothing to machine. */
export const initialPipeline = (
  analysisJobId: string | null,
): { pipeline: PartPipeline; pipelineJobId: string | null; pipelineError: string | null } =>
  analysisJobId
    ? { pipeline: 'analyzing', pipelineJobId: analysisJobId, pipelineError: null }
    : {
        pipeline: 'plan_failed',
        pipelineJobId: null,
        pipelineError: 'This part has no CAD file, so there is nothing to machine.',
      }

/** How far somebody has signed the part off (D34). */
export type PartReview = 'new' | 'confirmed' | 'approved'

export type PartState =
  /** Toolpath is reading the model. */
  | { kind: 'analyzing' }
  /** Toolpath could not read the model. */
  | { kind: 'analysis_failed'; error: string }
  /** Toolpath is planning the part for the first time: no times yet. */
  | { kind: 'planning' }
  /** Toolpath could not plan the part, and it has no times. */
  | { kind: 'plan_failed'; error: string }
  /** Toolpath no longer has the part. */
  | { kind: 'gone' }
  /** Timed. `edited`: its inputs changed since, so its times are not of the part as it stands. */
  | { kind: 'priced'; review: PartReview; edited: boolean }
  /** Toolpath is planning an edited plan; the last times stand until it answers. */
  | { kind: 'updating' }
  /** Toolpath refused an edited plan; the last times stand. */
  | { kind: 'update_failed'; error: string }

export type PartStateKind = PartState['kind']

/** What a part's state is read from. */
export interface PartStateInput {
  pipeline: PartPipeline
  pipelineError: string | null
  /** It has machining times — the last good ones, whatever is running now. */
  timed: boolean
  /** Its inputs — plan, stock, material, machine, tool crib — changed since those times were planned. */
  edited: boolean
  /** Its last run was asked for its inputs as they stand (`runFingerprint` is their fingerprint). */
  runCurrent: boolean
  /** The stage it was moved to (`parts.stage`). */
  stage: PartStage
  estimateComplete: boolean
}

const FAILED = 'Toolpath could not calculate this part.'

/**
 * A failed plan is the part's state only while it is the run of its inputs as they stand: once they
 * have moved on — back to inputs it has times of, say — a plan that failed for others is not theirs,
 * and a part with times reads as they say, as `ready`. A model Toolpath could not read is the
 * part's whatever its inputs; a part with no times has nothing else to read as, and keeps the failure.
 */
const pipelineOf = (input: PartStateInput): PartPipeline =>
  (input.pipeline === 'plan_failed' || input.pipeline === 'gone') &&
  input.timed &&
  !input.runCurrent
    ? 'ready'
    : input.pipeline

export const partStateOf = (input: PartStateInput): PartState => {
  const error = input.pipelineError ?? FAILED
  switch (pipelineOf(input)) {
    case 'analyzing':
      return { kind: 'analyzing' }
    case 'analysis_failed':
      return { kind: 'analysis_failed', error }
    case 'gone':
      return { kind: 'gone' }
    case 'sending':
    case 'planning':
      return input.timed ? { kind: 'updating' } : { kind: 'planning' }
    case 'plan_failed':
      return input.timed ? { kind: 'update_failed', error } : { kind: 'plan_failed', error }
    case 'ready':
      if (!input.timed) {
        return { kind: 'plan_failed', error }
      }
      return {
        kind: 'priced',
        edited: input.edited,
        // Edited reads New whatever stage it is in: what was signed off was priced from older inputs.
        review:
          input.edited || input.stage === 'setup' || input.stage === 'review'
            ? 'new'
            : input.stage === 'quote' && input.estimateComplete
              ? 'approved'
              : 'confirmed',
      }
  }
}

/** Waiting on Toolpath: nothing can be done to the part until it answers. */
export const isWaiting = (state: PartState): boolean =>
  state.kind === 'analyzing' || state.kind === 'planning' || state.kind === 'updating'

/**
 * Its plan and inputs can't be edited yet: Toolpath is working on the part and has no plan of it to
 * edit. Once it has planned the setups (`planned`), they are edited while their times are on the
 * way — a save then is kept, and planned as soon as the run under way lands.
 */
export const isEditLocked = (state: PartState, planned: boolean): boolean =>
  isWaiting(state) && !planned

/** It has machining times to show — current, or the last good ones. */
export const hasTimes = (state: PartState): boolean =>
  state.kind === 'priced' || state.kind === 'updating' || state.kind === 'update_failed'

/** Its times are the plan's own: priced, and not edited since. */
export const isCurrent = (state: PartState): boolean => state.kind === 'priced' && !state.edited

/**
 * Stuck on its plan — planning, or refused, with or without earlier times — and so can be estimated
 * without its machining times: priced blank, or from the last times it had, late times set aside.
 */
export const canEstimateWithoutTimes = (state: PartState): boolean =>
  state.kind === 'planning' ||
  state.kind === 'plan_failed' ||
  state.kind === 'updating' ||
  state.kind === 'update_failed'

/** The model has been read: its mesh, report and size can be asked for. */
export const isAnalyzed = (state: PartState): boolean =>
  state.kind !== 'analyzing' && state.kind !== 'analysis_failed' && state.kind !== 'gone'

/** Whether the part's model can be read: still analyzing, read, refused, or gone from Toolpath. */
export type ModelReadiness = 'waiting' | 'ready' | 'failed' | 'gone'

export const modelOf = (state: PartState): ModelReadiness =>
  state.kind === 'analyzing'
    ? 'waiting'
    : state.kind === 'analysis_failed'
      ? 'failed'
      : state.kind === 'gone'
        ? 'gone'
        : 'ready'

/** Where the review stands, or New for a part that is not priced. */
export const reviewOf = (state: PartState): PartReview =>
  state.kind === 'priced' ? state.review : 'new'

/** Signed off: priced from its inputs as they stand, in Quote with its estimate approved. */
export const isSignedOff = (state: PartState): boolean =>
  isCurrent(state) && reviewOf(state) === 'approved'

/** Toolpath refused it, and trying again is what can be done about it. */
export const canRetry = (state: PartState): boolean =>
  state.kind === 'plan_failed' ||
  state.kind === 'update_failed' ||
  state.kind === 'gone' ||
  state.kind === 'analysis_failed'
