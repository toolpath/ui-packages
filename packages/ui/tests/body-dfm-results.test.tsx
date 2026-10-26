import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { combineBodyChecks } from '@toolpath/dfm'
import { BodyDfmResults } from '../src/body-dfm-results'

describe('combined body results', () => {
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
})
