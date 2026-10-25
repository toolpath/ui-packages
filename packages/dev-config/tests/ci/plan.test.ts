import { afterAll, describe, expect, it } from 'vitest'
import { createCiPlan, suiteMatrix } from '../../src/ci/plan.js'
import { appFiles, appWithSuites, removeRepositories, resolveFixture } from './fixture.js'

afterAll(removeRepositories)

describe('createCiPlan', () => {
  it('runs every standards stage and every ordinary suite in the standards job', () => {
    const { resolved } = resolveFixture(appWithSuites(), appFiles)
    const plan = createCiPlan(resolved)
    expect(plan.standards).toEqual({
      stages: ['format', 'lint', 'types', 'unit'],
      unitSuites: ['core:unit', 'app:unit'],
      builds: ['core'],
      timeoutMinutes: 20,
    })
  })

  it('gives required browser and command suites bounded jobs, and delegates or excludes the rest', () => {
    const { resolved } = resolveFixture(appWithSuites(), appFiles)
    const plan = createCiPlan(resolved)
    expect(plan.suites).toEqual([
      {
        suite: 'app:browser',
        project: 'app',
        runner: 'playwright',
        browsers: ['chromium'],
        timeoutMinutes: 30,
        builds: ['core'],
        prerequisites: { env: [], commands: [] },
        key: 'app-browser',
      },
    ])
    expect(plan.external).toEqual([
      {
        suite: 'app:integration',
        project: 'app',
        job: 'app-integration',
        runner: 'command',
        prerequisites: { env: ['DATABASE_URL'], commands: ['psql'] },
      },
    ])
    expect(plan.manual).toEqual([
      { suite: 'app:device', reason: 'Needs a connected device that hosted runners do not have' },
    ])
    expect(plan.receipts).toEqual(['format', 'lint', 'types', 'unit', 'suite:app:browser'])
  })

  it('is deterministic', () => {
    const { resolved } = resolveFixture(appWithSuites(), appFiles)
    expect(JSON.stringify(createCiPlan(resolved))).toBe(JSON.stringify(createCiPlan(resolved)))
  })

  it('bounds a command suite job by its declared timeout plus setup time', () => {
    const input = appWithSuites()
    const { resolved } = resolveFixture({ ...input, ci: {} }, appFiles)
    const integration = createCiPlan(resolved).suites.find(
      (entry) => entry.suite === 'app:integration',
    )
    expect(integration?.timeoutMinutes).toBe(50)
  })

  it('produces the matrix rows the reusable workflow expands', () => {
    const { resolved } = resolveFixture(appWithSuites(), appFiles)
    expect(suiteMatrix(createCiPlan(resolved))).toEqual([
      { suite: 'app:browser', key: 'app-browser', browsers: 'chromium', timeout: 30 },
    ])
  })

  it('has no central suite jobs for a repository with only unit suites', () => {
    const { resolved } = resolveFixture(
      {
        projects: [
          {
            name: 'lib',
            root: '.',
            kind: 'library',
            runtime: 'node',
            tsconfig: 'tsconfig.json',
            suites: { unit: { runner: 'vitest', config: 'vitest.config.ts' } },
          },
        ],
      },
      { 'vitest.config.ts': '' },
    )
    const plan = createCiPlan(resolved)
    expect(plan.suites).toEqual([])
    expect(plan.receipts).toEqual(['format', 'lint', 'types', 'unit'])
  })
})
