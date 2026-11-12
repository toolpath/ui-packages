import type { PlanStock } from '../inputs/stock'
import type { SendHolding } from '../model/part-state'
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

/**
 * What a part's plan says when no plan was queued with its analysis, and its stock is not why: kept
 * only where the plan sent once the model is read is not sent after all — a plan of those inputs
 * there already, or the quote revised meanwhile. One sent says how it went instead.
 */
export const PLAN_NOT_QUEUED = 'Could not start the machining-time calculation for this part.'

/** What a new part of a file says when sending its analysis and plan never finished. */
export const MODEL_SEND_LOST = 'Sending the part to Toolpath did not finish. Try again to send it.'

/** What a file says when making its parts never finished. */
export const FILE_SEND_LOST = 'Making parts of this file did not finish. Try again.'

/** What a file says when Toolpath listed none of its bodies: the job reading it is gone. */
export const INSPECTION_LOST =
  'Toolpath no longer has the job reading this file. Try again to read it.'

/** What a file says when Toolpath found no solid body in it (`no_solid_bodies`). */
export const NO_SOLID_BODIES = 'Toolpath found no solid body in this file.'

/** How many parts one file may be made into: what Toolpath makes from a file in one request. */
export const MAX_FILE_PARTS = 100

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
  /**
   * What a send (`sending`) carries (`holdingOf`), which says where a lost one leaves the part: a
   * file's parts being made, a new part's first analysis and plan, or a plan — the default.
   */
  holding?: SendHolding
}

/** The step a waiting part takes (`jobStep`). */
export type JobStep =
  /** Stay as it is, for the next ask. `notePlanned`: read whether Toolpath has planned its setups. */
  | { step: 'wait'; notePlanned: boolean }
  /** Fail, saying why; `settle`: then ask for the newest inputs' run (`runDecision`). */
  | {
      step: 'fail'
      pipeline: 'inspection_failed' | 'analysis_failed' | 'plan_failed'
      error: string | null
      settle: boolean
    }
  /**
   * The file's inspection ended, or Toolpath no longer has its job: read its bodies, and make parts
   * of them as `inspectedStep` says.
   */
  | { step: 'inspected' }
  /**
   * The model is read: measure it, and wait on the plan queued with it (`planJobId`). With none,
   * the part is taken off its job: a stock that could not be sent fails its plan saying why
   * (`notQueued`), and a part not made fails it as not made; otherwise its plan is sent now, from
   * its inputs as they stand — Toolpath refused the one sent with the analysis, slowing the key
   * down, say — and a refusal fails it in Toolpath's words. Then the newest inputs are asked for.
   */
  | { step: 'analyzed'; planJobId: string | null }
  /** The job ended or is forgotten: read the times of its plan, `planId` (`timesStep`). */
  | { step: 'readTimes'; planId: string }

/** The step a waiting part takes, given Toolpath's answer about its job. */
export const jobStep = (part: WaitingFacts): JobStep => {
  const wait = { step: 'wait', notePlanned: false } as const
  if (part.pipeline === 'sending') {
    return part.heldMs > SENDING_MS ? sendLost(part.holding ?? 'plan') : wait
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
  if (part.pipeline === 'inspecting') {
    return job.status === 'failed'
      ? {
          step: 'fail',
          pipeline: 'inspection_failed',
          error: inspectionError(job.error),
          settle: false,
        }
      : { step: 'inspected' }
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

/** Where a send that never said how it went leaves the part, by what it carried. */
const sendLost = (holding: SendHolding): JobStep => {
  switch (holding) {
    case 'file':
      return { step: 'fail', pipeline: 'inspection_failed', error: FILE_SEND_LOST, settle: false }
    case 'model':
      return { step: 'fail', pipeline: 'analysis_failed', error: MODEL_SEND_LOST, settle: false }
    case 'plan':
      return { step: 'fail', pipeline: 'plan_failed', error: SEND_LOST, settle: false }
  }
}

/** A failed inspection's error, in the words the part shows: Toolpath's own, but for no bodies. */
export const inspectionError = (error: string | null): string | null =>
  error?.startsWith('no_solid_bodies') ? NO_SOLID_BODIES : error

/** What `inspectedStep` reads of a file whose inspection ended. */
export interface InspectedFacts {
  /** How many solid bodies Toolpath listed in the file, copies included: none when it listed none. */
  bodies: number
  /** How many distinct shapes those bodies are. */
  shapes: number
}

/** What a file whose inspection ended takes: a part of each shape, or a failure saying why. */
export type InspectedStep = { step: 'make' } | { step: 'fail'; error: string }

/**
 * Whether a file's shapes are made parts: a part of each distinct shape, however many bodies the
 * file has, with no more than {@link MAX_FILE_PARTS} shapes. A file with no bodies listed lost its
 * inspection — one that succeeded lists at least one — and is tried again by a person. Nothing is
 * made of a file refused, so nothing is billed for it.
 */
export const inspectedStep = ({ bodies, shapes }: InspectedFacts): InspectedStep => {
  if (bodies === 0) {
    return { step: 'fail', error: INSPECTION_LOST }
  }
  if (shapes > MAX_FILE_PARTS) {
    return {
      step: 'fail',
      error: `This file has ${shapes} distinct bodies. At most ${MAX_FILE_PARTS} can be quoted from one file.`,
    }
  }
  return { step: 'make' }
}

/** Why an analysis read with no plan queued fails its plan: a stock it could not send says why. */
export const notQueued = (stock: PlanStock | string | null): string =>
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
