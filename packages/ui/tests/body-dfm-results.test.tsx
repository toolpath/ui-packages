import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { combineBodyChecks } from '@toolpath/dfm'
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
})
