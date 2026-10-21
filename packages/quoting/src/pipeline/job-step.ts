import type { StockOption } from '@toolpath/plan'
import type { WaitingPipeline } from './run-decision'

/*
  A waiting part moved on to wherever its job has got to: the app asks Toolpath about the job, and
  these say which step that answer allows. Nothing ends in a state with no way out: a job Toolpath
  no longer has is read past — its plan's times read if they exist, else the plan failed and can be
  tried again — and a send that never said how it went fails once it is old.
*/

/**
 * How long a part may be held for a plan on its way to Toolpath before the hold is taken as lost —
 * the request that made it died before it could say how sending went.
 */
export const SENDING_MS = 120_000

/** What a part's plan says when sending it never finished. */
export const SEND_LOST = 'Sending the plan to Toolpath did not finish. Try again to send it.'

/** What a part's plan says when Toolpath no longer has the job planning it, and has no times. */
export const JOB_LOST = 'Toolpath no longer has the job planning this part. Try again to send it.'

/** What a part's plan says when no plan was queued with its analysis, and its stock is not why. */
export const PLAN_NOT_QUEUED = 'Could not start the machining-time calculation for this part.'

/** Toolpath's answer about a job. `gone`: it no longer has it. */
export type JobAnswer =
  | { status: 'queued' | 'running' | 'succeeded' | 'failed'; error: string | null }
  | { status: 'gone'; error: null }

/** What `jobStep` reads of a waiting part. */
export interface WaitingFacts {
  /** A part Toolpath has (`toolpathHas`): any other is waiting on nothing, and takes no step. */
  pipeline: WaitingPipeline
  /** How long the part has been held for a send, in milliseconds: read only while `sending`. */
  heldMs: number
  /** Toolpath's answer about the job it waits on; null where none came, or none was asked (`sending`). */
  job: JobAnswer | null
  /** The plan queued with an analysis, if any. */
  planJobId: string | null
  planId: string | null
  plannedJobId: string | null
}

/** The step a waiting part takes (`jobStep`). */
export type JobStep =
  /** Stay as it is, for the next ask. `notePlanned`: read whether Toolpath has planned its setups. */
  | { step: 'wait'; notePlanned: boolean }
  /** Fail, saying why; `settle`: then ask for the newest inputs' run (`runDecision`). */
  | {
      step: 'fail'
      pipeline: 'analysis_failed' | 'plan_failed'
      error: string | null
      settle: boolean
    }
  /**
   * The model is read: measure it, and wait on the plan queued with it (`planJobId`). With none,
   * the plan fails (`notQueued`) and the newest inputs are asked for.
   */
  | { step: 'analyzed'; planJobId: string | null }
  /** The job ended or is forgotten: read the times of its plan, `planId` (`timesStep`). */
  | { step: 'readTimes'; planId: string }

/** The step a waiting part takes, given Toolpath's answer about its job. */
export const jobStep = (part: WaitingFacts): JobStep => {
  const wait = { step: 'wait', notePlanned: false } as const
  if (part.pipeline === 'sending') {
    return part.heldMs > SENDING_MS
      ? { step: 'fail', pipeline: 'plan_failed', error: SEND_LOST, settle: false }
      : wait
  }
  const { job } = part
  if (!job) {
    return wait
  }
  if (job.status === 'queued' || job.status === 'running') {
    // A queued job has written no plan yet; a running one may have.
    return {
      step: 'wait',
      notePlanned:
        job.status === 'running' &&
        part.pipeline === 'planning' &&
        Boolean(part.planId) &&
        part.plannedJobId === null,
    }
  }
  if (part.pipeline === 'analyzing') {
    return job.status === 'failed'
      ? { step: 'fail', pipeline: 'analysis_failed', error: job.error, settle: false }
      : { step: 'analyzed', planJobId: part.planJobId }
  }
  if (job.status === 'failed') {
    return { step: 'fail', pipeline: 'plan_failed', error: job.error, settle: true }
  }
  return part.planId
    ? { step: 'readTimes', planId: part.planId }
    : { step: 'fail', pipeline: 'plan_failed', error: JOB_LOST, settle: true }
}

/** Why an analysis read with no plan queued fails its plan: a stock it could not send says why. */
export const notQueued = (stock: StockOption | string | null): string =>
  typeof stock === 'string' ? stock : PLAN_NOT_QUEUED

/** How reading a finished plan's machining times went. */
export type TimesRead<Baseline> =
  | { state: 'ready'; baseline: Baseline }
  | { state: 'waiting' }
  | { state: 'failed'; message: string }

/** The step after reading an ended job's times (`timesStep`). */
export type TimesStep =
  /** Land them, measure the part, and ask for the newest inputs' run. */
  | { step: 'land' }
  /** Fail the plan, saying why, and ask for the newest inputs' run. */
  | { step: 'fail'; error: string }
  /** Stay as it is, for the next ask. */
  | { step: 'wait' }

/**
 * The step after reading the times of a job that ended (`readTimes`). Times not ready yet are
 * waited for — unless Toolpath no longer has the job, which no later ask would find either.
 */
export const timesStep = (jobStatus: JobAnswer['status'], read: TimesRead<unknown>): TimesStep => {
  if (read.state === 'ready') {
    return { step: 'land' }
  }
  if (read.state === 'failed') {
    return { step: 'fail', error: jobStatus === 'gone' ? JOB_LOST : read.message }
  }
  return jobStatus === 'gone' ? { step: 'fail', error: JOB_LOST } : { step: 'wait' }
}
