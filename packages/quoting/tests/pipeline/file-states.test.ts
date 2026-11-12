import { describe, expect, it } from 'vitest'
import { runStatusOf } from '../../src/model/artifact-state'
import { MODEL_FAILED, MODEL_UNREAD, moveFor, planDetailOf } from '../../src/model/part-stage'
import {
  canRetry,
  hasTimes,
  heldPipeline,
  holdingOf,
  initialPipeline,
  isAnalyzed,
  isEditLocked,
  isWaiting,
  modelOf,
  partStateOf,
  type PartStateInput,
  type SendHolding,
} from '../../src/model/part-state'
import {
  FILE_SEND_LOST,
  INSPECTION_LOST,
  inspectedStep,
  inspectionError,
  isWaitingPart,
  jobStep,
  MAX_FILE_PARTS,
  MODEL_SEND_LOST,
  NO_SOLID_BODIES,
  runDecision,
  SEND_LOST,
  SENDING_MS,
  toolpathHas,
  type WaitingFacts,
} from '../../src/pipeline'

/*
  A part uploaded as a file: read for its bodies (`inspecting`) before any is a part at Toolpath,
  and failed (`inspection_failed`) where it could not be read or made parts of.
*/

const input = (over: Partial<PartStateInput> = {}): PartStateInput => ({
  pipeline: 'inspecting',
  pipelineError: null,
  timed: false,
  edited: false,
  runCurrent: false,
  stage: 'setup',
  estimateComplete: false,
  ...over,
})

const inspecting = (over: Partial<WaitingFacts> = {}): WaitingFacts => ({
  pipeline: 'inspecting',
  heldMs: 0,
  job: { status: 'running', error: null },
  planJobId: null,
  planId: null,
  plannedJobId: null,
  ...over,
})

describe('a file’s part state', () => {
  it('starts inspecting on the inspection job, ahead of any analysis', () => {
    expect(initialPipeline(null, 'inspect-1')).toEqual({
      pipeline: 'inspecting',
      pipelineJobId: 'inspect-1',
      pipelineError: null,
    })
    // A part with no file to inspect starts as it always did.
    expect(initialPipeline('analysis-1')).toEqual({
      pipeline: 'analyzing',
      pipelineJobId: 'analysis-1',
      pipelineError: null,
    })
  })

  it('waits while the file is read, with no model, times or edits yet', () => {
    const state = partStateOf(input())
    expect(state).toEqual({ kind: 'inspecting' })
    expect(isWaiting(state)).toBe(true)
    expect(isEditLocked(state, false)).toBe(true)
    expect(modelOf(state)).toBe('waiting')
    expect(isAnalyzed(state)).toBe(false)
    expect(hasTimes(state)).toBe(false)
    expect(canRetry(state)).toBe(false)
  })

  it('fails with Toolpath’s words, or its own where there are none, and can be tried again', () => {
    const refused = partStateOf(
      input({ pipeline: 'inspection_failed', pipelineError: NO_SOLID_BODIES }),
    )
    expect(refused).toEqual({ kind: 'inspection_failed', error: NO_SOLID_BODIES })
    expect(partStateOf(input({ pipeline: 'inspection_failed' }))).toEqual({
      kind: 'inspection_failed',
      error: 'Toolpath could not read this file.',
    })
    expect(canRetry(refused)).toBe(true)
    expect(isWaiting(refused)).toBe(false)
    expect(modelOf(refused)).toBe('failed')
    expect(isAnalyzed(refused)).toBe(false)
  })

  it('reads as a run pending or failed, of no inputs', () => {
    expect(runStatusOf('inspecting')).toBe('pending')
    expect(runStatusOf('inspection_failed')).toBe('failed')
  })

  it('reads on the Plan page as the model being read, or failed', () => {
    expect(planDetailOf({ stage: 'setup', state: { kind: 'inspecting' }, plan: 'pending' })).toBe(
      'reading',
    )
    expect(
      planDetailOf({
        stage: 'review',
        state: { kind: 'inspection_failed', error: 'x' },
        plan: 'not-requested',
      }),
    ).toBe('failed')
  })

  it('moves on the Plan page, and is refused a price until it is a part that has been read', () => {
    const at = (state: Parameters<typeof moveFor>[0]['state']) =>
      ({ stage: 'setup', state, estimate: 'not-requested' }) as const
    expect(moveFor(at({ kind: 'inspecting' }), 'review')).toEqual({ kind: 'move' })
    expect(moveFor(at({ kind: 'inspecting' }), 'estimate')).toEqual({
      kind: 'refused',
      reason: MODEL_UNREAD,
    })
    expect(moveFor(at({ kind: 'inspection_failed', error: 'x' }), 'quote')).toEqual({
      kind: 'refused',
      reason: MODEL_FAILED,
    })
  })
})

describe('a file, given its inspection job', () => {
  it('is followed as a part Toolpath has, and is busy to writes', () => {
    expect(toolpathHas('inspecting')).toBe(true)
    expect(toolpathHas('inspection_failed')).toBe(false)
    expect(
      isWaitingPart({ pipeline: 'inspecting', pipelineJobId: 'inspect-1', directionsJobId: null }),
    ).toBe(true)
  })

  it('waits while the inspection is queued or running, or nothing was heard', () => {
    const wait = { step: 'wait', notePlanned: false }
    expect(jobStep(inspecting())).toEqual(wait)
    expect(jobStep(inspecting({ job: { status: 'queued', error: null } }))).toEqual(wait)
    expect(jobStep(inspecting({ job: null }))).toEqual(wait)
  })

  it('reads the file’s bodies once the inspection ended, or Toolpath no longer has its job', () => {
    expect(jobStep(inspecting({ job: { status: 'succeeded', error: null } }))).toEqual({
      step: 'inspected',
    })
    expect(jobStep(inspecting({ job: { status: 'gone', error: null } }))).toEqual({
      step: 'inspected',
    })
  })

  it('fails a failed inspection with Toolpath’s words, a file of no solid body in the app’s', () => {
    expect(jobStep(inspecting({ job: { status: 'failed', error: 'unreadable_file' } }))).toEqual({
      step: 'fail',
      pipeline: 'inspection_failed',
      error: 'unreadable_file',
      settle: false,
    })
    expect(
      jobStep(
        inspecting({
          job: { status: 'failed', error: 'no_solid_bodies: the file holds no solid body' },
        }),
      ),
    ).toMatchObject({ pipeline: 'inspection_failed', error: NO_SOLID_BODIES })
    expect(inspectionError(null)).toBeNull()
  })

  it('fails a lost send by what it carried: the file’s parts, a new part’s model, or a plan', () => {
    const lost = (holding?: WaitingFacts['holding']) =>
      jobStep(inspecting({ pipeline: 'sending', job: null, heldMs: SENDING_MS + 1, holding }))
    expect(lost('file')).toEqual({
      step: 'fail',
      pipeline: 'inspection_failed',
      error: FILE_SEND_LOST,
      settle: false,
    })
    expect(lost('model')).toEqual({
      step: 'fail',
      pipeline: 'analysis_failed',
      error: MODEL_SEND_LOST,
      settle: false,
    })
    expect(lost()).toEqual({
      step: 'fail',
      pipeline: 'plan_failed',
      error: SEND_LOST,
      settle: false,
    })
  })
})

describe('what an inspected file is made', () => {
  it('makes a part of each shape, however many bodies, up to what one request makes', () => {
    expect(inspectedStep({ bodies: 1, shapes: 1 })).toEqual({ step: 'make' })
    // Four copies of one shape: one part, counted four times per assembly.
    expect(inspectedStep({ bodies: 4, shapes: 1 })).toEqual({ step: 'make' })
    expect(inspectedStep({ bodies: 5, shapes: 3 })).toEqual({ step: 'make' })
    expect(inspectedStep({ bodies: 200, shapes: MAX_FILE_PARTS })).toEqual({ step: 'make' })
    expect(inspectedStep({ bodies: 200, shapes: MAX_FILE_PARTS + 1 })).toEqual({
      step: 'fail',
      error: 'This file has 101 distinct bodies. At most 100 can be quoted from one file.',
    })
  })

  it('fails a file with no bodies listed: its inspection was lost', () => {
    expect(inspectedStep({ bodies: 0, shapes: 0 })).toEqual({
      step: 'fail',
      error: INSPECTION_LOST,
    })
  })
})

describe('a part held for a send, by what the send carries', () => {
  const sending = (holding?: SendHolding) => partStateOf(input({ pipeline: 'sending', holding }))

  it('reads a file’s parts being made as the file still being read', () => {
    expect(sending('file')).toEqual({ kind: 'inspecting' })
  })

  it('reads a new part’s first analysis being sent as its model being read: no model, no price', () => {
    const state = sending('model')
    expect(state).toEqual({ kind: 'analyzing' })
    expect(modelOf(state)).toBe('waiting')
    const at = { stage: 'setup', state, estimate: 'not-requested' } as const
    expect(moveFor(at, 'estimate')).toEqual({ kind: 'refused', reason: MODEL_UNREAD })
  })

  it('reads every other send as before', () => {
    expect(sending()).toEqual({ kind: 'planning' })
    expect(sending('plan')).toEqual({ kind: 'planning' })
    expect(partStateOf(input({ pipeline: 'sending', holding: 'plan', timed: true }))).toEqual({
      kind: 'updating',
    })
    expect(heldPipeline('analyzing', 'file')).toBe('analyzing')
  })

  it('carries a file not made a part, a part not analyzed, or a plan', () => {
    const none = { engineFileId: null, enginePartId: null, analysisJobId: null }
    expect(holdingOf(none)).toBe('plan')
    expect(holdingOf({ ...none, enginePartId: 'p', analysisJobId: null })).toBe('plan')
    expect(holdingOf({ ...none, engineFileId: 'f' })).toBe('file')
    expect(holdingOf({ ...none, engineFileId: 'f', enginePartId: 'p' })).toBe('model')
    expect(holdingOf({ engineFileId: 'f', enginePartId: 'p', analysisJobId: 'a' })).toBe('plan')
  })
})

describe('the run a file’s part needs', () => {
  const facts = {
    current: 'now',
    runFingerprint: null,
    baseline: null,
    planned: false,
    made: true,
  }

  it('is the file tried again, only when a person asks', () => {
    expect(runDecision({ ...facts, pipeline: 'inspection_failed', tryAgain: true })).toBe(
      'reinspect',
    )
    expect(runDecision({ ...facts, pipeline: 'inspection_failed', tryAgain: false })).toBe('wait')
  })

  it('is nothing while the file is read', () => {
    expect(runDecision({ ...facts, pipeline: 'inspecting', tryAgain: true })).toBe('pending')
  })
})
