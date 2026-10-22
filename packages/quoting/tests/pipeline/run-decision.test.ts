import { describe, expect, it } from 'vitest'
import {
  baselineFacts,
  baselineFingerprint,
  changedFrom,
  hasPlanned,
  isWaitingPart,
  runDecision,
  timesChangedFrom,
  toolpathHas,
  type RunFacts,
} from '../../src/pipeline'

/** A part whose inputs are `now`, its last run landed for them, with no times yet. */
const facts = (over: Partial<RunFacts> = {}): RunFacts => ({
  current: 'now',
  pipeline: 'ready',
  runFingerprint: 'now',
  baseline: null,
  planned: false,
  tryAgain: true,
  ...over,
})
const timed = (fingerprint: string | null, withoutPlan = false) => ({ fingerprint, withoutPlan })

describe('the run the inputs need', () => {
  it('is nothing when the plan is of the inputs as they stand', () => {
    expect(runDecision(facts({ baseline: timed('now') }))).toBe('available')
  })

  it('is nothing while a run is on its way: it asks for the newest inputs once it ends', () => {
    for (const pipeline of ['analyzing', 'planning', 'sending'] as const) {
      expect(runDecision(facts({ pipeline, runFingerprint: 'older' }))).toBe('pending')
    }
  })

  it('is a plan when there is none of them: never asked, or asked of older inputs', () => {
    expect(runDecision(facts({ runFingerprint: null }))).toBe('start')
    expect(runDecision(facts({ baseline: timed('older') }))).toBe('start')
  })

  it('is a plan for a part priced without one: an estimate of its inputs, but no plan of them', () => {
    expect(runDecision(facts({ baseline: timed('now', true) }))).toBe('start')
  })

  it('is the plan already there once the run for these inputs has planned its setups', () => {
    expect(runDecision(facts({ pipeline: 'planning', planned: true }))).toBe('available')
    expect(
      runDecision(facts({ pipeline: 'planning', planned: true, runFingerprint: 'older' })),
    ).toBe('pending')
  })

  it('reads a model Toolpath could not read again, with its plan', () => {
    expect(runDecision(facts({ pipeline: 'analysis_failed' }))).toBe('reanalyze')
  })

  it('sends again after a run of them that failed, when a person asks: failed is not pending', () => {
    for (const pipeline of ['plan_failed', 'gone'] as const) {
      expect(runDecision(facts({ pipeline }))).toBe('start')
    }
  })

  it('sends nothing for a save that left a failed run’s inputs as they were: Try again does', () => {
    for (const pipeline of ['plan_failed', 'analysis_failed', 'gone'] as const) {
      expect(runDecision(facts({ pipeline, tryAgain: false }))).toBe('wait')
      // The same failure, its plan there all along: still nothing sent.
      expect(runDecision(facts({ pipeline, tryAgain: false, baseline: timed('now') }))).toBe('wait')
      expect(runDecision(facts({ pipeline, tryAgain: false, planned: true }))).toBe('wait')
    }
  })

  it('asks for a save of other inputs after a run that failed, as a new plan', () => {
    expect(
      runDecision(facts({ pipeline: 'plan_failed', runFingerprint: 'older', tryAgain: false })),
    ).toBe('start')
    expect(runDecision(facts({ tryAgain: false, baseline: timed('now') }))).toBe('available')
  })
})

describe('whether the page shows the part’s inputs', () => {
  it('reads times of other inputs, or priced without a plan, as changed', () => {
    expect(timesChangedFrom('now', timed('now'))).toBe(false)
    expect(timesChangedFrom('now', timed('older'))).toBe(true)
    expect(timesChangedFrom('now', timed('now', true))).toBe(true)
    expect(timesChangedFrom('now', null)).toBe(true)
    expect(timesChangedFrom('now', timed(null))).toBe(true)
  })

  it('reads the planned run’s inputs once it has planned its setups, the times’ until then', () => {
    const run = { runFingerprint: 'now', planned: true }
    expect(changedFrom('now', run, timed('older'))).toBe(false)
    expect(changedFrom('newer', run, timed('newer'))).toBe(true)
    expect(changedFrom('now', { ...run, planned: false }, timed('older'))).toBe(true)
    expect(changedFrom('now', { ...run, planned: false }, timed('now'))).toBe(false)
  })
})

describe('a part’s columns', () => {
  it('say Toolpath has the part while it is analyzed, planned or sent', () => {
    expect(['analyzing', 'planning', 'sending'].every((p) => toolpathHas(p as never))).toBe(true)
    expect(
      ['analysis_failed', 'plan_failed', 'ready', 'gone'].some((p) => toolpathHas(p as never)),
    ).toBe(false)
  })

  it('say a run has planned its setups only under the job the part waits on', () => {
    expect(hasPlanned({ plannedJobId: 'j1', pipelineJobId: 'j1' })).toBe(true)
    expect(hasPlanned({ plannedJobId: 'j1', pipelineJobId: 'j2' })).toBe(false)
    expect(hasPlanned({ plannedJobId: null, pipelineJobId: null })).toBe(false)
    expect(hasPlanned({})).toBe(false)
  })

  it('say a part is worth asking about while it waits on a job or a directions analysis', () => {
    const part = { pipeline: 'planning', pipelineJobId: 'j1', directionsJobId: null } as const
    expect(isWaitingPart(part)).toBe(true)
    expect(isWaitingPart({ ...part, pipelineJobId: null })).toBe(false)
    expect(isWaitingPart({ ...part, pipeline: 'ready' })).toBe(false)
    expect(isWaitingPart({ ...part, pipeline: 'ready', directionsJobId: 'd1' })).toBe(true)
  })

  it('read a baseline’s stamp, and only `true` as priced without a plan', () => {
    expect(baselineFacts(null)).toBeNull()
    expect(baselineFacts({ fingerprint: 'f', withoutPlan: true })).toEqual(timed('f', true))
    expect(baselineFacts({ fingerprint: 3, withoutPlan: 'yes' })).toEqual(timed(null))
    expect(baselineFacts({})).toEqual(timed(null))
    expect(baselineFingerprint(undefined)).toBeNull()
  })
})
