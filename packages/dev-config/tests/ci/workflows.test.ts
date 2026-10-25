import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import pins from '../../src/ci/pins.json' with { type: 'json' }
import { ACTION_PINS, TOOL_PINS } from '../../src/ci/render.js'
import { toolchain } from '../../src/policy/toolchain.js'
import { applyPins, CI_FILES } from '../../scripts/sync-action-pins.mjs'

const repositoryFile = (path: string): string =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8')

type Step = {
  uses?: string
  run?: string
  with?: Record<string, unknown>
  if?: string
  id?: string
}
type Job = {
  'runs-on'?: string
  'timeout-minutes'?: number | string
  steps?: Array<Step>
  needs?: Array<string> | string
  if?: string
  strategy?: { 'fail-fast'?: boolean; 'max-parallel'?: number }
}
type Workflow = {
  on: Record<string, unknown>
  permissions?: Record<string, string>
  jobs: Record<string, Job>
}
type Action = { runs: { using: string; main?: string; steps?: Array<Step> } }

const quality = (): Workflow =>
  parse(repositoryFile('.github/workflows/dev-config-quality.yml')) as Workflow
const selftest = (): Workflow =>
  parse(repositoryFile('.github/workflows/dev-config-selftest.yml')) as Workflow
const action = (name: string): Action =>
  parse(repositoryFile(`.github/actions/${name}/action.yml`)) as Action

const steps = (workflow: Workflow): Array<{ job: string; step: Step }> =>
  Object.entries(workflow.jobs).flatMap(([job, definition]) =>
    (definition.steps ?? []).map((step) => ({ job, step })),
  )

describe('the pinned references', () => {
  it('match the one registry in every shared CI file', () => {
    const stale = CI_FILES.filter((file) => {
      const text = repositoryFile(file)
      const pinned = applyPins(text, pins)
      return pinned.unknown.length > 0 || pinned.text !== text
    })
    expect(stale).toEqual([])
  })

  it('are full commit SHAs, or this repository’s own local actions', () => {
    const mutable = CI_FILES.flatMap((file) =>
      [...repositoryFile(file).matchAll(/uses: (\S+)/g)]
        .map((match) => match[1] ?? '')
        .filter(
          (reference) =>
            !reference.startsWith('./') && !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(reference),
        )
        .map((reference) => `${file}: ${reference}`),
    )
    expect(mutable).toEqual([])
    expect(
      Object.values(ACTION_PINS).filter(
        (pin) => !/^[0-9a-f]{40}$/.test(pin.sha) || !/^v\d+\.\d+\.\d+$/.test(pin.version),
      ),
    ).toEqual([])
  })

  it('verify the actionlint download against its published SHA-256', () => {
    const text = repositoryFile('.github/workflows/dev-config-selftest.yml')
    expect(text).toContain(TOOL_PINS.actionlint?.url ?? 'missing')
    expect(text).toContain(`ACTIONLINT_SHA256: ${TOOL_PINS.actionlint?.sha256 ?? 'missing'}`)
    expect(text).toContain('sha256sum --check --strict')
  })
})

describe('the central reusable workflow', () => {
  it('is only callable, with repository facts as its only inputs', () => {
    const workflow = quality()
    expect(Object.keys(workflow.on)).toEqual(['workflow_call'])
    const call = workflow.on.workflow_call as { inputs: Record<string, { type: string }> }
    expect(Object.entries(call.inputs).map(([name, input]) => [name, input.type])).toEqual([
      ['working-directory', 'string'],
      ['config', 'string'],
    ])
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })

  it('checks out its own source at .toolpath/ci-source, by workflow identity, without credentials', () => {
    const workflow = quality()
    const sources = Object.entries(workflow.jobs).map(([job, definition]) => ({
      job,
      source: (definition.steps ?? []).find((step) => step.with?.path === '.toolpath/ci-source')
        ?.with,
    }))
    expect(sources).toEqual(
      Object.keys(workflow.jobs).map((job) => ({
        job,
        source: {
          repository: '${{ job.workflow_repository }}',
          ref: '${{ job.workflow_sha }}',
          path: '.toolpath/ci-source',
          'persist-credentials': false,
        },
      })),
    )
    const checkouts = steps(workflow).filter(({ step }) =>
      step.uses?.startsWith('actions/checkout@'),
    )
    expect(checkouts.filter(({ step }) => step.with?.['persist-credentials'] !== false)).toEqual([])
    const local = steps(workflow)
      .map(({ step }) => step.uses)
      .filter((reference) => reference?.startsWith('./'))
    expect(
      local.filter(
        (reference) =>
          !/^\.\/\.toolpath\/ci-source\/\.github\/actions\/dev-config-(setup|check|result)$/.test(
            reference ?? '',
          ),
      ),
    ).toEqual([])
    expect(repositoryFile('.github/workflows/dev-config-quality.yml')).not.toMatch(
      /github\.(repository|sha)\b/,
    )
  })

  it('bounds every job and runs on the pinned image', () => {
    const workflow = quality()
    expect(
      Object.fromEntries(
        Object.entries(workflow.jobs).map(([job, definition]) => [
          job,
          [definition['runs-on'], definition['timeout-minutes']],
        ]),
      ),
    ).toEqual({
      standards: [toolchain.ci.runner, toolchain.ci.timeouts.quality],
      suites: [toolchain.ci.runner, '${{ matrix.timeout }}'],
      verify: [toolchain.ci.runner, 5],
    })
  })

  it('never lets a quality stage fail quietly', () => {
    const quiet = CI_FILES.filter((file) =>
      /continue-on-error|\|\|\s*true|pull_request_target|secrets:\s*inherit/.test(
        repositoryFile(file),
      ),
    )
    expect(quiet).toEqual([])
  })

  it('verifies every job and receipt in an always-running job whose summary is the workflow output', () => {
    const workflow = quality()
    const verify = workflow.jobs.verify
    expect(verify?.if).toBe('always()')
    expect(verify?.needs).toEqual(['standards', 'suites'])
    expect(verify?.steps?.at(-1)).toMatchObject({
      id: 'result',
      uses: './.toolpath/ci-source/.github/actions/dev-config-result',
      with: { needs: '${{ toJSON(needs) }}', plan: '${{ needs.standards.outputs.plan }}' },
    })
    const call = workflow.on.workflow_call as { outputs: Record<string, { value: string }> }
    expect(call.outputs.receipt?.value).toBe('${{ jobs.verify.outputs.receipt }}')
  })

  it('runs central suites only when the plan has them, in a bounded matrix', () => {
    const suites = quality().jobs.suites
    expect(suites?.if).toBe("${{ !cancelled() && needs.standards.outputs.has-suites == 'true' }}")
    expect(suites?.strategy).toMatchObject({ 'fail-fast': false, 'max-parallel': 2 })
  })

  it('retains receipts and failure reports for seven days, without hidden files', () => {
    const uploads = steps(quality()).filter(({ step }) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    )
    expect(uploads.length).toBeGreaterThan(0)
    expect(
      uploads.filter(
        ({ step }) => step.with?.['retention-days'] !== toolchain.ci.artifactRetentionDays,
      ),
    ).toEqual([])
    const upload = action('dev-config-check').runs.steps?.find((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    )
    expect(upload).toMatchObject({
      if: 'failure()',
      with: { 'include-hidden-files': false, 'retention-days': 7 },
    })
    expect(String(upload?.with?.path)).toContain('!**/.env*')
  })
})

describe('the shared actions', () => {
  it('pass inputs to scripts through the environment, never as shell source', () => {
    const scripts = ['dev-config-setup', 'dev-config-check'].flatMap((name) =>
      (action(name).runs.steps ?? []).flatMap((step) => (step.run === undefined ? [] : [step.run])),
    )
    expect(scripts.length).toBeGreaterThan(0)
    expect(
      scripts.filter(
        (script) =>
          script.includes('${{') || !script.startsWith('node "$GITHUB_ACTION_PATH/index.mjs"'),
      ),
    ).toEqual([])
  })

  it('run the result action on node24 from committed source', () => {
    expect(action('dev-config-result').runs).toEqual({ using: 'node24', main: 'index.mjs' })
    expect(repositoryFile('.github/actions/dev-config-result/index.mjs')).toContain(
      "from '../../../packages/dev-config/src/ci/actions/result.mjs'",
    )
  })

  it('install with a frozen lockfile and cache the store, never node_modules', () => {
    const caches = (action('dev-config-setup').runs.steps ?? []).filter((step) =>
      step.uses?.startsWith('actions/cache@'),
    )
    expect(caches.map((step) => step.with?.path)).toEqual([
      '${{ steps.store.outputs.path }}',
      '~/.cache/ms-playwright',
    ])
    const setup = repositoryFile('packages/dev-config/src/ci/actions/setup.mjs')
    expect(setup).toMatch(/'install', '--frozen-lockfile'/)
    expect(setup).toMatch(/run\('npm', \['ci'\]/)
  })
})

describe('the selftest workflow', () => {
  it('runs on changes to the package and its CI without credentials', () => {
    const workflow = selftest()
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(repositoryFile('.github/workflows/dev-config-selftest.yml')).not.toMatch(/secrets\./)
    expect((workflow.on.pull_request as { paths: Array<string> }).paths).toEqual(
      expect.arrayContaining([
        'packages/dev-config/**',
        '.github/actions/dev-config-*/**',
        '.github/workflows/dev-config-*.yml',
      ]),
    )
  })

  it('exercises the real setup, check and result actions for npm and pnpm consumers', () => {
    const workflow = selftest()
    const local = Object.fromEntries(
      ['consumer-npm', 'consumer-pnpm'].map((job) => [
        job,
        (workflow.jobs[job]?.steps ?? [])
          .map((step) => step.uses)
          .filter((reference) => reference?.startsWith('./')),
      ]),
    )
    const expected = [
      './.github/actions/dev-config-setup',
      './.github/actions/dev-config-check',
      './.github/actions/dev-config-check',
      './.github/actions/dev-config-result',
    ]
    expect(local).toEqual({ 'consumer-npm': expected, 'consumer-pnpm': expected })
    expect(workflow.jobs.aggregate).toMatchObject({
      if: 'always()',
      needs: ['consumer-npm', 'consumer-pnpm'],
    })
  })
})
