import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { combineBodyChecks, makeRule, type BodyDfmSummary } from '@toolpath/dfm'
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Through hole 1' })[1]!)
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
})
