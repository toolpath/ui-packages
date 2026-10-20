import { describe, expect, it } from 'vitest'
import { artifactStateOf, partArtifactsOf, runStatusOf } from '../../src/model/artifact-state'
import type { PartPipeline } from '../../src/model/part-state'

const CURRENT = 'fp-current'
const OLDER = 'fp-older'

describe('an artifact’s state for the inputs as they stand', () => {
  it('is available when the artifact is of them, whatever run is on its way', () => {
    expect(
      artifactStateOf({ current: CURRENT, run: null, artifact: { fingerprint: CURRENT } }),
    ).toBe('available')
    expect(
      artifactStateOf({
        current: CURRENT,
        run: { fingerprint: OLDER, status: 'pending' },
        artifact: { fingerprint: CURRENT },
      }),
    ).toBe('available')
  })

  it('is pending while a run for them is on its way', () => {
    expect(
      artifactStateOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'pending' },
        artifact: { fingerprint: OLDER },
      }),
    ).toBe('pending')
  })

  it('is failed when the run for them was refused or lost', () => {
    expect(
      artifactStateOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'failed' },
        artifact: null,
      }),
    ).toBe('failed')
  })

  it('is not requested when nothing has been asked for them: no run, an older run, or one unstamped', () => {
    expect(artifactStateOf({ current: CURRENT, run: null, artifact: null })).toBe('not-requested')
    expect(
      artifactStateOf({
        current: CURRENT,
        run: { fingerprint: OLDER, status: 'failed' },
        artifact: { fingerprint: OLDER },
      }),
    ).toBe('not-requested')
    expect(
      artifactStateOf({
        current: CURRENT,
        run: { fingerprint: null, status: 'pending' },
        artifact: { fingerprint: null },
      }),
    ).toBe('not-requested')
    // A run for them that landed an artifact which is not of them is no run for them either.
    expect(
      artifactStateOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'landed' },
        artifact: { fingerprint: OLDER },
      }),
    ).toBe('not-requested')
  })

  it('reads the run off the pipeline', () => {
    const pipelines = (...kinds: Array<PartPipeline>) => kinds.map(runStatusOf)
    expect(pipelines('analyzing', 'sending', 'planning')).toEqual(['pending', 'pending', 'pending'])
    expect(pipelines('analysis_failed', 'plan_failed', 'gone')).toEqual([
      'failed',
      'failed',
      'failed',
    ])
    expect(runStatusOf('ready')).toBe('landed')
  })
})

describe('a part’s plan and estimate', () => {
  it('land together: the baseline’s fingerprint is both', () => {
    expect(
      partArtifactsOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'landed' },
        baseline: { fingerprint: CURRENT, withoutPlan: false },
        planned: false,
      }),
    ).toEqual({ plan: 'available', estimate: 'available' })
  })

  it('reads the plan available once the run for them has planned its setups, the times still to come', () => {
    expect(
      partArtifactsOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'pending' },
        baseline: { fingerprint: OLDER, withoutPlan: false },
        planned: true,
      }),
    ).toEqual({ plan: 'available', estimate: 'pending' })
    // Planned under a run for older inputs: nothing of these.
    expect(
      partArtifactsOf({
        current: CURRENT,
        run: { fingerprint: OLDER, status: 'pending' },
        baseline: null,
        planned: true,
      }),
    ).toEqual({ plan: 'not-requested', estimate: 'not-requested' })
  })

  it('priced without a plan is an estimate of the inputs, but no plan of them', () => {
    expect(
      partArtifactsOf({
        current: CURRENT,
        run: { fingerprint: OLDER, status: 'landed' },
        baseline: { fingerprint: CURRENT, withoutPlan: true },
        planned: false,
      }),
    ).toEqual({ plan: 'not-requested', estimate: 'available' })
    // The plan for them still on its way reads so, beside the estimate that stands in.
    expect(
      partArtifactsOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'pending' },
        baseline: { fingerprint: CURRENT, withoutPlan: true },
        planned: false,
      }),
    ).toEqual({ plan: 'pending', estimate: 'available' })
  })

  it('reads both from the run while nothing has landed', () => {
    expect(
      partArtifactsOf({
        current: CURRENT,
        run: { fingerprint: CURRENT, status: 'failed' },
        baseline: null,
        planned: false,
      }),
    ).toEqual({ plan: 'failed', estimate: 'failed' })
  })
})
