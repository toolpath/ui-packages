import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  combineBodyChecks,
  CRITICAL_COLOR,
  makeRule,
  metricInfo,
  TURNING_RULES,
  WARNING_COLOR,
  type BodyDfmCheck,
  type BodyDfmSummary,
  type DfmCheck,
  type DfmHit,
  type DfmRule,
} from '@toolpath/dfm'
import { BodyDfmResults } from '../src/body-dfm-results'

describe('combined body results', () => {
  it('identifies bodies still waiting and reports per-body progress', () => {
    const summary = combineBodyChecks(
      [
        { id: 'a', label: 'Waiting body', status: 'pending', check: null, features: [] },
        {
          id: 'b',
          label: 'Running body',
          status: 'pending',
          progress: 35,
          check: null,
          features: [],
        },
      ],
      [],
    )
    render(<BodyDfmResults summary={summary} tab="rules" units="mm" onInspect={() => {}} />)
    expect(screen.getByText('Waiting body: Pending analysis')).toBeVisible()
    expect(screen.getByText('Running body: Checking 35%')).toBeVisible()
  })
  it('keeps duplicate feature tags attached to their owning body and exposes failed-body retry', () => {
    const summary = combineBodyChecks(
      ['a', 'b'].map((id) => ({
        id,
        label: `Body ${id}`,
        status: 'ready' as const,
        check: null,
        features: [
          {
            tag: 'duplicate',
            number: 1,
            featureType: 'through_hole',
            machiningDirection: { x: 0, y: 0, z: 1 },
            regionIdxs: [0],
          },
        ],
      })),
      [],
    )
    summary.bodies = [
      ...summary.bodies,
      { id: 'c', label: 'Body c', status: 'error', check: null, features: [], error: 'failed' },
    ]
    summary.total = 3
    summary.failed = 1
    const inspect = vi.fn()
    const retry = vi.fn()
    render(
      <BodyDfmResults
        summary={summary}
        tab="features"
        units="mm"
        onInspect={inspect}
        onRetry={retry}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('2 of 3 bodies checked · 1 failed')
    // By body, then by type, then the feature: body b's copy of the shared tag.
    const bodies = screen.getByRole('list', { name: 'Features by body' })
    expect(within(bodies).getByRole('button', { name: /^Body c/ })).toBeDisabled()
    fireEvent.click(within(bodies).getByRole('button', { name: /^Body b/ }))
    fireEvent.click(within(bodies).getByRole('button', { name: /^Through hole/ }))
    fireEvent.click(within(bodies).getByRole('button', { name: /Through hole 1/ }))
    expect(inspect).toHaveBeenCalledWith('b', 'duplicate')
    fireEvent.click(screen.getByRole('button', { name: 'Retry Body c' }))
    expect(retry).toHaveBeenCalledWith('c')
  })
  it('does not wait on a failed body once nothing is pending', () => {
    const summary = combineBodyChecks(
      [
        { id: 'a', label: 'Body a', status: 'ready', check: null, features: [] },
        { id: 'b', label: 'Body b', status: 'error', check: null, features: [], error: 'failed' },
      ],
      [],
    )
    const { rerender } = render(
      <BodyDfmResults summary={summary} tab="rules" units="mm" onInspect={() => {}} />,
    )
    expect(screen.getByText('No rule violations in the checked bodies.')).toBeVisible()
    expect(screen.queryByText('Results appear as bodies finish analysis.')).toBeNull()
    rerender(
      <BodyDfmResults
        summary={combineBodyChecks([summary.bodies[1]!], [])}
        tab="rules"
        units="mm"
        onInspect={() => {}}
      />,
    )
    expect(screen.getByText('No bodies could be checked.')).toBeVisible()
  })

  it('lists each rule with its count across bodies, opening into bodies and their features', () => {
    const broken = { ...makeRule('hole', 'diameter', 'mm'), id: 'small', color: '#ef4444' }
    const kept = { ...makeRule('pocket', 'depth', 'mm'), id: 'deep', color: '#f59e0b' }
    const feature = (tag: string, number: number) => ({
      tag,
      number,
      featureType: 'blind_hole',
      machiningDirection: { x: 0, y: 0, z: 1 },
      regionIdxs: [0],
    })
    const violation = (bodyId: string, tag: string, number: number) => ({
      id: `${bodyId}:${tag}`,
      bodyId,
      bodyLabel: `Body ${bodyId}`,
      feature: feature(tag, number),
      rule: broken,
      hit: null,
    })
    const summary: BodyDfmSummary = {
      bodies: ['a', 'b', 'c'].map((id) => ({
        id,
        label: `Body ${id}`,
        status: 'ready' as const,
        check: null,
        features: [],
      })),
      completed: 3,
      total: 3,
      failed: 0,
      features: [],
      violations: [violation('a', 'h1', 1), violation('a', 'h2', 2), violation('c', 'h1', 1)],
      byRule: [
        { rule: broken, count: 3 },
        { rule: kept, count: 0 },
      ],
    }
    const inspect = vi.fn()
    const hoverRule = vi.fn()
    render(
      <BodyDfmResults
        summary={summary}
        tab="rules"
        units="mm"
        onInspect={inspect}
        onHoverRule={hoverRule}
      />,
    )
    const rules = screen.getByRole('list', { name: 'Rules' })
    const rule = within(rules).getAllByRole('button')[0]!
    expect(rule).toHaveTextContent('in 2 bodies')
    expect(rule).toHaveTextContent(/3$/)
    // A rule nothing breaks is listed, and cannot be opened.
    expect(within(rules).getAllByRole('button')[1]).toBeDisabled()
    fireEvent.pointerMove(rule)
    expect(hoverRule).toHaveBeenLastCalledWith('small', null)
    fireEvent.click(rule)
    const bodyA = screen.getByRole('button', { name: /^Body a/ })
    expect(bodyA).toHaveTextContent(/2$/)
    expect(screen.queryByRole('button', { name: /^Body b/ })).toBeNull()
    fireEvent.pointerMove(bodyA)
    expect(hoverRule).toHaveBeenLastCalledWith('small', 'a')
    fireEvent.click(bodyA)
    fireEvent.click(screen.getByRole('button', { name: /Blind hole 2/ }))
    expect(inspect).toHaveBeenCalledWith('a', 'h2')
  })

  it("takes an application's own feature groups, with their flags, and reports what the pointer is on", () => {
    const summary = combineBodyChecks(
      ['a', 'b'].map((id) => ({
        id,
        label: `Body ${id}`,
        status: 'ready' as const,
        check: null,
        features: [],
      })),
      [],
    )
    const holes = {
      key: 'holes',
      label: 'Holes',
      color: 0x8b5cf6,
      rows: [
        {
          tag: 'h1',
          label: 'Blind hole',
          facts: ['⌀ 6 mm', 'depth 12 mm'],
          severity: 'critical' as const,
        },
        { tag: 'h2', label: 'Through hole', facts: ['⌀ 3 mm'], severity: 'warning' as const },
        { tag: 'h3', label: 'Through hole', facts: [], severity: null },
      ],
    }
    const focus = vi.fn()
    const inspect = vi.fn()
    render(
      <BodyDfmResults
        summary={summary}
        tab="features"
        units="mm"
        onInspect={inspect}
        featureGroups={new Map([['a', [holes]]])}
        bodyColors={new Map([['a', 0x4e79a7]])}
        onHoverFeatures={focus}
      />,
    )
    const bodies = screen.getByRole('list', { name: 'Features by body' })
    const bodyA = within(bodies).getByRole('button', { name: /^Body a/ })
    expect(bodyA).toHaveTextContent('3 features')
    expect(within(bodyA).getByTitle('1 breaking a critical rule')).toBeVisible()
    expect(within(bodyA).getByTitle('1 breaking a rule')).toBeVisible()
    fireEvent.pointerMove(bodyA)
    expect(focus).toHaveBeenLastCalledWith({ bodyId: 'a', group: null, tag: null })
    fireEvent.click(bodyA)
    const group = within(bodies).getByRole('button', { name: /^Holes/ })
    fireEvent.pointerMove(group)
    expect(focus).toHaveBeenLastCalledWith({ bodyId: 'a', group: 'holes', tag: null })
    fireEvent.click(group)
    const hole = within(bodies).getByRole('button', { name: /Blind hole/ })
    expect(within(hole).getByLabelText('Critical flag')).toBeInTheDocument()
    expect(hole).toHaveTextContent('⌀ 6 mm · depth 12 mm')
    fireEvent.pointerMove(hole)
    expect(focus).toHaveBeenLastCalledWith({ bodyId: 'a', group: 'holes', tag: 'h1' })
    fireEvent.click(hole)
    expect(inspect).toHaveBeenCalledWith('a', 'h1')
    fireEvent.pointerLeave(bodies)
    expect(focus).toHaveBeenLastCalledWith(null)
  })

  const holeFeature = (tag: string, number: number, featureType = 'blind_hole') => ({
    tag,
    number,
    featureType,
    machiningDirection: { x: 0, y: 0, z: 1 },
    regionIdxs: [0],
  })
  const checkFor = (rules: Array<[DfmRule, Array<string>]>): DfmCheck => {
    const hitsByTag = new Map<string, Array<DfmHit>>()
    for (const [rule, tags] of rules) {
      const metric = metricInfo(rule.metric)!
      for (const tag of tags) {
        hitsByTag.set(tag, [...(hitsByTag.get(tag) ?? []), { rule, metric, value: 1 }])
      }
    }
    return {
      byRule: rules.map(([rule, tags]) => ({ rule, tags, otherTags: [] })),
      hitsByTag,
      required: new Set(rules.flatMap(([, tags]) => tags)),
      paintedFaces: new Map(),
      paintedWhole: new Map(),
    }
  }
  const critical: DfmRule = {
    ...makeRule('hole', 'diameter', 'mm'),
    id: 'c',
    color: CRITICAL_COLOR,
  }
  const amber: DfmRule = { ...makeRule('hole', 'depth', 'mm'), id: 'w', color: WARNING_COLOR }

  it('marks fallback-grouped features by the worst rule they break', () => {
    const body: BodyDfmCheck = {
      id: 'a',
      label: 'Body a',
      status: 'ready',
      features: [
        holeFeature('Both', 1),
        holeFeature('warn', 2),
        holeFeature('clean', 3),
        holeFeature('red', 4),
      ],
      // Amber first, then red: red still wins for the feature that breaks both.
      check: checkFor([
        [amber, ['both', 'warn']],
        [critical, ['both', 'red']],
      ]),
    }
    render(
      <BodyDfmResults
        summary={combineBodyChecks([body], [amber, critical])}
        tab="features"
        units="mm"
        onInspect={() => {}}
      />,
    )
    const bodies = screen.getByRole('list', { name: 'Features by body' })
    const bodyRow = within(bodies).getByRole('button', { name: /^Body a/ })
    expect(within(bodyRow).getByTitle('2 breaking a critical rule')).toBeVisible()
    expect(within(bodyRow).getByTitle('1 breaking a rule')).toBeVisible()
    expect(bodyRow).toHaveTextContent('2 breaking a critical rule')
    fireEvent.click(bodyRow)
    fireEvent.click(within(bodies).getByRole('button', { name: /^Blind hole/ }))
    const mark = (name: RegExp) =>
      within(within(bodies).getByRole('button', { name })).queryByLabelText(/flag/i)
    expect(mark(/Blind hole 1/)).toHaveAccessibleName('Critical flag')
    expect(mark(/Blind hole 4/)).toHaveAccessibleName('Critical flag')
    expect(
      within(within(bodies).getByRole('button', { name: /Blind hole 2/ })).getByLabelText(
        'Flagged',
      ),
    ).toBeInTheDocument()
    expect(
      within(within(bodies).getByRole('button', { name: /Blind hole 3/ })).queryByLabelText(
        /flag/i,
      ),
    ).toBeNull()
  })

  it('shows no groups under a body that goes back to checking', () => {
    const ready: BodyDfmCheck = {
      id: 'a',
      label: 'Body a',
      status: 'ready',
      check: null,
      features: [holeFeature('h1', 1)],
    }
    const view = (body: BodyDfmCheck) => (
      <BodyDfmResults
        summary={combineBodyChecks([body], [])}
        tab="features"
        units="mm"
        onInspect={() => {}}
        featureGroups={
          new Map([
            [
              'a',
              [{ key: 'own', label: 'Own kind', color: null, rows: [{ tag: 'h1', label: 'H' }] }],
            ],
          ])
        }
      />
    )
    const { rerender } = render(view(ready))
    fireEvent.click(screen.getByRole('button', { name: /^Body a/ }))
    expect(screen.getByRole('button', { name: /^Own kind/ })).toBeVisible()
    rerender(view({ ...ready, status: 'pending' }))
    const row = screen.getByRole('button', { name: /^Body a/ })
    expect(row).toBeDisabled()
    expect(row).not.toHaveAttribute('aria-expanded')
    expect(screen.queryByRole('button', { name: /^Own kind/ })).toBeNull()
    rerender(view(ready))
    expect(screen.getByRole('button', { name: /^Own kind/ })).toBeVisible()
  })

  it('shows no bodies under a rule whose count drops to nothing', () => {
    const feature = holeFeature('h1', 1)
    const body: BodyDfmCheck = {
      id: 'a',
      label: 'Body a',
      status: 'ready',
      check: checkFor([[critical, ['h1']]]),
      features: [feature],
    }
    const view = (checked: BodyDfmCheck) => (
      <BodyDfmResults
        summary={combineBodyChecks([checked], [critical])}
        tab="rules"
        units="mm"
        onInspect={() => {}}
      />
    )
    const { rerender } = render(view(body))
    const rules = screen.getByRole('list', { name: 'Rules' })
    fireEvent.click(within(rules).getAllByRole('button')[0]!)
    expect(screen.getByRole('button', { name: /^Body a/ })).toBeVisible()
    rerender(view({ ...body, check: checkFor([]) }))
    expect(screen.queryByRole('button', { name: /^Body a/ })).toBeNull()
    expect(within(rules).getAllByRole('button')[0]!).toBeDisabled()
  })

  it('lets go of the pointer when the results unmount', () => {
    const summary = combineBodyChecks(
      [
        {
          id: 'a',
          label: 'Body a',
          status: 'ready',
          check: null,
          features: [holeFeature('h1', 1)],
        },
      ],
      [],
    )
    const hoverFeatures = vi.fn()
    const features = render(
      <BodyDfmResults
        summary={summary}
        tab="features"
        units="mm"
        onInspect={() => {}}
        onHoverFeatures={hoverFeatures}
      />,
    )
    fireEvent.pointerMove(screen.getByRole('button', { name: /^Body a/ }))
    hoverFeatures.mockClear()
    features.unmount()
    expect(hoverFeatures).toHaveBeenCalledExactlyOnceWith(null)

    const hoverRule = vi.fn()
    const hover = vi.fn()
    const rules = render(
      <BodyDfmResults
        summary={combineBodyChecks(
          [
            {
              id: 'a',
              label: 'Body a',
              status: 'ready',
              check: checkFor([[critical, ['h1']]]),
              features: [holeFeature('h1', 1)],
            },
          ],
          [critical],
        )}
        tab="rules"
        units="mm"
        onInspect={() => {}}
        onHover={hover}
        onHoverRule={hoverRule}
      />,
    )
    fireEvent.click(screen.getAllByRole('button')[0]!)
    fireEvent.click(screen.getByRole('button', { name: /^Body a/ }))
    fireEvent.pointerEnter(screen.getByRole('button', { name: /Blind hole 1/ }))
    expect(hover).toHaveBeenLastCalledWith('a', 'h1')
    hoverRule.mockClear()
    hover.mockClear()
    rules.unmount()
    expect(hoverRule).toHaveBeenCalledExactlyOnceWith(null, null)
    expect(hover).toHaveBeenCalledExactlyOnceWith('a', null)
  })

  it('names features by the vocabulary in both tabs', () => {
    const body: BodyDfmCheck = {
      id: 'a',
      label: 'Body a',
      status: 'ready',
      check: checkFor([[critical, ['g1']]]),
      features: [holeFeature('g1', 1, 'od_groove')],
    }
    const summary = combineBodyChecks([body], [critical])
    const rules = render(
      <BodyDfmResults
        summary={summary}
        tab="rules"
        units="mm"
        vocabulary={TURNING_RULES}
        onInspect={() => {}}
      />,
    )
    fireEvent.click(screen.getAllByRole('button')[0]!)
    fireEvent.click(screen.getByRole('button', { name: /^Body a/ }))
    expect(screen.getByRole('button', { name: /OD groove 1/ })).toBeVisible()
    rules.unmount()
    render(
      <BodyDfmResults
        summary={summary}
        tab="features"
        units="mm"
        vocabulary={TURNING_RULES}
        onInspect={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Body a/ }))
    fireEvent.click(screen.getByRole('button', { name: /^OD groove/ }))
    expect(screen.getByRole('button', { name: /OD groove 1/ })).toBeVisible()
  })
})
