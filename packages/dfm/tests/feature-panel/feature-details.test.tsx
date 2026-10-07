import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeatureDetails, type FeatureDetailsProps } from '../../src/index.js'
import {
  RULE_COLORS,
  featureProfile,
  type BrokenRule,
  type Measurement,
} from '../../src/model/index.js'

const [RED = ''] = RULE_COLORS.map((each) => each.value)

const measured: Measurement[] = [
  {
    key: 'featureDepth',
    label: 'Feature depth',
    value: '10 mm',
    alt: '0.394 in',
    derivation: ['zMax − zMin'],
  },
  {
    key: 'pinch',
    label: 'Max tool diameter',
    value: '⌀ 6 mm',
    derivation: ['pinchPoints[0].diameter'],
    milling: true,
  },
  { key: 'ld', label: 'Feature L/D', value: '1.667', derivation: [], milling: true },
]

const rules: BrokenRule[] = [
  {
    key: 'deep',
    color: RED,
    text: 'Milled features with L/D ≥ 1',
    figure: '9.8',
    limit: '≥ 1',
    note: 'Deep for a mill',
  },
]

const datasheet = { reachCurve: { horizontalOffset: [1, 2], verticalOffset: [3, 5] } }

const details = (over: Partial<FeatureDetailsProps> = {}) =>
  render(
    <FeatureDetails
      feature={{ tag: 'P1', featureType: 'pocket', machiningDirection: { x: 0, y: 0, z: 1 } }}
      units="mm"
      directionColor="#3b82f6"
      profile={featureProfile(undefined, 'pocket')}
      rules={rules}
      measurements={{ status: 'ready', value: measured }}
      record={{ status: 'ready', value: { feature: { featureTag: 'P1' }, datasheet } }}
      {...over}
    />,
  )

const headings = () =>
  screen.getAllByRole('button', { expanded: true }).map((button) => button.textContent)

afterEach(() => vi.useRealTimers())

describe('FeatureDetails', () => {
  it('names the feature and its direction, then its sections in order', () => {
    details()
    expect(screen.getByRole('heading', { name: 'Pocket from +Z' })).toBeInTheDocument()
    expect(screen.getByText(/Machined from \+Z/)).toBeInTheDocument()
    expect(headings()).toEqual(['Rules broken', 'Measurements', 'Milling considerations', 'Reach'])
  })

  it('splits the milling considerations from the measurements, and explains each behind an ⓘ', () => {
    details()
    const milling = screen
      .getByRole('button', { name: 'Milling considerations' })
      .closest('section')!
    expect(within(milling).getByText('Max tool diameter')).toBeInTheDocument()
    expect(within(milling).queryByText('Feature depth')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'How this was measured' })).toHaveLength(2)
    expect(screen.getByText('10 mm')).toHaveAttribute('title', '0.394 in')
  })

  it('says None where nothing is broken, and leaves out milling with no rows', () => {
    details({ rules: [], measurements: { status: 'ready', value: [measured[0]!] } })
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Milling considerations' })).not.toBeInTheDocument()
  })

  it('writes a rule as a sentence with a grey figure, or as a result in its colour with its limit', () => {
    const { unmount } = details()
    expect(screen.queryByText('≥ 1')).not.toBeInTheDocument()
    unmount()
    details({ look: { rules: 'result' } })
    expect(screen.getByText('9.8').getAttribute('style')).toContain('color')
    expect(screen.getByText('≥ 1')).toBeInTheDocument()
  })

  it('shows the pills, buttons and slots the app gives, and only those', () => {
    const onFrame = vi.fn()
    const { unmount } = details()
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show this feature/ })).not.toBeInTheDocument()
    unmount()
    details({
      required: true,
      onFrame,
      label: 'Pocket ⌀ 6',
      actions: <button type="button">Isolate</button>,
      status: <span>Folder 1</span>,
      children: <p>Pinned to Folder 1.</p>,
    })
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pocket ⌀ 6 from +Z' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show this feature/ }))
    expect(onFrame).toHaveBeenCalled()
    for (const text of ['Isolate', 'Folder 1', 'Pinned to Folder 1.'])
      expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('says what it is reading, and what failed, with a Retry that waits as long as asked', () => {
    vi.useFakeTimers()
    const retry = vi.fn()
    details({
      measurements: { status: 'loading' },
      record: {
        status: 'error',
        message: 'Toolpath asked us to wait.',
        retry,
        retryAt: Date.now() + 5000,
      },
    })
    expect(screen.getByText('Reading the feature’s datasheet…')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Toolpath asked us to wait.')
    const button = screen.getByRole('button', { name: 'Retry' })
    expect(button).toBeDisabled()
    act(() => vi.advanceTimersByTime(5000))
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(retry).toHaveBeenCalled()
  })

  it('shows the reach heading while the record is read, and leaves it out with no curve', () => {
    const { unmount } = details({ record: { status: 'loading' } })
    expect(screen.getByText('Reading the reach curve…')).toBeInTheDocument()
    unmount()
    details({ record: { status: 'ready', value: null } })
    expect(screen.queryByRole('button', { name: 'Reach' })).not.toBeInTheDocument()
  })

  it("makes the widest tool's row show and hide it on the part", () => {
    const onShownChange = vi.fn()
    const { unmount } = details()
    expect(screen.queryByRole('button', { name: /Max tool diameter/ })).not.toBeInTheDocument()
    unmount()
    details({ pinchPoints: { shown: true, onShownChange } })
    const row = screen.getByRole('button', { name: /Max tool diameter/ })
    expect(row).toHaveAttribute('aria-pressed', 'true')
    expect(row).toHaveTextContent('shown')
    // Its ⓘ is a button of its own, beside the toggle rather than inside it.
    expect(
      within(row).queryByRole('button', { name: 'How this was measured' }),
    ).not.toBeInTheDocument()
    fireEvent.click(row)
    expect(onShownChange).toHaveBeenCalledWith(false)
  })
})
