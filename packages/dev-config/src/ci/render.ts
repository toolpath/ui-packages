import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseDocument } from 'yaml'
import { relativePosix } from '../config/files.js'
import type { ResolvedConfig } from '../config/resolve.js'
import type { Issue } from '../errors.js'
import {
  ACTION_PATHS,
  assertInstallableIdentity,
  WORKFLOW_PATH,
  type ReleaseIdentity,
} from '../release/metadata.js'
import pins from './pins.json' with { type: 'json' }
import { createCiPlan, type ExternalJob } from './plan.js'
import { readRequiredJobs, type RequiredJob } from './result-policy.mjs'

/** Relative to the repository (Git) root, where GitHub reads workflows. */
export const CALLER_WORKFLOW_PATH = '.github/workflows/quality.yml'

/** The aggregate job's ID and check name: what branch protection requires. */
export const AGGREGATE_JOB = 'quality'
const STANDARDS_JOB = 'standards'

export interface ActionPin {
  version: string
  sha: string
}

export const ACTION_PINS: Readonly<Record<string, ActionPin>> = pins.actions

export const TOOL_PINS: Readonly<Record<string, { version: string; url: string; sha256: string }>> =
  pins.tools

/** `uses:` for a pinned third-party action, with its release tag as a comment. */
const pinnedUses = (action: string): string => {
  const pin = ACTION_PINS[action]
  if (!pin) {
    throw new Error(`${action} has no entry in src/ci/pins.json`)
  }
  return `${action}@${pin.sha} # ${pin.version}`
}

export interface CallerOptions {
  /** The branch whose pushes run the gate. Default: the remote's default branch, else `main`. */
  defaultBranch?: string
}

const git = (cwd: string, args: Array<string>): string | undefined => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : undefined
}

/** The repository's default branch as its `origin` remote records it. */
const detectDefaultBranch = (root: string): string => {
  const head = git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
  return head?.replace(/^origin\//, '') || 'main'
}

/** The configuration root relative to the Git root, where `working-directory` starts. */
const workingDirectoryOf = (resolved: ResolvedConfig): string => {
  const top = git(resolved.root, ['rev-parse', '--show-toplevel'])
  if (!top) {
    return '.'
  }
  return relativePosix(realpathSync(top), resolved.root) || '.'
}

/** The `config` input, when the configuration is not `<working-directory>/dev.config.mjs`. */
const configInput = (resolved: ResolvedConfig): string | undefined => {
  // `init` renders the caller before it writes the configuration file itself.
  const file = existsSync(resolved.config.file)
    ? realpathSync(resolved.config.file)
    : join(realpathSync(dirname(resolved.config.file)), basename(resolved.config.file))
  if (dirname(file) === resolved.root && basename(file) === 'dev.config.mjs') {
    return undefined
  }
  return relativePosix(resolved.root, file)
}

const PLAIN = /^[A-Za-z0-9_./@-][A-Za-z0-9_./@:-]*$/
const AMBIGUOUS =
  /^(true|false|yes|no|y|n|on|off|null|~|[-+]?(\d[\d_]*(\.\d*)?|\.\d+)(e[-+]?\d+)?|[-+]?\.(inf|nan))$/i

/** A YAML scalar: plain when that is unambiguous, otherwise a JSON (double-quoted) string. */
export const scalar = (value: string): string =>
  PLAIN.test(value) && !AMBIGUOUS.test(value) ? value : JSON.stringify(value)

const releaseRef = (identity: ReleaseIdentity, path: string): string =>
  `${identity.repository}/${path}@${identity.sourceSha ?? ''} # @toolpath/dev-config ${identity.version}`

/** The inventory the aggregate job checks, in `needs` order. */
const requiredJobs = (external: ReadonlyArray<ExternalJob>): Array<RequiredJob> => [
  { kind: 'standards', job: STANDARDS_JOB },
  ...external.map((entry): RequiredJob => ({ kind: 'suite', job: entry.job, suite: entry.suite })),
]

const externalJobTimeout = (resolved: ResolvedConfig, entry: ExternalJob): number => {
  const suite = resolved.projects
    .find((project) => project.name === entry.project)
    ?.suites.find((candidate) => candidate.id === entry.suite)
  const minutes = suite?.timeoutMinutes
  return minutes === undefined ? 30 : Math.min(120, Math.max(30, minutes + 10))
}

const renderExternalJob = (
  resolved: ResolvedConfig,
  identity: ReleaseIdentity,
  entry: ExternalJob,
  workingDirectory: string,
  config: string | undefined,
): Array<string> => {
  const suite = resolved.projects
    .find((project) => project.name === entry.project)
    ?.suites.find((candidate) => candidate.id === entry.suite)
  const browsers = suite?.runner === 'playwright' ? suite.browsers : []
  const lines = [
    `  ${entry.job}:`,
    `    name: ${scalar(entry.suite)}`,
    '    runs-on: ubuntu-24.04',
    `    timeout-minutes: ${externalJobTimeout(resolved, entry)}`,
    '    outputs:',
    '      receipt: ${{ steps.check.outputs.receipt }}',
    '    steps:',
    `      - uses: ${pinnedUses('actions/checkout')}`,
    '        with:',
    '          persist-credentials: false',
    `      - uses: ${releaseRef(identity, ACTION_PATHS.setup)}`,
    '        with:',
    `          working-directory: ${scalar(workingDirectory)}`,
    ...(config === undefined ? [] : [`          config: ${scalar(config)}`]),
    ...(browsers.length === 0 ? [] : [`          browsers: ${scalar(browsers.join(' '))}`]),
    `      # Application setup for ${entry.suite} belongs here and is owned by this repository:`,
    '      # service containers (jobs.<id>.services), simulators, or fixture deployment.',
    ...(entry.prerequisites.commands.length === 0
      ? []
      : [
          `      # The suite needs these executables on PATH: ${entry.prerequisites.commands.join(', ')}.`,
        ]),
    '      - id: check',
    `        uses: ${releaseRef(identity, ACTION_PATHS.check)}`,
    '        with:',
    `          working-directory: ${scalar(workingDirectory)}`,
    ...(config === undefined ? [] : [`          config: ${scalar(config)}`]),
    `          suite: ${scalar(entry.suite)}`,
  ]
  if (entry.prerequisites.env.length > 0) {
    lines.push(
      '        # Only the named secrets this suite declares; secrets are never inherited.',
      '        env:',
      ...entry.prerequisites.env.map((name) => `          ${name}: \${{ secrets.${name} }}`),
    )
  }
  return lines
}

/**
 * The consumer's caller workflow. It contains only repository facts: the
 * central reusable workflow at the installed release's full source SHA, one
 * skeleton job per delegated suite, and the always-running aggregate `quality`
 * job that branch protection requires.
 */
export const renderCallerWorkflow = (
  resolved: ResolvedConfig,
  identity: ReleaseIdentity,
  options: CallerOptions = {},
): string => {
  assertInstallableIdentity(identity)
  const plan = createCiPlan(resolved)
  const workingDirectory = workingDirectoryOf(resolved)
  const config = configInput(resolved)
  const branch = options.defaultBranch ?? detectDefaultBranch(resolved.root)
  const inventory = requiredJobs(plan.external)

  const lines = [
    `# Managed by @toolpath/dev-config ${identity.version}. \`toolpath-dev sync\` updates it to the`,
    '# installed release and keeps your edits where they do not overlap. Branch protection',
    `# requires the \`${AGGREGATE_JOB}\` check. See node_modules/@toolpath/dev-config/docs/ci.md.`,
    'name: Quality',
    '',
    'on:',
    '  pull_request:',
    '  push:',
    '    branches:',
    `      - ${scalar(branch)}`,
    '  merge_group:',
    '',
    'permissions:',
    '  contents: read',
    '',
    '# One run per workflow file and ref; a newer push supersedes an older pull request run only.',
    'concurrency:',
    '  group: ${{ github.workflow_ref }}',
    "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
    '',
    'jobs:',
    `  ${STANDARDS_JOB}:`,
    `    uses: ${releaseRef(identity, WORKFLOW_PATH)}`,
    '    with:',
    `      working-directory: ${scalar(workingDirectory)}`,
    ...(config === undefined ? [] : [`      config: ${scalar(config)}`]),
  ]
  for (const entry of plan.external) {
    lines.push('', ...renderExternalJob(resolved, identity, entry, workingDirectory, config))
  }
  lines.push(
    '',
    `  ${AGGREGATE_JOB}:`,
    `    name: ${AGGREGATE_JOB}`,
    '    if: always()',
    '    needs:',
    ...inventory.map((entry) => `      - ${entry.job}`),
    '    runs-on: ubuntu-24.04',
    '    timeout-minutes: 5',
    '    steps:',
    `      - uses: ${releaseRef(identity, ACTION_PATHS.result)}`,
    '        with:',
    '          needs: ${{ toJSON(needs) }}',
    '          required: |',
    '            [',
    ...inventory.map(
      (entry, index) =>
        `              ${JSON.stringify(entry)}${index === inventory.length - 1 ? '' : ','}`,
    ),
    '            ]',
  )
  return `${lines.join('\n')}\n`
}

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const FULL_SHA = /^[0-9a-f]{40}$/

/** Every `uses:` value in a workflow document, with where it appears. */
const usesReferences = (document: Node): Array<{ path: string; uses: string }> => {
  const found: Array<{ path: string; uses: string }> = []
  const jobs = isNode(document.jobs) ? document.jobs : {}
  for (const [job, definition] of Object.entries(jobs)) {
    if (!isNode(definition)) {
      continue
    }
    if (typeof definition.uses === 'string') {
      found.push({ path: `jobs.${job}.uses`, uses: definition.uses })
    }
    const steps = Array.isArray(definition.steps) ? definition.steps : []
    steps.forEach((step: unknown, index) => {
      if (isNode(step) && typeof step.uses === 'string') {
        found.push({ path: `jobs.${job}.steps[${index}].uses`, uses: step.uses })
      }
    })
  }
  return found
}

const containsInherit = (value: unknown): boolean => {
  if (value === 'inherit') {
    return true
  }
  if (Array.isArray(value)) {
    return value.some(containsInherit)
  }
  return isNode(value) && Object.values(value).some(containsInherit)
}

const stepUsing = (definition: Node, prefix: string): Node | undefined =>
  (Array.isArray(definition.steps) ? definition.steps : []).find(
    (step: unknown): step is Node =>
      isNode(step) && typeof step.uses === 'string' && step.uses.startsWith(prefix),
  )

/**
 * Problems with a caller workflow, for `doctor`: missing or mutable references,
 * a release mismatch, privileged triggers, inherited secrets, and an aggregate
 * job that does not require every delegated suite.
 */
export const callerWorkflowIssues = (
  text: string,
  resolved: ResolvedConfig,
  identity: ReleaseIdentity,
): Array<Issue> => {
  const where = CALLER_WORKFLOW_PATH
  const issue = (path: string, message: string): Issue => ({ path: `${where}: ${path}`, message })
  const issues: Array<Issue> = []
  const parsed = parseDocument(text)
  if (parsed.errors.length > 0) {
    return [issue('document', `is not valid YAML: ${parsed.errors[0]?.message ?? ''}`)]
  }
  const document: unknown = parsed.toJS()
  if (!isNode(document)) {
    return [issue('document', 'is not a workflow')]
  }
  const sha = identity.sourceSha ?? ''
  const triggers = isNode(document.on) ? document.on : undefined
  if (!triggers) {
    issues.push(
      issue('on', 'must trigger on pull_request, push to the default branch, and merge_group'),
    )
  } else {
    for (const trigger of ['pull_request', 'merge_group']) {
      if (!(trigger in triggers)) {
        issues.push(issue(`on.${trigger}`, 'is missing'))
      }
    }
    const push = triggers.push
    const branches = isNode(push) && Array.isArray(push.branches) ? push.branches : []
    if (branches.length !== 1 || typeof branches[0] !== 'string') {
      issues.push(issue('on.push.branches', 'must name the default branch'))
    }
    for (const privileged of ['pull_request_target', 'workflow_run']) {
      if (privileged in triggers) {
        issues.push(
          issue(`on.${privileged}`, 'runs repository code with privileged credentials; remove it'),
        )
      }
    }
  }
  const permissions = document.permissions
  if (
    !isNode(permissions) ||
    permissions.contents !== 'read' ||
    Object.keys(permissions).length !== 1
  ) {
    issues.push(issue('permissions', 'must be exactly `contents: read`'))
  }
  const concurrency = isNode(document.concurrency) ? document.concurrency : undefined
  if (
    !concurrency ||
    typeof concurrency.group !== 'string' ||
    !concurrency.group.includes('github.workflow_ref') ||
    typeof concurrency['cancel-in-progress'] !== 'string' ||
    !concurrency['cancel-in-progress'].includes("github.event_name == 'pull_request'")
  ) {
    issues.push(
      issue(
        'concurrency',
        'must group by github.workflow_ref and cancel superseded pull request runs only',
      ),
    )
  }
  if (containsInherit(document)) {
    issues.push(
      issue('jobs', '`secrets: inherit` is not allowed; pass only the named secrets a job needs'),
    )
  }
  for (const reference of usesReferences(document)) {
    if (reference.uses.startsWith('./')) {
      continue
    }
    const [, ref = ''] = reference.uses.split('@')
    if (!FULL_SHA.test(ref)) {
      issues.push(issue(reference.path, `${reference.uses} is not pinned to a full commit SHA`))
    }
  }

  const jobs = isNode(document.jobs) ? document.jobs : {}
  const standards = jobs[STANDARDS_JOB]
  const expectedWorkflow = `${identity.repository}/${WORKFLOW_PATH}@${sha}`
  if (!isNode(standards)) {
    issues.push(issue(`jobs.${STANDARDS_JOB}`, 'is missing; it runs the shared standards'))
  } else if (standards.uses !== expectedWorkflow) {
    issues.push(
      issue(
        `jobs.${STANDARDS_JOB}.uses`,
        `must be ${expectedWorkflow}, the workflow of the installed @toolpath/dev-config ${identity.version}; run \`toolpath-dev sync\``,
      ),
    )
  }

  const plan = createCiPlan(resolved)
  const expected = requiredJobs(plan.external)
  for (const entry of plan.external) {
    const job = jobs[entry.job]
    if (!isNode(job)) {
      issues.push(
        issue(`jobs.${entry.job}`, `is missing; it runs the delegated suite ${entry.suite}`),
      )
      continue
    }
    const setup = stepUsing(job, `${identity.repository}/${ACTION_PATHS.setup}@`)
    const check = stepUsing(job, `${identity.repository}/${ACTION_PATHS.check}@`)
    for (const [name, step, path] of [
      ['setup', setup, ACTION_PATHS.setup],
      ['check', check, ACTION_PATHS.check],
    ] as const) {
      if (!step) {
        issues.push(issue(`jobs.${entry.job}`, `does not use the shared ${name} action`))
      } else if (step.uses !== `${identity.repository}/${path}@${sha}`) {
        issues.push(
          issue(
            `jobs.${entry.job}`,
            `uses a ${name} action from another release; run \`toolpath-dev sync\``,
          ),
        )
      }
    }
    const suiteInput = check && isNode(check.with) ? check.with.suite : undefined
    if (check && suiteInput !== entry.suite) {
      issues.push(issue(`jobs.${entry.job}`, `must run suite ${entry.suite} with the check action`))
    }
    const outputs = isNode(job.outputs) ? job.outputs : {}
    if (
      typeof outputs.receipt !== 'string' ||
      !outputs.receipt.includes('steps.check.outputs.receipt')
    ) {
      issues.push(issue(`jobs.${entry.job}.outputs.receipt`, 'must publish the check step receipt'))
    }
  }

  const aggregate = jobs[AGGREGATE_JOB]
  if (!isNode(aggregate)) {
    issues.push(issue(`jobs.${AGGREGATE_JOB}`, 'is missing; branch protection requires it'))
    return issues
  }
  if (aggregate.if !== 'always()') {
    issues.push(
      issue(
        `jobs.${AGGREGATE_JOB}.if`,
        'must be always() so a failed or skipped job cannot hide the result',
      ),
    )
  }
  const needs = Array.isArray(aggregate.needs)
    ? aggregate.needs
    : typeof aggregate.needs === 'string'
      ? [aggregate.needs]
      : []
  const wanted = expected.map((entry) => entry.job)
  const missingNeeds = wanted.filter((job) => !needs.includes(job))
  const extraNeeds = needs.filter(
    (job: unknown) => typeof job !== 'string' || !wanted.includes(job),
  )
  if (missingNeeds.length > 0) {
    issues.push(issue(`jobs.${AGGREGATE_JOB}.needs`, `must include ${missingNeeds.join(', ')}`))
  }
  if (extraNeeds.length > 0) {
    issues.push(
      issue(
        `jobs.${AGGREGATE_JOB}.needs`,
        `lists ${extraNeeds.join(', ')}, which the required inventory does not`,
      ),
    )
  }
  const result = stepUsing(aggregate, `${identity.repository}/${ACTION_PATHS.result}@`)
  if (!result) {
    issues.push(issue(`jobs.${AGGREGATE_JOB}`, 'must aggregate with the shared result action'))
    return issues
  }
  if (result.uses !== `${identity.repository}/${ACTION_PATHS.result}@${sha}`) {
    issues.push(
      issue(
        `jobs.${AGGREGATE_JOB}`,
        'uses a result action from another release; run `toolpath-dev sync`',
      ),
    )
  }
  const inputs = isNode(result.with) ? result.with : {}
  if (
    typeof inputs.needs !== 'string' ||
    inputs.needs.replace(/\s/g, '') !== '${{toJSON(needs)}}'
  ) {
    issues.push(
      issue(`jobs.${AGGREGATE_JOB}`, 'must pass ${{ toJSON(needs) }} to the result action'),
    )
  }
  const inventory = readRequiredJobs(inputs.required)
  if (!inventory.ok) {
    issues.push(issue(`jobs.${AGGREGATE_JOB}`, inventory.error))
  } else if (JSON.stringify(inventory.required) !== JSON.stringify(expected)) {
    issues.push(
      issue(
        `jobs.${AGGREGATE_JOB}`,
        'the required inventory does not match dev.config.mjs (ci.externalSuites); run `toolpath-dev sync`',
      ),
    )
  }
  return issues
}
