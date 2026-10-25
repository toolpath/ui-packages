import { describe, expect, it } from 'vitest'
import {
  RECEIPT_KIND,
  createSummary,
  readNeeds,
  readRequiredJobs,
  receiptFileName,
  receiptProblems,
  verifyAggregate,
  verifyReceipts,
  verifyWorkflow,
  type Receipt,
} from '../../src/ci/result-policy.mjs'

const identity = {
  name: '@toolpath/dev-config',
  version: '1.2.3',
  sourceSha: 'a'.repeat(40),
  channel: 'release',
}

const receipt = (id: string, overrides: Partial<Receipt> = {}): Receipt => ({
  schemaVersion: 1,
  kind: RECEIPT_KIND,
  id,
  status: 'passed',
  durationMs: 12,
  ...(id.startsWith('suite:') ? { tests: { passed: 3, failed: 0, skipped: 0 } } : {}),
  ...(id === 'unit'
    ? {
        tests: { passed: 4, failed: 0, skipped: 1 },
        suites: [
          { id: 'core:unit', status: 'passed', tests: { passed: 4, failed: 0, skipped: 1 } },
        ],
      }
    : {}),
  package: identity,
  ...overrides,
})

const standardsReceipts = (): Map<string, unknown> =>
  new Map(['format', 'lint', 'types', 'unit'].map((id) => [id, receipt(id)]))

const plan = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    schemaVersion: 1,
    standards: { stages: ['format', 'lint', 'types', 'unit'], unitSuites: ['core:unit'] },
    suites: [],
    external: [],
    manual: [],
    receipts: ['format', 'lint', 'types', 'unit'],
    ...overrides,
  })

const needs = (
  results: Record<string, string>,
  outputs: Record<string, Record<string, string>> = {},
): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(results).map(([job, result]) => [
        job,
        { result, outputs: outputs[job] ?? {} },
      ]),
    ),
  )

describe('receipts', () => {
  it('accepts a passing stage receipt', () => {
    expect(receiptProblems(receipt('lint'), 'lint')).toEqual([])
  })

  it('rejects a failed, mislabelled, or foreign receipt', () => {
    expect(
      receiptProblems(receipt('lint', { status: 'failed', message: '2 errors' }), 'lint'),
    ).toEqual(['lint: failed: 2 errors'])
    expect(receiptProblems(receipt('types'), 'lint')).toContain('lint: the receipt is for "types"')
    expect(receiptProblems({ schemaVersion: 2, kind: 'other' }, 'lint')[0]).toMatch(
      /unknown schema/,
    )
    expect(receiptProblems('not a receipt', 'lint')).toEqual(['lint: the receipt is not an object'])
  })

  it('treats a suite that executed no tests as a failure, not a pass', () => {
    const empty = receipt('suite:app:e2e', { tests: { passed: 0, failed: 0, skipped: 2 } })
    expect(receiptProblems(empty, 'suite:app:e2e')).toEqual([
      'suite:app:e2e: no tests executed; a required suite must run tests',
    ])
  })

  it('requires every unit suite listed in the unit receipt to have run tests', () => {
    const unit = receipt('unit', {
      suites: [{ id: 'core:unit', status: 'empty', tests: { passed: 0, failed: 0, skipped: 0 } }],
    })
    expect(receiptProblems(unit, 'unit')).toEqual(['unit: core:unit did not pass'])
  })

  it('stores each receipt under a file name derived from its id', () => {
    expect(receiptFileName('suite:app:e2e')).toBe('suite__app__e2e.json')
    expect(receiptFileName('format')).toBe('format.json')
  })

  it('fails a check that recorded nothing at all', () => {
    expect(verifyReceipts(new Map(), []).errors).toEqual([
      'no stage or suite was expected; refusing to report success for nothing',
    ])
    expect(verifyReceipts(new Map(), ['lint']).errors).toEqual([
      'lint: no receipt was recorded, so there is no evidence it ran',
    ])
  })
})

describe('the central workflow verification', () => {
  it('passes when the standards job succeeded, suites were skipped, and every receipt passed', () => {
    const verdict = verifyWorkflow({
      needs: needs({ standards: 'success', suites: 'skipped' }),
      plan: plan(),
      receipts: standardsReceipts(),
    })
    expect(verdict.errors).toEqual([])
    expect(verdict.summary?.verified).toBe(true)
    expect(verdict.summary?.receipts.map((entry) => entry.id)).toEqual([
      'format',
      'lint',
      'types',
      'unit',
    ])
  })

  it.each(['failure', 'cancelled', 'skipped'])(
    'fails when the standards job finished with %s',
    (result) => {
      const verdict = verifyWorkflow({
        needs: needs({ standards: result, suites: 'skipped' }),
        plan: plan(),
        receipts: standardsReceipts(),
      })
      expect(verdict.ok).toBe(false)
      expect(verdict.errors).toContain(`job standards finished with ${result}`)
    },
  )

  it('requires the suites job to run exactly when the plan has central suites', () => {
    const withSuites = plan({
      suites: [{ suite: 'app:e2e' }],
      receipts: ['format', 'lint', 'types', 'unit', 'suite:app:e2e'],
    })
    const receipts = standardsReceipts()
    receipts.set('suite:app:e2e', receipt('suite:app:e2e'))
    expect(
      verifyWorkflow({
        needs: needs({ standards: 'success', suites: 'skipped' }),
        plan: withSuites,
        receipts,
      }).errors,
    ).toContain('job suites finished with skipped')
    expect(
      verifyWorkflow({
        needs: needs({ standards: 'success', suites: 'success' }),
        plan: withSuites,
        receipts,
      }).ok,
    ).toBe(true)
    expect(
      verifyWorkflow({
        needs: needs({ standards: 'success', suites: 'success' }),
        plan: plan(),
        receipts: standardsReceipts(),
      }).errors,
    ).toContain('job suites ran (success) although the plan has no central suites')
  })

  it('fails on a missing, failed, or unrequired receipt', () => {
    const receipts = standardsReceipts()
    receipts.delete('types')
    receipts.set(
      'lint',
      receipt('lint', { status: 'error', message: 'eslint.config.mjs is missing' }),
    )
    receipts.set('suite:app:stray', receipt('suite:app:stray'))
    const verdict = verifyWorkflow({
      needs: needs({ standards: 'success', suites: 'skipped' }),
      plan: plan(),
      receipts,
    })
    expect(verdict.errors).toEqual([
      'lint: error: eslint.config.mjs is missing',
      'types: no receipt was recorded, so there is no evidence it ran',
      'suite:app:stray: a receipt the plan does not require; the plan and the run disagree',
    ])
  })

  it('fails when the unit stage ran other suites than the plan declares', () => {
    const verdict = verifyWorkflow({
      needs: needs({ standards: 'success', suites: 'skipped' }),
      plan: plan({
        standards: {
          stages: ['format', 'lint', 'types', 'unit'],
          unitSuites: ['core:unit', 'app:unit'],
        },
      }),
      receipts: standardsReceipts(),
    })
    expect(verdict.errors).toEqual([
      'unit: ran [core:unit] but the plan declares [app:unit, core:unit]',
    ])
  })

  it('fails on malformed input instead of guessing', () => {
    expect(
      verifyWorkflow({ needs: '{', plan: plan(), receipts: standardsReceipts() }).errors[0],
    ).toMatch(/^needs is not valid JSON/)
    expect(
      verifyWorkflow({ needs: needs({ standards: 'failure' }), plan: '', receipts: new Map() })
        .errors,
    ).toEqual(['the CI plan is empty; the standards job did not produce one'])
    expect(
      verifyWorkflow({
        needs: needs({ standards: 'success' }),
        plan: '{"schemaVersion":1}',
        receipts: new Map(),
      }).errors,
    ).toEqual(['the CI plan is malformed'])
    expect(
      verifyWorkflow({
        needs: needs({ standards: 'success', suites: 'skipped', extra: 'success' }),
        plan: plan(),
        receipts: standardsReceipts(),
      }).errors,
    ).toContain("job extra is not part of the reusable workflow's inventory")
  })

  it('keeps manual and delegated suites visible without requiring them', () => {
    const verdict = verifyWorkflow({
      needs: needs({ standards: 'success', suites: 'skipped' }),
      plan: plan({
        external: [{ suite: 'app:integration', job: 'app-integration' }],
        manual: [{ suite: 'app:device', reason: 'Needs a connected device' }],
      }),
      receipts: standardsReceipts(),
    })
    expect(verdict.ok).toBe(true)
    expect(verdict.notes).toEqual([
      'app:integration runs in the caller job app-integration',
      'app:device is manual and not part of this gate: Needs a connected device',
    ])
    expect(verdict.summary?.external).toEqual([
      { suite: 'app:integration', job: 'app-integration' },
    ])
  })
})

describe('the caller aggregate', () => {
  const standardsSummary = (context: Parameters<typeof createSummary>[1] = {}): string =>
    JSON.stringify(
      createSummary(
        ['format', 'lint', 'types', 'unit'].map((id) => receipt(id)),
        context,
      ),
    )
  const suiteSummary = (id: string, tests = { passed: 2, failed: 0, skipped: 0 }): string =>
    JSON.stringify(createSummary([receipt(`suite:${id}`, { tests })]))
  const inventory = (...jobs: Array<Record<string, string>>): string =>
    JSON.stringify([{ kind: 'standards', job: 'standards' }, ...jobs])

  it('passes when every required job succeeded with a verified receipt', () => {
    const verdict = verifyAggregate({
      needs: needs(
        { standards: 'success', 'app-integration': 'success' },
        {
          standards: {
            receipt: standardsSummary({
              external: [{ suite: 'app:integration', job: 'app-integration' }],
            }),
          },
          'app-integration': { receipt: suiteSummary('app:integration') },
        },
      ),
      required: inventory({ kind: 'suite', job: 'app-integration', suite: 'app:integration' }),
    })
    expect(verdict.errors).toEqual([])
    expect(verdict.ok).toBe(true)
  })

  it.each(['failure', 'cancelled', 'skipped'])(
    'fails when a required job finished with %s',
    (result) => {
      const verdict = verifyAggregate({
        needs: needs({ standards: result }, { standards: { receipt: standardsSummary() } }),
        required: inventory(),
      })
      expect(verdict.errors).toEqual([`job standards finished with ${result}`])
    },
  )

  it('fails when a required job is missing, unknown, or published no receipt', () => {
    expect(verifyAggregate({ needs: needs({}), required: inventory() }).errors).toEqual([
      'job standards is required but missing from needs',
    ])
    expect(
      verifyAggregate({
        needs: needs(
          { standards: 'success', lint: 'success' },
          { standards: { receipt: standardsSummary() } },
        ),
        required: inventory(),
      }).errors,
    ).toEqual(['job lint is in needs but not in the required inventory; run `toolpath-dev sync`'])
    expect(
      verifyAggregate({ needs: needs({ standards: 'success' }), required: inventory() }).errors,
    ).toEqual(['job standards: its receipt output is empty'])
  })

  it('fails on a malformed or unverified receipt output', () => {
    expect(
      verifyAggregate({
        needs: needs({ standards: 'success' }, { standards: { receipt: '{"kind":"other"}' } }),
        required: inventory(),
      }).errors,
    ).toEqual(['job standards: its receipt output is malformed'])
    const unverified = JSON.stringify({ ...createSummary([]), verified: false })
    expect(
      verifyAggregate({
        needs: needs({ standards: 'success' }, { standards: { receipt: unverified } }),
        required: inventory(),
      }).errors,
    ).toEqual(['job standards did not verify its receipts'])
  })

  it('fails a suite job that executed no tests or reported another suite', () => {
    const verdict = verifyAggregate({
      needs: needs(
        { standards: 'success', 'app-integration': 'success' },
        {
          standards: { receipt: standardsSummary() },
          'app-integration': { receipt: suiteSummary('app:other') },
        },
      ),
      required: inventory({ kind: 'suite', job: 'app-integration', suite: 'app:integration' }),
    })
    expect(verdict.errors).toEqual(['job app-integration: no receipt for app:integration'])
    const empty = verifyAggregate({
      needs: needs(
        { standards: 'success', 'app-integration': 'success' },
        {
          standards: { receipt: standardsSummary() },
          'app-integration': {
            receipt: suiteSummary('app:integration', { passed: 0, failed: 0, skipped: 0 }),
          },
        },
      ),
      required: inventory({ kind: 'suite', job: 'app-integration', suite: 'app:integration' }),
    })
    expect(empty.errors).toEqual(['job app-integration: app:integration executed no tests'])
  })

  it('fails when the central plan delegates a suite the caller does not wire up', () => {
    const verdict = verifyAggregate({
      needs: needs(
        { standards: 'success' },
        {
          standards: {
            receipt: standardsSummary({
              external: [{ suite: 'app:integration', job: 'app-integration' }],
            }),
          },
        },
      ),
      required: inventory(),
    })
    expect(verdict.errors).toEqual([
      'app:integration is delegated to a caller job (app-integration) that the quality job does not require; run `toolpath-dev sync`',
    ])
  })

  it('reports manual suites without failing', () => {
    const verdict = verifyAggregate({
      needs: needs(
        { standards: 'success' },
        {
          standards: {
            receipt: standardsSummary({
              manual: [{ suite: 'app:device', reason: 'Needs a device' }],
            }),
          },
        },
      ),
      required: inventory(),
    })
    expect(verdict.ok).toBe(true)
    expect(verdict.notes).toEqual([
      'app:device is manual and not part of this gate: Needs a device',
    ])
  })

  it('rejects a malformed inventory or needs document', () => {
    expect(readRequiredJobs('[]')).toEqual({
      ok: false,
      error: 'the required job inventory must be a nonempty array',
    })
    expect(
      readRequiredJobs('[{"kind":"standards","job":"a"},{"kind":"standards","job":"a"}]'),
    ).toEqual({
      ok: false,
      error: 'the required job inventory lists a twice',
    })
    expect(readRequiredJobs('[{"kind":"other","job":"a"}]')).toEqual({
      ok: false,
      error: 'the required job inventory entry for a has an unknown kind',
    })
    expect(readNeeds('[]')).toEqual({ ok: false, error: 'needs is not an object' })
    expect(readNeeds('{"a":{}}')).toEqual({ ok: false, error: 'needs.a has no result' })
  })
})
