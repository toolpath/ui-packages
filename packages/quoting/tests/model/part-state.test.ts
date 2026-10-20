import { describe, expect, it } from 'vitest'
import {
  canEstimateWithoutTimes,
  initialPipeline,
  isSignedOff,
  isWaiting,
  modelOf,
  partStateOf,
  type PartState,
  type PartStateInput,
} from '../../src/model/part-state'

const input = (overrides: Partial<PartStateInput> = {}): PartStateInput => ({
  pipeline: 'ready',
  pipelineError: null,
  timed: true,
  edited: false,
  runCurrent: true,
  stage: 'setup',
  estimateComplete: false,
  ...overrides,
})

describe('a part’s state', () => {
  it('waits on Toolpath while its job runs, the first time or with times kept', () => {
    expect(partStateOf(input({ pipeline: 'analyzing', timed: false }))).toEqual({
      kind: 'analyzing',
    })
    expect(partStateOf(input({ pipeline: 'planning', timed: false }))).toEqual({
      kind: 'planning',
    })
    // An edited plan being planned keeps the last times: it is updating, not planning afresh.
    expect(partStateOf(input({ pipeline: 'planning' }))).toEqual({ kind: 'updating' })
  })

  it('says why Toolpath refused, keeping the last times where it has them', () => {
    expect(
      partStateOf(input({ pipeline: 'plan_failed', timed: false, pipelineError: 'boom' })),
    ).toEqual({ kind: 'plan_failed', error: 'boom' })
    expect(partStateOf(input({ pipeline: 'plan_failed', pipelineError: 'boom' }))).toEqual({
      kind: 'update_failed',
      error: 'boom',
    })
    expect(partStateOf(input({ pipeline: 'analysis_failed', timed: false }))).toMatchObject({
      kind: 'analysis_failed',
    })
    expect(partStateOf(input({ pipeline: 'gone' }))).toEqual({ kind: 'gone' })
  })

  it('reads a failed plan of inputs since moved on from by its times, not as the failure', () => {
    const stale = { pipelineError: 'boom', runCurrent: false }
    expect(partStateOf(input({ ...stale, pipeline: 'plan_failed' }))).toEqual({
      kind: 'priced',
      review: 'new',
      edited: false,
    })
    expect(partStateOf(input({ ...stale, pipeline: 'gone', edited: true }))).toMatchObject({
      kind: 'priced',
      edited: true,
    })
    // The model is the part's whatever its inputs; with no times there is nothing else to read.
    expect(partStateOf(input({ ...stale, pipeline: 'analysis_failed' }))).toMatchObject({
      kind: 'analysis_failed',
    })
    expect(partStateOf(input({ ...stale, pipeline: 'plan_failed', timed: false }))).toEqual({
      kind: 'plan_failed',
      error: 'boom',
    })
  })

  it('reads its review from its stage and the approval, and New when edited', () => {
    expect(partStateOf(input())).toEqual({ kind: 'priced', review: 'new', edited: false })
    expect(partStateOf(input({ stage: 'review' }))).toMatchObject({ review: 'new' })
    expect(partStateOf(input({ stage: 'estimate' }))).toMatchObject({ review: 'confirmed' })
    expect(partStateOf(input({ stage: 'quote', estimateComplete: true }))).toMatchObject({
      review: 'approved',
    })
    // An estimate complete on a part not moved to Quote is not signed off, nor Quote without one.
    expect(partStateOf(input({ estimateComplete: true }))).toMatchObject({ review: 'new' })
    expect(partStateOf(input({ stage: 'quote' }))).toMatchObject({ review: 'confirmed' })
    expect(partStateOf(input({ stage: 'quote', estimateComplete: true, edited: true }))).toEqual({
      kind: 'priced',
      review: 'new',
      edited: true,
    })
  })

  it('reads a ready part with no times as one Toolpath could not plan', () => {
    expect(partStateOf(input({ timed: false }))).toMatchObject({ kind: 'plan_failed' })
  })

  it('is signed off only when priced from its own plan and approved', () => {
    const approved = partStateOf(input({ stage: 'quote', estimateComplete: true }))
    expect(isSignedOff(approved)).toBe(true)
    expect(isSignedOff({ kind: 'updating' })).toBe(false)
    expect(isSignedOff({ kind: 'priced', review: 'approved', edited: true })).toBe(false)
  })

  it('says when it waits, and whether its model can be read', () => {
    const waits: Array<PartState> = [
      { kind: 'analyzing' },
      { kind: 'planning' },
      { kind: 'updating' },
    ]
    expect(waits.every(isWaiting)).toBe(true)
    expect(isWaiting({ kind: 'plan_failed', error: '' })).toBe(false)
    expect(modelOf({ kind: 'analyzing' })).toBe('waiting')
    expect(modelOf({ kind: 'planning' })).toBe('ready')
    expect(modelOf({ kind: 'analysis_failed', error: '' })).toBe('failed')
  })

  it('starts an uploaded part analyzing, and one with no file as nothing to machine', () => {
    expect(initialPipeline('job-1')).toEqual({
      pipeline: 'analyzing',
      pipelineJobId: 'job-1',
      pipelineError: null,
    })
    expect(initialPipeline(null)).toMatchObject({ pipeline: 'plan_failed', pipelineJobId: null })
  })
})

describe('estimating without times', () => {
  it('is offered for a part stuck on its plan, with or without earlier times', () => {
    const stuck: Array<PartState> = [
      { kind: 'planning' },
      { kind: 'plan_failed', error: 'x' },
      { kind: 'updating' },
      { kind: 'update_failed', error: 'x' },
    ]
    const not: Array<PartState> = [
      { kind: 'analyzing' },
      { kind: 'analysis_failed', error: 'x' },
      { kind: 'gone' },
      { kind: 'priced', review: 'new', edited: false },
      // An edit the person made is not a stuck plan: confirming it is the way on.
      { kind: 'priced', review: 'new', edited: true },
    ]
    expect(stuck.map(canEstimateWithoutTimes)).toEqual([true, true, true, true])
    expect(not.map(canEstimateWithoutTimes)).toEqual([false, false, false, false, false])
  })
})
