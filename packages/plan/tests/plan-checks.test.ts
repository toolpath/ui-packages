import { describe, expect, it } from 'vitest'
import {
  allClear,
  changedSinceResults,
  confirmChecks,
  describeClause,
  planChecks,
  type CheckContext,
  type CheckedDraft,
} from '../src/plan-checks'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

const draft = (overrides: Partial<CheckedDraft> = {}): CheckedDraft => ({
  setups: [
    { id: 'a', name: 'Top', direction: up, features: [], folders: [] },
    { id: 'b', name: 'Bottom', direction: down, features: [], folders: [] },
  ],
  kernelVersion: '0.17.0',
  ...overrides,
})

const features: Record<string, { type: string; label: string }> = {
  prof: { type: 'profile', label: 'Profile · 00prof' },
  pock: { type: 'pocket', label: 'Pocket · 00pock' },
}

const back = { x: 0, y: -1, z: 0 }

const context: CheckContext = {
  // Toolpath detected the back too, and has not analyzed it.
  directions: { analyzed: [up, down, side], discovered: [up, down, side, back], pending: false },
  feature: (tag) => features[tag] ?? null,
  kernelVersion: '0.17.0',
}

const tones = (checks: ReturnType<typeof planChecks>) => checks.map((check) => check.tone)

describe('planChecks', () => {
  it('has nothing to say about folders facing analyzed directions with nothing pinned', () => {
    expect(planChecks(draft(), context)).toEqual([])
  })

  it('blocks a pin the part does not have, leaving a profile anywhere to Toolpath', () => {
    const checks = planChecks(
      draft({
        setups: [
          { id: 'a', name: 'Top', direction: up, features: [], folders: [] },
          { id: 'b', name: 'Bottom', direction: down, features: ['prof', 'gone'], folders: [] },
        ],
      }),
      context,
    )
    expect(checks.filter((check) => check.tone === 'blocking').map((check) => check.text)).toEqual([
      'A feature pinned in Bottom is not one of this part’s. Unpin it.',
    ])
  })

  it('has nothing to say about setups the person put in order', () => {
    const checks = planChecks(
      draft({
        setups: [
          { id: 'c', name: 'Side', direction: side, features: [], folders: [] },
          { id: 'a', name: 'Top', direction: up, features: [], folders: [] },
        ],
      }),
      context,
    )
    expect(checks).toEqual([])
  })

  it('holds a folder facing a direction not analyzed, and warns while it is analyzed', () => {
    const facing = (direction: typeof up) =>
      draft({
        setups: [
          { id: 'a', name: 'Top', direction: up, features: [], folders: [] },
          { id: 'd', name: 'Back', direction, features: [], folders: [] },
        ],
      })
    const withTone = (tone: string) => (checks: ReturnType<typeof planChecks>) =>
      checks.filter((check) => check.tone === tone).map((check) => check.text)
    const blocking = withTone('blocking')
    const warning = withTone('warning')

    expect(blocking(planChecks(facing(back), context))).toEqual([
      'Toolpath has not analyzed Back’s direction. Open Back and analyze it.',
    ])
    const analyzing = { ...context, directions: { ...context.directions, pending: true } }
    expect(blocking(planChecks(facing(back), analyzing))).toEqual([])
    expect(warning(planChecks(facing(back), analyzing))).toEqual([
      'Toolpath is analyzing Back’s direction. Its features arrive when it is done.',
    ])
    // Not even detected: there is nothing to analyze.
    expect(blocking(planChecks(facing({ x: 0, y: 1, z: 0 }), context))).toEqual([
      'Back faces a direction the part was not analyzed from. Delete it and add it again.',
    ])
    // Analyzed, its features are in: nothing holds it but what holds any folder.
    const analyzed = {
      ...context,
      directions: { ...context.directions, analyzed: [up, down, side, back] },
      planned: [up, down, back],
    }
    expect(blocking(planChecks(facing(back), analyzed))).toEqual([])
  })

  it('warns that pins may be stale after Toolpath is updated', () => {
    const checks = planChecks(
      draft({
        setups: [{ id: 'a', name: 'Top', direction: up, features: ['pock'], folders: [] }],
        kernelVersion: '0.15.0',
      }),
      context,
    )
    expect(tones(checks)).toEqual(['warning'])
  })
})

describe('describeClause', () => {
  it('names the setup by its folder and the feature by its label', () => {
    expect(
      describeClause(
        'setup 1, orientation 0: profile FeatureTag(00000000000000ab) is planned in the first setup only',
        draft(),
        (tag) => (tag === 'ab' ? 'Profile · 0000ab' : null),
        ['ab'],
      ),
    ).toBe('Bottom: profile Profile · 0000ab is planned in the first setup only')
  })

  it('says a stated feature Toolpath was not offered could not be measured', () => {
    expect(
      describeClause(
        'setup 0, orientation 0: feature FeatureTag(00000000000000ab) is not among the features offered',
        draft(),
        (tag) => (tag === 'ab' ? 'Pocket' : null),
        ['ab'],
      ),
    ).toBe(
      'Top: feature Pocket could not be measured, so Toolpath cannot plan it — unpin it, or pin its faces as another feature',
    )
  })

  it('leaves what it cannot name as it was', () => {
    expect(describeClause('setup 9: FeatureTag(ff) is excluded', draft(), () => null, [])).toBe(
      'setup 9: FeatureTag(ff) is excluded',
    )
  })
})

describe('confirmChecks', () => {
  const folders = [
    { id: 'a', name: 'Top', machined: true },
    { id: 'b', name: 'Bottom', machined: false },
  ]
  const setups = [{ idx: 0, notMachined: ['t1'], notFinished: [] }]

  it('lists what stops a confirm, what to look at with where, and what is fine', () => {
    const checks = confirmChecks([{ tone: 'info', text: 'An aside' }], {
      changed: false,
      notMachined: 0,
      folders,
      setups,
    })
    expect(checks).toEqual([
      { tone: 'ok', text: 'Every face that needs machining is machined.' },
      {
        tone: 'warning',
        text: '1 feature can’t be cut as planned.',
        show: { kind: 'setup', idx: 0 },
      },
      {
        tone: 'warning',
        text: '1 folder has nothing in it.',
        show: { kind: 'folder', setupId: 'b' },
      },
    ])
  })

  it('has no folder warning when the plan machines something in every folder, pinned or not', () => {
    const checks = confirmChecks([], {
      changed: false,
      notMachined: null,
      folders: [
        { id: 'a', name: 'Top', machined: true },
        { id: 'b', name: 'Bottom', machined: true },
      ],
      setups: [],
    })
    expect(checks).toEqual([])
  })

  it('has no folder warning when the results are not of the current constraints', () => {
    const checks = confirmChecks([], { changed: true, notMachined: null, folders: [], setups: [] })
    expect(checks).toEqual([{ tone: 'info', text: 'Constraints changed since these results.' }])
  })

  it('says what a pass roughs but none finishes apart from what nothing cuts (MP-22)', () => {
    const checks = confirmChecks([], {
      changed: false,
      notMachined: 0,
      folders: [],
      setups: [
        { idx: 0, notMachined: ['t1', 't2'], notFinished: ['t2'] },
        { idx: 3, notMachined: ['s1'], notFinished: ['s1'] },
      ],
    })
    expect(checks.map((check) => check.text)).toEqual([
      'Every face that needs machining is machined.',
      '2 features not finished: Toolpath roughs them, but no pass finishes them.',
      '1 feature can’t be cut as planned.',
    ])
    // Each Show opens the first of Toolpath's setups with such a feature, in the Results view.
    expect(checks.map((check) => check.show)).toEqual([
      undefined,
      { kind: 'setup', idx: 0 },
      { kind: 'setup', idx: 0 },
    ])
  })

  it('says every setup can cut what is in it only when nothing is unfinished or uncut', () => {
    const texts = (notFinished: Array<string>) =>
      confirmChecks([], {
        changed: false,
        notMachined: null,
        folders: [],
        setups: [{ idx: 0, notMachined: notFinished, notFinished }],
      }).map((check) => check.text)
    expect(texts([])).toContain('Every setup can cut what is in it.')
    expect(texts(['t1'])).toEqual([
      '1 feature not finished: Toolpath roughs it, but no pass finishes it.',
    ])
  })

  it('says nothing of the setups before Toolpath has planned any', () => {
    const checks = confirmChecks([], {
      changed: false,
      notMachined: null,
      folders: [],
      setups: [],
    })
    expect(checks).toEqual([])
  })

  it('reads the constraints as changed since the results only where there are results', () => {
    expect(changedSinceResults(true, 2)).toBe(true)
    // Never planned: nothing for the constraints to have changed from.
    expect(changedSinceResults(true, 0)).toBe(false)
    expect(changedSinceResults(false, 2)).toBe(false)
  })

  it('notes, without blocking, that the constraints changed since these results', () => {
    const checks = confirmChecks([], { changed: true, notMachined: 2, folders: [], setups: [] })
    expect(checks.some((check) => check.tone === 'blocking')).toBe(false)
    expect(checks.find((check) => check.tone === 'info')).toEqual({
      tone: 'info',
      text: 'Constraints changed since these results.',
    })
    expect(checks.find((check) => check.show?.kind === 'notMachined')?.text).toBe(
      '2 features nothing machines.',
    )
  })

  it('warns of what nothing machines, with the list to look at', () => {
    const lines = (notMachined: number) =>
      confirmChecks([], { changed: false, notMachined, folders: [], setups: [] })
    expect(lines(1)[0]).toEqual({
      tone: 'warning',
      text: '1 feature nothing machines.',
      show: { kind: 'notMachined' },
    })
    expect(lines(0).some((check) => check.tone === 'info')).toBe(false)
  })

  it('is all clear only when every line passed', () => {
    const lines = (changed: boolean, notMachined: number) =>
      confirmChecks([], { changed, notMachined, folders: [], setups: [] })
    expect(allClear(lines(false, 0))).toBe(true)
    expect(allClear(lines(false, 1))).toBe(false)
    expect(allClear(lines(true, 0))).toBe(false)
  })
})
