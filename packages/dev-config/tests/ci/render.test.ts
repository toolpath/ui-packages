import { afterAll, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  ACTION_PINS,
  AGGREGATE_JOB,
  CALLER_WORKFLOW_PATH,
  callerWorkflowIssues,
  renderCallerWorkflow,
  scalar,
} from '../../src/ci/render.js'
import {
  appFiles,
  appWithSuites,
  FIXTURE_SHA,
  releaseIdentity,
  removeRepositories,
  resolveFixture,
} from './fixture.js'

afterAll(removeRepositories)

type Workflow = {
  on: Record<string, unknown>
  permissions: Record<string, string>
  concurrency: { group: string; 'cancel-in-progress': string }
  jobs: Record<string, Record<string, unknown>>
}

const render = (
  input = appWithSuites(),
): {
  text: string
  workflow: Workflow
  resolved: ReturnType<typeof resolveFixture>['resolved']
} => {
  const { resolved } = resolveFixture(input, appFiles)
  const text = renderCallerWorkflow(resolved, releaseIdentity(), { defaultBranch: 'main' })
  return { text, workflow: parse(text) as Workflow, resolved }
}

const steps = (job: Record<string, unknown>): Array<Record<string, unknown>> =>
  job.steps as Array<Record<string, unknown>>

describe('renderCallerWorkflow', () => {
  it('lives where GitHub reads workflows', () => {
    expect(CALLER_WORKFLOW_PATH).toBe('.github/workflows/quality.yml')
  })

  it('triggers on pull requests, default-branch pushes and the merge queue, with read-only contents', () => {
    const { workflow } = render()
    expect(Object.keys(workflow.on)).toEqual(['pull_request', 'push', 'merge_group'])
    expect(workflow.on.push).toEqual({ branches: ['main'] })
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(Object.keys(workflow.on)).not.toContain('pull_request_target')
  })

  it('cancels only superseded pull request runs of this workflow and ref', () => {
    const { workflow } = render()
    expect(workflow.concurrency).toEqual({
      group: '${{ github.workflow_ref }}',
      'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
    })
  })

  it('calls the central workflow at the installed release’s full source SHA, without secrets', () => {
    const { workflow, text } = render()
    expect(workflow.jobs.standards).toEqual({
      uses: `toolpath/ui-packages/.github/workflows/dev-config-quality.yml@${FIXTURE_SHA}`,
      with: { 'working-directory': '.' },
    })
    expect(text).not.toMatch(/secrets:\s*inherit/)
  })

  it('generates one skeleton job per delegated suite with only its named secrets', () => {
    const { workflow } = render()
    const job = workflow.jobs['app-integration']
    expect(job).toMatchObject({
      name: 'app:integration',
      'runs-on': 'ubuntu-24.04',
      'timeout-minutes': 50,
      outputs: { receipt: '${{ steps.check.outputs.receipt }}' },
    })
    const uses = steps(job ?? {}).map((step) => step.uses)
    expect(uses).toEqual([
      `actions/checkout@${ACTION_PINS['actions/checkout']?.sha ?? ''}`,
      `toolpath/ui-packages/.github/actions/dev-config-setup@${FIXTURE_SHA}`,
      `toolpath/ui-packages/.github/actions/dev-config-check@${FIXTURE_SHA}`,
    ])
    expect(steps(job ?? {})[2]).toMatchObject({
      id: 'check',
      with: { suite: 'app:integration' },
      env: { DATABASE_URL: '${{ secrets.DATABASE_URL }}' },
    })
  })

  it('aggregates every required job in an always-running quality job', () => {
    const { workflow } = render()
    const quality = workflow.jobs[AGGREGATE_JOB] ?? {}
    expect(quality).toMatchObject({
      name: 'quality',
      if: 'always()',
      needs: ['standards', 'app-integration'],
    })
    const [result] = steps(quality)
    expect(result?.uses).toBe(
      `toolpath/ui-packages/.github/actions/dev-config-result@${FIXTURE_SHA}`,
    )
    const inputs = result?.with as Record<string, string>
    expect(inputs.needs).toBe('${{ toJSON(needs) }}')
    expect(JSON.parse(inputs.required ?? '')).toEqual([
      { kind: 'standards', job: 'standards' },
      { kind: 'suite', job: 'app-integration', suite: 'app:integration' },
    ])
  })

  it('pins every third-party action to a full commit SHA', () => {
    const { text } = render()
    const references = [...text.matchAll(/uses: (\S+)/g)].map((match) => match[1] ?? '')
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) {
      expect(reference).toMatch(/@[0-9a-f]{40}$/)
    }
  })

  it('refuses a development identity', () => {
    const { resolved } = resolveFixture(appWithSuites(), appFiles)
    expect(() =>
      renderCallerWorkflow(
        resolved,
        { ...releaseIdentity(), channel: 'development' },
        { defaultBranch: 'main' },
      ),
    ).toThrow(/development release metadata/)
  })

  it('renders a caller that needs only the standards job when nothing is delegated', () => {
    const { workflow } = render({ ...appWithSuites(), ci: {} })
    expect(Object.keys(workflow.jobs)).toEqual(['standards', 'quality'])
    expect(workflow.jobs.quality?.needs).toEqual(['standards'])
  })

  it('quotes scalars YAML would otherwise reinterpret', () => {
    expect(scalar('.')).toBe('.')
    expect(scalar('apps/app')).toBe('apps/app')
    expect(scalar('on')).toBe('"on"')
    expect(scalar('a b')).toBe('"a b"')
    expect(scalar('1.0')).toBe('"1.0"')
  })
})

describe('callerWorkflowIssues', () => {
  it('accepts the rendered caller', () => {
    const { text, resolved } = render()
    expect(callerWorkflowIssues(text, resolved, releaseIdentity())).toEqual([])
  })

  it('reports a caller from another release', () => {
    const { text, resolved } = render()
    const issues = callerWorkflowIssues(text, resolved, releaseIdentity('b'.repeat(40)))
    expect(issues.map((issue) => issue.path)).toContain(
      `${CALLER_WORKFLOW_PATH}: jobs.standards.uses`,
    )
  })

  it('reports mutable references, inherited secrets and privileged triggers', () => {
    const { text, resolved } = render()
    const tampered = text
      .replace(/actions\/checkout@[0-9a-f]{40}/, 'actions/checkout@v7')
      .replace(
        '    with:\n      working-directory: .\n',
        '    secrets: inherit\n    with:\n      working-directory: .\n',
      )
      .replace('  merge_group:\n', '  merge_group:\n  pull_request_target:\n')
    const messages = callerWorkflowIssues(tampered, resolved, releaseIdentity()).map(
      (issue) => issue.message,
    )
    expect(messages).toContain('actions/checkout@v7 is not pinned to a full commit SHA')
    expect(messages).toContain(
      '`secrets: inherit` is not allowed; pass only the named secrets a job needs',
    )
    expect(messages).toContain('runs repository code with privileged credentials; remove it')
  })

  it('reports a delegated suite the aggregate does not require', () => {
    const { text, resolved } = render()
    const unwired = text.replace('      - app-integration\n', '')
    const messages = callerWorkflowIssues(unwired, resolved, releaseIdentity()).map(
      (issue) => issue.message,
    )
    expect(messages).toContain('must include app-integration')
  })

  it('reports an inventory that dev.config.mjs has moved past', () => {
    const { text } = render({ ...appWithSuites(), ci: {} })
    const { resolved } = resolveFixture(appWithSuites(), appFiles)
    const messages = callerWorkflowIssues(text, resolved, releaseIdentity()).map(
      (issue) => issue.message,
    )
    expect(messages).toContain('is missing; it runs the delegated suite app:integration')
    expect(messages).toContain('must include app-integration')
    expect(messages).toContain(
      'the required inventory does not match dev.config.mjs (ci.externalSuites); run `toolpath-dev sync`',
    )
  })

  it('reports an aggregate that can be skipped', () => {
    const { text, resolved } = render()
    const skippable = text.replace('    if: always()\n', '')
    expect(
      callerWorkflowIssues(skippable, resolved, releaseIdentity()).map((issue) => issue.path),
    ).toContain(`${CALLER_WORKFLOW_PATH}: jobs.quality.if`)
  })

  it('reports invalid YAML', () => {
    const { resolved } = render()
    expect(callerWorkflowIssues('jobs: [', resolved, releaseIdentity())[0]?.message).toMatch(
      /^is not valid YAML/,
    )
  })
})
