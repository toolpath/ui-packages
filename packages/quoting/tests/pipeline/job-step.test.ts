import { describe, expect, it } from 'vitest'
import {
  JOB_LOST,
  jobStep,
  notQueued,
  PLAN_NOT_QUEUED,
  SEND_LOST,
  SENDING_MS,
  timesStep,
  type WaitingFacts,
} from '../../src/pipeline'

const waiting = (over: Partial<WaitingFacts> = {}): WaitingFacts => ({
  pipeline: 'planning',
  heldMs: 0,
  job: { status: 'running', error: null },
  planJobId: null,
  planId: 'plan-1',
  plannedJobId: null,
  ...over,
})
const wait = { step: 'wait', notePlanned: false }

describe('a waiting part, given its job', () => {
  it('fails a hold whose request never said how sending went, and only once it is old', () => {
    const sending = waiting({ pipeline: 'sending', job: null })
    expect(jobStep({ ...sending, heldMs: SENDING_MS })).toEqual(wait)
    expect(jobStep({ ...sending, heldMs: SENDING_MS + 1 })).toEqual({
      step: 'fail',
      pipeline: 'plan_failed',
      error: SEND_LOST,
      settle: false,
    })
  })

  it('stays where Toolpath did not answer', () => {
    expect(jobStep(waiting({ job: null }))).toEqual(wait)
  })

  it('notes a plan Toolpath may have built under a running job, once, and only while planning', () => {
    expect(jobStep(waiting())).toEqual({ step: 'wait', notePlanned: true })
    expect(jobStep(waiting({ plannedJobId: 'j1' }))).toEqual(wait)
    expect(jobStep(waiting({ planId: null }))).toEqual(wait)
    expect(jobStep(waiting({ job: { status: 'queued', error: null } }))).toEqual(wait)
    expect(jobStep(waiting({ pipeline: 'analyzing' }))).toEqual(wait)
  })

  it('records a failed analysis with Toolpath’s words, and asks nothing more', () => {
    expect(
      jobStep(waiting({ pipeline: 'analyzing', job: { status: 'failed', error: 'Bad mesh' } })),
    ).toEqual({
      step: 'fail',
      pipeline: 'analysis_failed',
      error: 'Bad mesh',
      settle: false,
    })
  })

  it('moves an analyzed part on to the plan queued with it — or a forgotten analysis too', () => {
    for (const status of ['succeeded', 'gone'] as const) {
      const job = { status, error: null }
      expect(jobStep(waiting({ pipeline: 'analyzing', job, planJobId: 'p1' }))).toEqual({
        step: 'analyzed',
        planJobId: 'p1',
      })
    }
    expect(
      jobStep(waiting({ pipeline: 'analyzing', job: { status: 'succeeded', error: null } })),
    ).toEqual({ step: 'analyzed', planJobId: null })
  })

  it('says why no plan was queued with the analysis: its stock, or that none started', () => {
    expect(notQueued('Turn the box first.')).toBe('Turn the box first.')
    expect(notQueued(null)).toBe(PLAN_NOT_QUEUED)
    expect(notQueued({ mode: 'automaticFlatBar' })).toBe(PLAN_NOT_QUEUED)
  })

  it('records a refused plan with Toolpath’s words, then asks for the newest inputs', () => {
    expect(jobStep(waiting({ job: { status: 'failed', error: 'No tools' } }))).toEqual({
      step: 'fail',
      pipeline: 'plan_failed',
      error: 'No tools',
      settle: true,
    })
  })

  it('reads the times of a plan that finished, or whose job Toolpath forgot', () => {
    expect(jobStep(waiting({ job: { status: 'succeeded', error: null } }))).toEqual({
      step: 'readTimes',
      planId: 'plan-1',
    })
    expect(jobStep(waiting({ job: { status: 'gone', error: null } }))).toEqual({
      step: 'readTimes',
      planId: 'plan-1',
    })
  })

  it('fails a plan with no plan to read times from, so it can be tried again', () => {
    for (const job of [
      { status: 'succeeded', error: null },
      { status: 'gone', error: null },
    ] as const) {
      expect(jobStep(waiting({ job, planId: null }))).toEqual({
        step: 'fail',
        pipeline: 'plan_failed',
        error: JOB_LOST,
        settle: true,
      })
    }
  })

  it('asks Toolpath nothing about a send: a job read for it is passed over', () => {
    const failed = { status: 'failed', error: 'No tools' } as const
    expect(jobStep(waiting({ pipeline: 'sending', job: failed }))).toEqual(wait)
  })
})

describe('an ended job’s times', () => {
  it('land when they are ready, the job finished or forgotten', () => {
    for (const job of ['succeeded', 'gone'] as const) {
      expect(timesStep(job, { state: 'ready', baseline: {} })).toEqual({ step: 'land' })
    }
  })

  it('fail with Toolpath’s words, or as lost where it forgot the job', () => {
    const failed = { state: 'failed', message: 'Could not plan.' } as const
    expect(timesStep('succeeded', failed)).toEqual({ step: 'fail', error: 'Could not plan.' })
    expect(timesStep('gone', failed)).toEqual({ step: 'fail', error: JOB_LOST })
  })

  it('wait where Toolpath did not answer — unless it forgot the job, which no later ask finds', () => {
    expect(timesStep('succeeded', { state: 'waiting' })).toEqual({ step: 'wait' })
    expect(timesStep('gone', { state: 'waiting' })).toEqual({ step: 'fail', error: JOB_LOST })
  })
})
