import { describe, expect, it } from 'vitest'
import type { ArtifactState } from '../../src/model/artifact-state'
import {
  asPartStage,
  isForward,
  moveFor,
  onPlanPage,
  PART_STAGES,
  planDetailOf,
  type PartStage,
  type StagedPart,
  type StageMove,
} from '../../src/model/part-stage'
import type { PartState } from '../../src/model/part-state'

const priced = (review: 'new' | 'confirmed' | 'approved', edited = false): PartState => ({
  kind: 'priced',
  review,
  edited,
})

/** A part in a stage, with its estimate for its inputs as they stand unless said otherwise. */
const at = (
  stage: PartStage,
  state: PartState,
  estimate: ArtifactState = state.kind === 'priced' && !state.edited
    ? 'available'
    : 'not-requested',
): StagedPart => ({ stage, state, estimate })

describe('the stages', () => {
  it('are four, in order, the first two the Plan page’s', () => {
    expect(PART_STAGES).toEqual(['setup', 'review', 'estimate', 'quote'])
    expect(PART_STAGES.map(onPlanPage)).toEqual([true, true, false, false])
    expect(isForward('setup', 'quote')).toBe(true)
    expect(isForward('estimate', 'review')).toBe(false)
    expect(isForward('review', 'review')).toBe(false)
  })

  it('read a stored stage as one of the four, an unknown one as Plan Part', () => {
    for (const stage of PART_STAGES) {
      expect(asPartStage(stage)).toBe(stage)
    }
    expect(asPartStage('')).toBe('setup')
    expect(asPartStage('shipped')).toBe('setup')
  })
})

describe('what a part on the Plan page waits on', () => {
  /** A part in a stage, its plan of its inputs as they stand when its estimate is. */
  const onPage = (stage: PartStage, state: PartState, plan?: ArtifactState) => {
    const staged = at(stage, state)
    return { ...staged, plan: plan ?? staged.estimate }
  }

  it.each<[PartState, string | null]>([
    [{ kind: 'analyzing' }, 'reading'],
    [{ kind: 'analysis_failed', error: 'x' }, 'failed'],
    [{ kind: 'planning' }, 'calculating'],
    [{ kind: 'plan_failed', error: 'x' }, 'failed'],
    [{ kind: 'updating' }, 'calculating'],
    [{ kind: 'update_failed', error: 'x' }, 'failed'],
    [{ kind: 'gone' }, 'failed'],
    [priced('new'), 'ready'],
    [priced('new', true), 'changed'],
  ])('%j reads %s, in Plan Part and Review Plan alike', (state, detail) => {
    expect(planDetailOf(onPage('setup', state))).toBe(detail)
    expect(planDetailOf(onPage('review', state))).toBe(detail)
  })

  it('is ready only with a plan of the part as it stands: priced without one, it needs calculating', () => {
    expect(planDetailOf(onPage('review', priced('new'), 'available'))).toBe('ready')
    expect(planDetailOf(onPage('review', priced('new'), 'not-requested'))).toBe('changed')
  })

  it('is nothing past the Plan page, whatever the state', () => {
    expect(planDetailOf(onPage('estimate', { kind: 'updating' }))).toBeNull()
    expect(planDetailOf(onPage('quote', priced('approved')))).toBeNull()
  })
})

describe('moving a part between stages', () => {
  const NO_READ: StageMove = { kind: 'refused', reason: 'The model is still being read.' }
  const NO_MODEL: StageMove = {
    kind: 'refused',
    reason: 'Try again first: Toolpath could not read the model.',
  }
  const move: StageMove = { kind: 'move' }
  const approve: StageMove = { kind: 'approve' }

  const blank: StageMove = { kind: 'withoutTimes' }

  /** What every pair of stages does for a part in a state: from → to, up or down, in one move. */
  const table = (
    state: PartState,
    estimate: ArtifactState,
    rows: Record<PartStage, Record<PartStage, Partial<StageMove> | null>>,
  ) => {
    for (const from of PART_STAGES) {
      for (const to of PART_STAGES) {
        const expected = rows[from][to]
        const actual = moveFor(at(from, state, estimate), to)
        if (expected === null) {
          expect(actual, `${from} → ${to}`).toBeNull()
        } else {
          expect(actual, `${from} → ${to}`).toMatchObject(expected)
        }
      }
    }
  }

  it('moves a priced part anywhere, approving into Quote, out of Quote with the move: nothing is sent', () => {
    table(priced('new'), 'available', {
      setup: { setup: null, review: move, estimate: move, quote: approve },
      review: { setup: move, review: null, estimate: move, quote: approve },
      estimate: { setup: move, review: move, estimate: null, quote: approve },
      quote: { setup: move, review: move, estimate: move, quote: approve },
    })
    // Approved already: nothing to do where it is.
    expect(moveFor(at('quote', priced('approved')), 'quote')).toBeNull()
  })

  it('moves an edited part anywhere too, into Quote with its approval waiting', () => {
    table(priced('new', true), 'not-requested', {
      setup: { setup: null, review: move, estimate: move, quote: move },
      review: { setup: move, review: null, estimate: move, quote: move },
      estimate: { setup: move, review: move, estimate: null, quote: move },
      quote: { setup: move, review: move, estimate: move, quote: null },
    })
  })

  it('moves a timed part whatever its run is doing: the estimate reads pending or failed', () => {
    table({ kind: 'updating' }, 'pending', {
      setup: { setup: null, review: move, estimate: move, quote: move },
      review: { setup: move, review: null, estimate: move, quote: move },
      estimate: { setup: move, review: move, estimate: null, quote: move },
      quote: { setup: move, review: move, estimate: move, quote: null },
    })
    expect(
      moveFor(at('review', { kind: 'update_failed', error: 'x' }, 'failed'), 'estimate'),
    ).toEqual(move)
  })

  it('estimates a part never timed — planning, or its plan refused — without times, blank', () => {
    table({ kind: 'planning' }, 'pending', {
      setup: { setup: null, review: move, estimate: blank, quote: move },
      review: { setup: move, review: null, estimate: blank, quote: move },
      estimate: { setup: move, review: move, estimate: null, quote: move },
      quote: { setup: move, review: move, estimate: move, quote: null },
    })
    expect(moveFor(at('setup', { kind: 'plan_failed', error: 'x' }), 'estimate')).toEqual(blank)
  })

  it('refuses to price a part whose model is unread, which may still move on the Plan page', () => {
    table({ kind: 'analyzing' }, 'not-requested', {
      setup: { setup: null, review: move, estimate: NO_READ, quote: NO_READ },
      review: { setup: move, review: null, estimate: NO_READ, quote: NO_READ },
      estimate: { setup: move, review: move, estimate: null, quote: NO_READ },
      quote: { setup: move, review: move, estimate: move, quote: null },
    })
    table({ kind: 'analysis_failed', error: 'x' }, 'not-requested', {
      setup: { setup: null, review: move, estimate: NO_MODEL, quote: NO_MODEL },
      review: { setup: move, review: null, estimate: NO_MODEL, quote: NO_MODEL },
      estimate: { setup: move, review: move, estimate: null, quote: NO_MODEL },
      quote: { setup: move, review: move, estimate: move, quote: null },
    })
  })

  it('refuses every move of a part Toolpath has let go', () => {
    table({ kind: 'gone' }, 'not-requested', {
      setup: { setup: null, review: NO_MODEL, estimate: NO_MODEL, quote: NO_MODEL },
      review: { setup: NO_MODEL, review: null, estimate: NO_MODEL, quote: NO_MODEL },
      estimate: { setup: NO_MODEL, review: NO_MODEL, estimate: null, quote: NO_MODEL },
      quote: { setup: NO_MODEL, review: NO_MODEL, estimate: NO_MODEL, quote: null },
    })
  })

  it('offers the approval alone to a part in Quote whose estimate landed since it moved there', () => {
    expect(moveFor(at('quote', priced('confirmed')), 'quote')).toEqual(approve)
    expect(moveFor(at('quote', priced('confirmed'), 'pending'), 'quote')).toBeNull()
    expect(moveFor(at('quote', priced('confirmed', true), 'not-requested'), 'quote')).toBeNull()
  })
})
