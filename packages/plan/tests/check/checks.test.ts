import { describe, expect, it } from 'vitest'
import {
  allClear,
  changedSinceResults,
  confirmChecks,
  describeClause,
  planChecks,
  type CheckContext,
  type CheckedDraft,
} from '../../src/check/checks'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

const draft = (overrides: Partial<CheckedDraft> = {}): CheckedDraft => ({
  setups: [
    { id: 'a', name: 'Top', direction: up, features: [], groups: [] },
    { id: 'b', name: 'Bottom', direction: down, features: [], groups: [] },
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

const severities = (checks: ReturnType<typeof planChecks>) => checks.map((check) => check.severity)

describe('planChecks', () => {
  it('has nothing to say about groups facing analyzed directions with nothing assigned', () => {
    expect(planChecks(draft(), context)).toEqual([])
  })

  it('blocks an assignment the part does not have, leaving a profile anywhere to Toolpath', () => {
    const checks = planChecks(
      draft({
        setups: [
          { id: 'a', name: 'Top', direction: up, features: [], groups: [] },
          { id: 'b', name: 'Bottom', direction: down, features: ['prof', 'gone'], groups: [] },
        ],
      }),
      context,
    )
    expect(checks.filter((check) => check.severity === 'blocking')).toEqual([
      {
        kind: 'unknownFeature',
        severity: 'blocking',
        group: { id: 'b', name: 'Bottom' },
        tag: 'gone',
      },
    ])
  })

  it('has nothing to say about setups the person put in order', () => {
    const checks = planChecks(
      draft({
        setups: [
          { id: 'c', name: 'Side', direction: side, features: [], groups: [] },
          { id: 'a', name: 'Top', direction: up, features: [], groups: [] },
        ],
      }),
      context,
    )
    expect(checks).toEqual([])
  })

  it('holds a group facing a direction not analyzed, and warns while it is analyzed', () => {
    const facing = (direction: typeof up) =>
      draft({
        setups: [
          { id: 'a', name: 'Top', direction: up, features: [], groups: [] },
          { id: 'd', name: 'Back', direction, features: [], groups: [] },
        ],
      })
    const withSeverity = (severity: string) => (checks: ReturnType<typeof planChecks>) =>
      checks
        .filter((check) => check.severity === severity)
        .map((check) => (check.kind === 'notAnalyzed' ? [check.group.name, check.analysis] : []))
    const blocking = withSeverity('blocking')
    const warning = withSeverity('warning')

    expect(blocking(planChecks(facing(back), context))).toEqual([['Back', 'unanalyzed']])
    const analyzing = { ...context, directions: { ...context.directions, pending: true } }
    expect(blocking(planChecks(facing(back), analyzing))).toEqual([])
    expect(warning(planChecks(facing(back), analyzing))).toEqual([['Back', 'analyzing']])
    // Not even detected: there is nothing to analyze.
    expect(blocking(planChecks(facing({ x: 0, y: 1, z: 0 }), context))).toEqual([
      ['Back', 'undetected'],
    ])
    // Analyzed, its features are in: nothing holds it but what holds any group.
    const analyzed = {
      ...context,
      directions: { ...context.directions, analyzed: [up, down, side, back] },
      planned: [up, down, back],
    }
    expect(blocking(planChecks(facing(back), analyzed))).toEqual([])
  })

  it('warns that assignments may be stale after Toolpath is updated', () => {
    const checks = planChecks(
      draft({
        setups: [{ id: 'a', name: 'Top', direction: up, features: ['pock'], groups: [] }],
        kernelVersion: '0.15.0',
      }),
      context,
    )
    expect(checks).toEqual([{ kind: 'kernelMoved', severity: 'warning' }])
    expect(severities(checks)).toEqual(['warning'])
  })

  it('blocks a feature assigned in a group cut from another direction', () => {
    const checks = planChecks(
      draft({
        setups: [
          { id: 'a', name: 'Top', direction: up, features: [], groups: [] },
          { id: 'c', name: 'Side', direction: side, features: ['pock'], groups: [] },
        ],
      }),
      {
        ...context,
        feature: (tag) => (features[tag] ? { ...features[tag], direction: up } : null),
      },
    )
    expect(checks).toEqual([
      {
        kind: 'otherWay',
        severity: 'blocking',
        group: { id: 'c', name: 'Side' },
        feature: { tag: 'pock', label: 'Pocket · 00pock' },
      },
    ])
  })
})

describe('describeClause', () => {
  it('names the setup by its group and the feature by its label', () => {
    expect(
      describeClause(
        'setup 1, orientation 0: profile FeatureTag(00000000000000ab) is planned in the first setup only',
        draft(),
        (tag) => (tag === 'ab' ? 'Profile · 0000ab' : null),
        ['ab'],
      ),
    ).toEqual({
      kind: 'clause',
      text: 'Bottom: profile Profile · 0000ab is planned in the first setup only',
    })
  })

  it('gives a stated feature Toolpath did not offer as a kind, the feature named', () => {
    expect(
      describeClause(
        'setup 0, orientation 0: feature FeatureTag(00000000000000ab) is not among the features offered',
        draft(),
        (tag) => (tag === 'ab' ? 'Pocket' : null),
        ['ab'],
      ),
    ).toEqual({ kind: 'notOffered', text: 'Top: feature Pocket' })
  })

  it('leaves what it cannot name as it was', () => {
    expect(describeClause('setup 9: FeatureTag(ff) is excluded', draft(), () => null, [])).toEqual({
      kind: 'clause',
      text: 'setup 9: FeatureTag(ff) is excluded',
    })
  })
})

describe('confirmChecks', () => {
  const groups = [
    { id: 'a', name: 'Top', machined: true },
    { id: 'b', name: 'Bottom', machined: false },
  ]
  const setups = [{ idx: 0, notMachined: ['t1'], notFinished: [] }]

  it('lists what stops a confirm, what to look at with where, and what is fine', () => {
    const checks = confirmChecks([{ kind: 'kernelMoved', severity: 'warning' }], {
      changed: false,
      notMachined: 0,
      groups,
      setups,
    })
    expect(checks).toEqual([
      { kind: 'kernelMoved', severity: 'warning' },
      { kind: 'allMachined', severity: 'ok' },
      { kind: 'cannotCut', severity: 'warning', count: 1, show: { kind: 'setup', idx: 0 } },
      {
        kind: 'emptyGroups',
        severity: 'warning',
        count: 1,
        show: { kind: 'group', setupId: 'b' },
      },
    ])
  })

  it('has no group warning when the plan machines something in every group, assigned or not', () => {
    const checks = confirmChecks([], {
      changed: false,
      notMachined: null,
      groups: [
        { id: 'a', name: 'Top', machined: true },
        { id: 'b', name: 'Bottom', machined: true },
      ],
      setups: [],
    })
    expect(checks).toEqual([])
  })

  it('has no group warning when the results are not of the current constraints', () => {
    const checks = confirmChecks([], { changed: true, notMachined: null, groups: [], setups: [] })
    expect(checks).toEqual([{ kind: 'changed', severity: 'info' }])
  })

  it('says what a pass roughs but none finishes apart from what nothing cuts (MP-22)', () => {
    const checks = confirmChecks([], {
      changed: false,
      notMachined: 0,
      groups: [],
      setups: [
        { idx: 0, notMachined: ['t1', 't2'], notFinished: ['t2'] },
        { idx: 3, notMachined: ['s1'], notFinished: ['s1'] },
      ],
    })
    // Each Show opens the first of Toolpath's setups with such a feature, in the Results view.
    expect(checks).toEqual([
      { kind: 'allMachined', severity: 'ok' },
      { kind: 'notFinished', severity: 'warning', count: 2, show: { kind: 'setup', idx: 0 } },
      { kind: 'cannotCut', severity: 'warning', count: 1, show: { kind: 'setup', idx: 0 } },
    ])
  })

  it('says every setup can cut what is in it only when nothing is unfinished or uncut', () => {
    const kinds = (notFinished: Array<string>) =>
      confirmChecks([], {
        changed: false,
        notMachined: null,
        groups: [],
        setups: [{ idx: 0, notMachined: notFinished, notFinished }],
      }).map((check) => check.kind)
    expect(kinds([])).toContain('allCut')
    expect(kinds(['t1'])).toEqual(['notFinished'])
  })

  it('says nothing of the setups before Toolpath has planned any', () => {
    const checks = confirmChecks([], {
      changed: false,
      notMachined: null,
      groups: [],
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
    const checks = confirmChecks([], { changed: true, notMachined: 2, groups: [], setups: [] })
    expect(checks.some((check) => check.severity === 'blocking')).toBe(false)
    expect(checks.find((check) => check.severity === 'info')).toEqual({
      kind: 'changed',
      severity: 'info',
    })
    expect(checks.find((check) => check.kind === 'notMachined')).toEqual({
      kind: 'notMachined',
      severity: 'warning',
      count: 2,
      show: { kind: 'notMachined' },
    })
  })

  it('warns of what nothing machines, with the list to look at', () => {
    const lines = (notMachined: number) =>
      confirmChecks([], { changed: false, notMachined, groups: [], setups: [] })
    expect(lines(1)[0]).toEqual({
      kind: 'notMachined',
      severity: 'warning',
      count: 1,
      show: { kind: 'notMachined' },
    })
    expect(lines(0).some((check) => check.severity === 'info')).toBe(false)
  })

  it('is all clear only when every line passed', () => {
    const lines = (changed: boolean, notMachined: number) =>
      confirmChecks([], { changed, notMachined, groups: [], setups: [] })
    expect(allClear(lines(false, 0))).toBe(true)
    expect(allClear(lines(false, 1))).toBe(false)
    expect(allClear(lines(true, 0))).toBe(false)
  })
})
