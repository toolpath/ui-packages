import { describe, expect, it } from 'vitest'
import type { ArtifactState } from '../../src/model/artifact-state'
import {
  assemblyMade,
  assemblySignedOff,
  assemblyStateOf,
  combinedArtifact,
  countOverridden,
  countPerAssembly,
  countRefusal,
  countWithdrawsApproval,
  deleteRefusal,
  LAST_MADE_DELETED,
  LAST_PART_MADE,
  NO_PART_MADE,
  noPartMarked,
  partMade,
  partMarked,
  UNMARKED_COUNTED,
  landingWithdrawsApproval,
  moveForAssembly,
  MAX_ASSEMBLY_COUNT,
  parseCountPerAssembly,
  partStateInAssembly,
  piecesOf,
  quotedAssemblyCounts,
  shapeDefaultCount,
  stockBodiesTakenOf,
  withCount,
  withdrawnApproval,
  type AssemblyMember,
  type PartCount,
} from '../../src/model/assembly-state'
import { MODEL_UNREAD, moveFor, PART_STAGES, type PartStage } from '../../src/model/part-stage'
import type { PartState } from '../../src/model/part-state'
import { quoteStatus } from '../../src/model/quote-status'

const priced = (review: 'new' | 'confirmed' | 'approved', edited = false): PartState => ({
  kind: 'priced',
  review,
  edited,
})

const member = (
  partId: string,
  state: PartState,
  estimate: ArtifactState = 'available',
  plan: ArtifactState = 'available',
  count = 1,
): AssemblyMember => ({ partId, state, estimate, plan, count })

/** A part counted 0: not made. */
const unmade = (partId: string, state: PartState): AssemblyMember =>
  member(partId, state, 'not-requested', 'not-requested', 0)

const ARTIFACTS: ReadonlyArray<ArtifactState> = ['not-requested', 'pending', 'failed', 'available']

describe('partStateInAssembly', () => {
  const ready = {
    pipeline: 'ready',
    pipelineError: null,
    timed: true,
    edited: false,
    runCurrent: true,
  } as const

  it('reads a part with its assembly’s stage and approval', () => {
    expect(partStateInAssembly(ready, { stage: 'quote', approved: true })).toEqual(
      priced('approved'),
    )
    expect(partStateInAssembly(ready, { stage: 'quote', approved: false })).toEqual(
      priced('confirmed'),
    )
    expect(partStateInAssembly(ready, { stage: 'review', approved: false })).toEqual(priced('new'))
  })

  it('reads a part edited since as new, whatever its assembly’s approval', () => {
    expect(
      partStateInAssembly({ ...ready, edited: true }, { stage: 'quote', approved: true }),
    ).toEqual(priced('new', true))
  })

  it('reads a held send as what it carries', () => {
    const held = { ...ready, pipeline: 'sending', timed: false } as const
    const assembly = { stage: 'setup', approved: false } as const
    expect(partStateInAssembly({ ...held, holding: 'file' }, assembly)).toEqual({
      kind: 'inspecting',
    })
    expect(partStateInAssembly({ ...held, holding: 'model' }, assembly)).toEqual({
      kind: 'analyzing',
    })
    expect(partStateInAssembly(held, assembly)).toEqual({ kind: 'planning' })
  })
})

describe('combinedArtifact', () => {
  it('is available only once every part’s is', () => {
    expect(combinedArtifact(['available', 'available'])).toBe('available')
    expect(combinedArtifact(['available'])).toBe('available')
  })

  it('reads none as not requested: an assembly with no part has nothing of its own', () => {
    expect(combinedArtifact([])).toBe('not-requested')
  })

  it.each(ARTIFACTS.flatMap((left) => ARTIFACTS.map((right) => [left, right] as const)))(
    'combines %s with %s as failed, then pending, then not requested',
    (left, right) => {
      const both = [left, right]
      const expected =
        left === 'available' && right === 'available'
          ? 'available'
          : both.includes('failed')
            ? 'failed'
            : both.includes('pending')
              ? 'pending'
              : 'not-requested'
      expect(combinedArtifact(both)).toBe(expected)
      // Order does not matter.
      expect(combinedArtifact([right, left])).toBe(expected)
    },
  )
})

describe('assemblyStateOf', () => {
  const ORDER: ReadonlyArray<PartState> = [
    { kind: 'gone' },
    { kind: 'inspection_failed', error: 'i' },
    { kind: 'analysis_failed', error: 'a' },
    { kind: 'plan_failed', error: 'p' },
    { kind: 'update_failed', error: 'u' },
    { kind: 'inspecting' },
    { kind: 'analyzing' },
    { kind: 'planning' },
    { kind: 'updating' },
    priced('new', true),
    priced('new'),
    priced('confirmed'),
    priced('approved'),
  ]

  it('is the worst part’s state, naming the part, whichever order they are in', () => {
    for (const [worse, state] of ORDER.entries()) {
      for (const better of ORDER.slice(worse + 1)) {
        const parts = [member('better', better), member('worse', state)]
        expect(assemblyStateOf(parts)).toEqual({ state, partId: 'worse' })
        expect(assemblyStateOf([...parts].reverse())).toEqual({ state, partId: 'worse' })
      }
    }
  })

  it('names the first of parts as bad as each other', () => {
    const parts = [member('a', priced('confirmed')), member('b', priced('confirmed'))]
    expect(assemblyStateOf(parts).partId).toBe('a')
  })

  it('is one part’s own state, for an assembly of one', () => {
    for (const state of ORDER) {
      expect(assemblyStateOf([member('only', state)])).toEqual({ state, partId: 'only' })
    }
  })

  it('reads only the parts made, while one is', () => {
    const parts = [unmade('stock', { kind: 'plan_failed', error: 'p' }), member('a', priced('new'))]
    expect(assemblyStateOf(parts)).toEqual({ state: priced('new'), partId: 'a' })
  })

  it('reads every part where none is made, and gone with no part, naming none', () => {
    const parts = [unmade('a', priced('new')), unmade('b', { kind: 'planning' })]
    expect(assemblyStateOf(parts)).toEqual({ state: { kind: 'planning' }, partId: 'b' })
    expect(assemblyStateOf([])).toEqual({ state: { kind: 'gone' }, partId: null })
  })
})

describe('assemblySignedOff', () => {
  it('is signed off only with parts, every one priced as it stands and approved', () => {
    expect(assemblySignedOff([member('a', priced('approved'))])).toBe(true)
    expect(
      assemblySignedOff([member('a', priced('approved')), member('b', priced('approved'))]),
    ).toBe(true)
    expect(
      assemblySignedOff([member('a', priced('approved')), member('b', priced('confirmed'))]),
    ).toBe(false)
    expect(assemblySignedOff([member('a', priced('approved', true))])).toBe(false)
    expect(assemblySignedOff([member('a', { kind: 'updating' })])).toBe(false)
    expect(assemblySignedOff([])).toBe(false)
  })

  it('needs no plan of a part not made, but a part made', () => {
    expect(
      assemblySignedOff([member('a', priced('approved')), unmade('b', { kind: 'analyzing' })]),
    ).toBe(true)
    expect(assemblySignedOff([unmade('a', priced('approved'))])).toBe(false)
  })
})

describe('moveForAssembly', () => {
  /** Every state a part can stand in, with each estimate it could have. */
  const STATES: ReadonlyArray<PartState> = [
    { kind: 'inspecting' },
    { kind: 'inspection_failed', error: 'i' },
    { kind: 'analyzing' },
    { kind: 'analysis_failed', error: 'a' },
    { kind: 'planning' },
    { kind: 'plan_failed', error: 'p' },
    { kind: 'gone' },
    priced('new'),
    priced('confirmed'),
    priced('approved'),
    priced('new', true),
    { kind: 'updating' },
    { kind: 'update_failed', error: 'u' },
  ]
  const MEMBERS = STATES.flatMap((state) =>
    (['available', 'pending'] as const).map((estimate) => ({ state, estimate })),
  )
  const moves = PART_STAGES.flatMap((from) => PART_STAGES.map((to) => [from, to] as const))

  it('is the part’s own move for an assembly of one, every stage to every stage', () => {
    for (const [from, to] of moves) {
      for (const { state, estimate } of MEMBERS) {
        const own = moveFor({ stage: from, state, estimate }, to)
        const combined = moveForAssembly(from, [member('p', state, estimate)], to)
        expect(combined).toEqual(own?.kind === 'refused' ? { ...own, partId: 'p' } : own)
      }
    }
  })

  it('combines two parts: the first refusal, then without times, then approve only if both would', () => {
    for (const [from, to] of moves) {
      for (const first of MEMBERS) {
        for (const second of MEMBERS) {
          const own = [first, second].map(({ state, estimate }) =>
            moveFor({ stage: from, state, estimate }, to),
          )
          const parts = [
            member('one', first.state, first.estimate),
            member('two', second.state, second.estimate),
          ]
          const refusedAt = own.findIndex((move) => move?.kind === 'refused')
          const refused = own[refusedAt]
          const expected =
            refused?.kind === 'refused'
              ? { kind: 'refused', reason: refused.reason, partId: ['one', 'two'][refusedAt] }
              : own.some((move) => move?.kind === 'withoutTimes')
                ? { kind: 'withoutTimes' }
                : own.every((move) => move?.kind === 'approve')
                  ? { kind: 'approve' }
                  : own.some((move) => move === null)
                    ? null
                    : { kind: 'move' }
          expect(moveForAssembly(from, parts, to)).toEqual(expected)
        }
      }
    }
  })

  it('names the part refused, not the first part', () => {
    const parts = [member('fine', priced('confirmed')), member('unread', { kind: 'analyzing' })]
    expect(moveForAssembly('setup', parts, 'estimate')).toEqual({
      kind: 'refused',
      reason: MODEL_UNREAD,
      partId: 'unread',
    })
  })

  it('approves into Quote only when every part’s estimate is available; else it moves', () => {
    const ready = member('a', priced('confirmed'))
    expect(moveForAssembly('estimate', [ready, member('b', priced('confirmed'))], 'quote')).toEqual(
      { kind: 'approve' },
    )
    expect(
      moveForAssembly(
        'estimate',
        [ready, member('b', priced('confirmed', true), 'not-requested')],
        'quote',
      ),
    ).toEqual({ kind: 'move' })
  })

  it('prices without times where any part was never timed', () => {
    const parts = [member('timed', priced('new')), member('never', { kind: 'planning' }, 'pending')]
    expect(moveForAssembly('review', parts, 'estimate')).toEqual({ kind: 'withoutTimes' })
  })

  it('asks no part not made', () => {
    const parts = [member('a', priced('confirmed')), unmade('b', { kind: 'analyzing' })]
    expect(moveForAssembly('estimate', parts, 'quote')).toEqual({ kind: 'approve' })
  })

  it('goes only back to Plan Part with no part made', () => {
    for (const parts of [[], [unmade('a', priced('confirmed'))]]) {
      for (const from of PART_STAGES) {
        for (const to of ['review', 'estimate', 'quote'] as Array<PartStage>) {
          if (from !== to) {
            expect(moveForAssembly(from, parts, to)).toEqual({
              kind: 'refused',
              reason: NO_PART_MADE,
              partId: null,
            })
          }
        }
      }
      expect(moveForAssembly('review', parts, 'setup')).toEqual({ kind: 'move' })
      expect(moveForAssembly('setup', parts, 'setup')).toBeNull()
    }
    expect(NO_PART_MADE).toBe(
      'Every part of this assembly is unmarked or counted 0. Mark one, or give a marked part a count, first.',
    )
  })

  it('has a part made only with one marked and counted above 0, named where it has none', () => {
    expect(assemblyMade([])).toBe(false)
    expect(assemblyMade([unmade('a', priced('approved'))])).toBe(false)
    expect(assemblyMade([unmade('a', priced('approved')), member('b', priced('new'))])).toBe(true)
    expect(noPartMarked('Frame')).toBe('Frame has no part marked. Mark one, or set it to No quote.')
  })
})

describe('withdrawing the approval', () => {
  it('takes an assembly in Quote back to Estimate, unapproved', () => {
    expect(withdrawnApproval({ stage: 'quote' })).toEqual({ stage: 'estimate', approved: false })
  })

  it('leaves an assembly moved out of Quote where it was moved', () => {
    for (const stage of ['setup', 'review', 'estimate'] as const) {
      expect(withdrawnApproval({ stage })).toEqual({ stage, approved: false })
    }
  })

  it('is taken back by any part’s new plan, but not by the times it was approved on', () => {
    const replaced = { fingerprint: 'f1', withoutPlan: false }
    expect(landingWithdrawsApproval({ approved: true, replaced, landed: 'f2' })).toBe(true)
    expect(landingWithdrawsApproval({ approved: true, replaced, landed: 'f1' })).toBe(false)
    // Approved without a plan: the plan landing is new to what was approved.
    expect(
      landingWithdrawsApproval({
        approved: true,
        replaced: { ...replaced, withoutPlan: true },
        landed: 'f1',
      }),
    ).toBe(true)
    expect(landingWithdrawsApproval({ approved: true, replaced: null, landed: 'f1' })).toBe(true)
    expect(landingWithdrawsApproval({ approved: false, replaced, landed: 'f2' })).toBe(false)
  })
})

describe('count per assembly and pieces', () => {
  const shape = (
    shapeCount: number,
    countOverride: number | null = null,
    stockBodiesTaken = 0,
    unmarked = false,
  ): PartCount => ({
    shapeCount,
    stockBodiesTaken,
    countOverride,
    unmarked,
  })

  it('defaults to the shape’s body count', () => {
    expect(countPerAssembly(shape(3))).toBe(3)
    expect(countOverridden(shape(3))).toBe(false)
  })

  it('takes the shop’s count over the shape’s', () => {
    expect(countPerAssembly(shape(3, 5))).toBe(5)
    expect(countOverridden(shape(3, 5))).toBe(true)
    // Fewer than the file holds — a spare body drawn in, say — is the shop’s to say too.
    expect(countPerAssembly(shape(3, 1))).toBe(1)
  })

  /** A shape's count alone, as `withCount` sets it: whether it is marked is not the count's. */
  const counted = (
    shapeCount: number,
    countOverride: number | null = null,
    stockBodiesTaken = 0,
  ) => ({ shapeCount, stockBodiesTaken, countOverride })

  it('keeps an edit as an override, and the shape’s own count as none', () => {
    expect(withCount(shape(3), 5)).toEqual(counted(3, 5))
    expect(withCount(shape(3, 5), 4)).toEqual(counted(3, 4))
    expect(withCount(shape(3, 5), 3)).toEqual(counted(3))
  })

  it('takes the shape’s bodies used as stock off its default, never below 0, the shop’s count over it', () => {
    expect(countPerAssembly(shape(4, null, 1))).toBe(3)
    expect(shapeDefaultCount(shape(1, null, 1))).toBe(0)
    expect(partMade(shape(1, null, 1))).toBe(false)
    expect(shapeDefaultCount(shape(1, null, 2))).toBe(0)
    expect(countPerAssembly(shape(1, 2, 1))).toBe(2)
    // The default as it stands, less the stock, is the count that clears the override.
    expect(withCount(shape(4, null, 1), 3)).toEqual(counted(4, null, 1))
    expect(withCount(shape(4, null, 1), 4)).toEqual(counted(4, 4, 1))
  })

  describe('stockBodiesTakenOf', () => {
    /** A part of shape `shapeIndex` (its body the same index), ×`shapeCount`, cut from `from`. */
    const part = (
      partId: string,
      shapeIndex: number | null,
      shapeCount: number,
      from: number | null = null,
      countOverride: number | null = null,
      unmarked = false,
    ) => ({ partId, shapeIndex, shapeCount, countOverride, stockBodyIndex: from, unmarked })
    /** Each body is the shape of its index, but bodies 5–9, which are copies of shape 0. */
    const shapeOf = (body: number) => (body >= 5 && body <= 9 ? 0 : body < 5 ? body : null)
    const takenBy = (...parts: Array<ReturnType<typeof part>>) =>
      Object.fromEntries(stockBodiesTakenOf(parts, shapeOf))

    it('takes a copy of the stock shape for each piece cut from it: a casting placed with its part ×4 is all stock', () => {
      expect(takenBy(part('casting', 0, 4), part('machined', 1, 4, 0))).toEqual({
        casting: 4,
        machined: 0,
      })
      expect(countPerAssembly(shape(4, null, 4))).toBe(0)
    })

    it('takes only as many as are cut, and never more than the shape has', () => {
      expect(takenBy(part('casting', 0, 4), part('machined', 1, 2, 0)).casting).toBe(2)
      expect(takenBy(part('casting', 0, 1), part('machined', 1, 4, 0)).casting).toBe(1)
    })

    it('sums the parts cut from bodies of one shape', () => {
      expect(
        takenBy(part('casting', 0, 4), part('lever', 1, 1, 0), part('arm', 2, 2, 5)).casting,
      ).toBe(3)
    })

    it('reads a cutter’s override as its count', () => {
      expect(takenBy(part('casting', 0, 4), part('machined', 1, 4, 0, 1)).casting).toBe(1)
      expect(takenBy(part('casting', 0, 4), part('machined', 1, 4, 0, 0)).casting).toBe(0)
    })

    it('takes none for a cutter not marked, whatever its count would be', () => {
      expect(takenBy(part('casting', 0, 4), part('machined', 1, 4, 0, null, true)).casting).toBe(0)
      expect(takenBy(part('casting', 0, 4), part('machined', 1, 4, 0, 2, true)).casting).toBe(0)
    })

    it('resolves the parts cut from a shape before it, down a chain', () => {
      // The bar ×4 is stock for the blank ×3, itself stock for the bracket ×2: the bracket takes
      // two blanks, leaving one made, which takes one bar.
      expect(takenBy(part('bar', 0, 4), part('blank', 1, 3, 0), part('bracket', 2, 2, 1))).toEqual({
        bar: 1,
        blank: 2,
        bracket: 0,
      })
    })

    it('cuts a cycle where it closes, the cutter there counting none taken', () => {
      // A part cut from another copy of its own shape.
      expect(takenBy(part('block', 0, 4, 5))).toEqual({ block: 4 })
      // Two shapes each cut from the other: resolving the first, the second's cutter (the first)
      // counts its 2; the second, 3 less those 2, is 1, which the first takes.
      expect(takenBy(part('a', 0, 2, 1), part('b', 1, 3, 0))).toEqual({ a: 1, b: 2 })
    })

    it('takes nothing of a part of no file, or for a body the file does not list', () => {
      expect(
        takenBy(part('old', null, 1, 0), part('casting', 0, 2), part('odd', 1, 1, 42)),
      ).toEqual({ old: 0, casting: 1, odd: 0 })
    })
  })

  it('takes a whole count of 0 or more', () => {
    expect(parseCountPerAssembly(4)).toBe(4)
    expect(parseCountPerAssembly(0)).toBe(0)
    // At most a million: well inside the integer column it is stored in.
    expect(MAX_ASSEMBLY_COUNT).toBe(1_000_000)
    expect(parseCountPerAssembly(MAX_ASSEMBLY_COUNT)).toBe(MAX_ASSEMBLY_COUNT)
    expect(parseCountPerAssembly(MAX_ASSEMBLY_COUNT + 1)).toMatch(/at most 1,000,000/)
    for (const value of [-1, 1.5, Number.NaN, '2', null, undefined, 2 ** 31]) {
      expect(typeof parseCountPerAssembly(value)).toBe('string')
    }
  })

  it('prices assemblies × count pieces, the count as it stands', () => {
    expect(piecesOf(10, shape(2))).toBe(20)
    expect(piecesOf(10, shape(2, 3))).toBe(30)
    // A part alone, ×1: its assembly's quantity, as a part's quantity always was.
    expect(piecesOf(7, shape(1))).toBe(7)
    // Not made: none.
    expect(piecesOf(7, shape(1, 0))).toBe(0)
    expect(piecesOf(7, shape(0))).toBe(0)
  })

  it('makes a part counted above 0', () => {
    expect(partMade(shape(1))).toBe(true)
    expect(partMade(shape(0))).toBe(false)
    expect(partMade(shape(0, 2))).toBe(true)
    expect(partMade(shape(2, 0))).toBe(false)
  })

  it('counts a part not marked 0, whatever its shape or override, keeping both for its marking', () => {
    expect(partMarked(shape(3))).toBe(true)
    expect(partMarked(shape(3, null, 0, true))).toBe(false)
    expect(countPerAssembly(shape(3, null, 0, true))).toBe(0)
    expect(countPerAssembly(shape(3, 5, 0, true))).toBe(0)
    expect(partMade(shape(3, 5, 0, true))).toBe(false)
    expect(piecesOf(10, shape(3, 5, 0, true))).toBe(0)
    // Its count set apart from its mark.
    expect(withCount(shape(3, null, 0, true), 5)).toEqual(counted(3, 5))
  })

  it('refuses any count of a part not marked: it is marked first', () => {
    const parts = [
      { partId: 'a', count: 2, unmarked: false },
      { partId: 'b', count: 0, unmarked: true },
    ]
    expect(countRefusal(parts, 'b', 1)).toBe(UNMARKED_COUNTED)
    expect(countRefusal(parts, 'b', 0)).toBe(UNMARKED_COUNTED)
    expect(countRefusal(parts, 'a', 3)).toBeNull()
  })

  it('refuses 0 for the last part made, and nothing else', () => {
    const parts = [
      { partId: 'a', count: 2, unmarked: false },
      { partId: 'b', count: 1, unmarked: false },
      { partId: 'c', count: 0, unmarked: false },
    ]
    expect(countRefusal(parts, 'a', 0)).toBeNull()
    expect(countRefusal(parts, 'c', 3)).toBeNull()
    const last = [
      { partId: 'a', count: 2, unmarked: false },
      { partId: 'c', count: 0, unmarked: false },
    ]
    expect(countRefusal(last, 'a', 0)).toBe(LAST_PART_MADE)
    expect(countRefusal(last, 'a', 1)).toBeNull()
    // A body not marked is no part made for the last one to leave.
    expect(
      countRefusal(
        [
          { partId: 'a', count: 2, unmarked: false },
          { partId: 'b', count: 0, unmarked: true },
        ],
        'a',
        0,
      ),
    ).toBe(LAST_PART_MADE)
    expect(countRefusal([{ partId: 'a', count: 1, unmarked: false }], 'a', 0)).toBe(
      'Use No quote to leave out the whole assembly.',
    )
  })

  it('takes the approval back only for a part counted again from 0: a part added', () => {
    expect(countWithdrawsApproval(0, 2)).toBe(true)
    expect(countWithdrawsApproval(2, 3)).toBe(false)
    expect(countWithdrawsApproval(3, 1)).toBe(false)
    expect(countWithdrawsApproval(2, 0)).toBe(false)
    expect(countWithdrawsApproval(0, 0)).toBe(false)
  })

  it('refuses a delete that would leave only parts counted 0, never the last part', () => {
    const parts = [
      { partId: 'a', count: 2 },
      { partId: 'b', count: 0 },
      { partId: 'c', count: 1 },
    ]
    expect(deleteRefusal(parts, 'a')).toBeNull()
    expect(deleteRefusal(parts, 'b')).toBeNull()
    expect(deleteRefusal(parts.slice(0, 2), 'a')).toBe(LAST_MADE_DELETED)
    expect(LAST_MADE_DELETED).toBe('Mark another part, or set another marked part’s count, first.')
    // The last part takes the assembly with it.
    expect(deleteRefusal([{ partId: 'a', count: 1 }], 'a')).toBeNull()
  })
})

describe('quotedAssemblyCounts', () => {
  const signedOff = { noQuote: false, parts: [member('a', priced('approved'))] }
  const open = {
    noQuote: false,
    parts: [member('b', priced('approved')), member('c', priced('confirmed'))],
  }
  const left = { noQuote: true, parts: [member('d', priced('confirmed'))] }

  it('counts the assemblies on the quote, and those signed off', () => {
    expect(quotedAssemblyCounts([signedOff, open, left])).toEqual({
      assemblyCount: 2,
      estimatedAssemblyCount: 1,
    })
  })

  it('reads a quote estimated once every assembly on it is signed off', () => {
    const status = (assemblies: Parameters<typeof quotedAssemblyCounts>[0]) =>
      quoteStatus({ sentAt: null, outcome: null, ...quotedAssemblyCounts(assemblies) })
    expect(status([signedOff, open])).toBe('new')
    expect(status([signedOff, left])).toBe('estimated')
    expect(status([left])).toBe('new')
  })

  it('signs an assembly off without its parts not made', () => {
    const withStock = {
      noQuote: false,
      parts: [member('a', priced('approved')), unmade('b', { kind: 'analyzing' })],
    }
    expect(quotedAssemblyCounts([withStock])).toEqual({
      assemblyCount: 1,
      estimatedAssemblyCount: 1,
    })
  })
})
