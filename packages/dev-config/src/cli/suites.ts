import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findInstalledPackage, packageBin } from '../config/packages.js'
import type { ResolvedProject, ResolvedSuite } from '../config/resolve.js'
import { CheckFailure, PrerequisiteError } from '../errors.js'
import { plural, seconds, type Output } from './output.js'
import { run, type RunResult } from './process.js'

export interface TestCounts {
  passed: number
  failed: number
  skipped: number
}

type SuiteStatus = 'passed' | 'failed' | 'empty' | 'no-report' | 'interrupted'

export interface SuiteOutcome {
  id: string
  runner: ResolvedSuite['runner']
  status: SuiteStatus
  tests: TestCounts
  durationMs: number
  /** Captured runner output, for failure reporting and CI logs. */
  log: string
  report?: string
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/**
 * Vitest's and Jest's JSON reporters share this shape. A test file that fails to
 * load counts as a failed suite with no failed tests, so it is counted here too.
 */
const jestLikeCounts = (report: Record<string, unknown>): TestCounts => {
  const failedTests = num(report.numFailedTests)
  const failedFiles = failedTests === 0 ? num(report.numFailedTestSuites) : 0
  const failed =
    failedTests +
    failedFiles +
    (report.success === false && failedTests + failedFiles === 0 ? 1 : 0)
  return {
    passed: num(report.numPassedTests),
    failed,
    skipped: num(report.numPendingTests) + num(report.numTodoTests),
  }
}

const playwrightCounts = (report: Record<string, unknown>): TestCounts => {
  const stats = (report.stats ?? {}) as Record<string, unknown>
  const errors = Array.isArray(report.errors) ? report.errors.length : 0
  return {
    passed: num(stats.expected) + num(stats.flaky),
    failed: num(stats.unexpected) + errors,
    skipped: num(stats.skipped),
  }
}

/**
 * Totals from a JUnit XML report: the `tests`, `failures`, `errors` and
 * `skipped` attributes of each `<testsuite>`, which every JUnit producer writes.
 */
export const junitCounts = (xml: string): TestCounts => {
  const withoutComments = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  const totals = { tests: 0, failures: 0, errors: 0, skipped: 0 }
  for (const match of withoutComments.matchAll(/<testsuite(?=[\s>])([^>]*)>/g)) {
    const attributes = match[1] ?? ''
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      const value = new RegExp(`\\s${key}="(\\d+)"`).exec(attributes)?.[1]
      totals[key] += value ? Number.parseInt(value, 10) : 0
    }
  }
  const failed = totals.failures + totals.errors
  return {
    passed: Math.max(0, totals.tests - failed - totals.skipped),
    failed,
    skipped: totals.skipped,
  }
}

export const countsFromReport = (
  format: 'vitest-json' | 'jest-json' | 'playwright-json' | 'junit',
  text: string,
): TestCounts => {
  if (format === 'junit') {
    return junitCounts(text)
  }
  const parsed = JSON.parse(text) as Record<string, unknown>
  return format === 'playwright-json' ? playwrightCounts(parsed) : jestLikeCounts(parsed)
}

const reportFormat = (
  suite: ResolvedSuite,
): 'vitest-json' | 'jest-json' | 'playwright-json' | 'junit' => {
  switch (suite.runner) {
    case 'vitest':
      return 'vitest-json'
    case 'jest-expo':
      return 'jest-json'
    case 'playwright':
      return 'playwright-json'
    case 'command':
      return suite.report?.format ?? 'junit'
  }
}

const requireTool = (
  project: ResolvedProject,
  name: string,
  bin: string,
  suite: ResolvedSuite,
): string => {
  const installed = findInstalledPackage(project.directory, name)
  if (!installed) {
    throw new PrerequisiteError(
      `${suite.id} uses ${suite.runner}, but ${name} is not installed in ${project.path}. Run \`toolpath-dev doctor\` for the exact version.`,
    )
  }
  return packageBin(installed, bin)
}

/** Fails before the suite starts when a declared environment variable or executable is missing. */
export const checkPrerequisites = (
  suite: ResolvedSuite,
  environment: NodeJS.ProcessEnv = process.env,
): void => {
  const missingEnv = suite.prerequisites.env.filter((name) => !environment[name])
  const pathDirectories = (environment.PATH ?? '').split(process.platform === 'win32' ? ';' : ':')
  const missingCommands = suite.prerequisites.commands.filter(
    (command) =>
      !pathDirectories.some(
        (directory) => directory !== '' && existsSync(join(directory, command)),
      ),
  )
  if (missingEnv.length > 0 || missingCommands.length > 0) {
    throw new PrerequisiteError(
      [
        `${suite.id} cannot run: prerequisites are missing.`,
        ...missingEnv.map((name) => `  - environment variable ${name} is not set`),
        ...missingCommands.map((command) => `  - ${command} is not on PATH`),
      ].join('\n'),
    )
  }
}

export interface SuiteRunOptions {
  /** Test file filters passed after `--`. */
  filters?: Array<string>
  watch?: boolean
  /** Where reports are written; a temporary directory when omitted. */
  reportDir?: string
}

const MISSING_BROWSER =
  /Executable doesn't exist|browserType\.launch:.*(not found|doesn't exist)|Please run the following command to download new browsers/

/** Runs one declared suite and proves from its machine-readable report that tests executed. */
export const runSuite = async (
  project: ResolvedProject,
  suite: ResolvedSuite,
  options: SuiteRunOptions = {},
): Promise<SuiteOutcome> => {
  const filters = options.filters ?? []
  const temporary = options.reportDir ? undefined : mkdtempSync(join(tmpdir(), 'toolpath-dev-'))
  const reportDirectory = options.reportDir ?? temporary ?? tmpdir()
  const extension = reportFormat(suite) === 'junit' ? 'xml' : 'json'
  const report =
    suite.runner === 'command' && suite.report
      ? join(project.directory, suite.report.path)
      : join(reportDirectory, `${suite.id.replace(/[^a-z0-9._-]/gi, '_')}.${extension}`)
  // Watch mode is interactive: the runner's own reporter, and no one-shot report.
  const env: NodeJS.ProcessEnv = options.watch
    ? { ...process.env, TOOLPATH_DEV_WATCH: '1', TOOLPATH_DEV_SUITE: suite.id }
    : { ...process.env, TOOLPATH_DEV_REPORT: report, TOOLPATH_DEV_SUITE: suite.id }
  if (suite.runner !== 'command') {
    rmSync(report, { force: true })
  }

  let command: string
  let args: Array<string>
  switch (suite.runner) {
    case 'vitest': {
      const bin = requireTool(project, 'vitest', 'vitest', suite)
      command = process.execPath
      args = [bin, options.watch ? 'watch' : 'run', '--config', suite.config ?? '', ...filters]
      break
    }
    case 'jest-expo': {
      const bin = requireTool(project, 'jest', 'jest', suite)
      command = process.execPath
      args = options.watch
        ? [bin, '--config', suite.config ?? '', '--watch', ...filters]
        : [
            bin,
            '--config',
            suite.config ?? '',
            '--ci',
            '--watchAll=false',
            '--json',
            `--outputFile=${report}`,
            ...filters,
          ]
      break
    }
    case 'playwright': {
      const bin = requireTool(project, '@playwright/test', 'playwright', suite)
      checkPrerequisites(suite)
      command = process.execPath
      args = [
        bin,
        'test',
        '--config',
        suite.config ?? '',
        ...(options.watch ? ['--ui'] : []),
        ...filters,
      ]
      break
    }
    case 'command': {
      checkPrerequisites(suite)
      const [executable = '', ...rest] = suite.argv ?? []
      command = executable
      args = [...rest, ...filters]
      rmSync(report, { force: true })
      break
    }
  }

  let result: RunResult
  try {
    result = await run(command, args, {
      cwd: project.directory,
      env,
      inherit: options.watch === true,
      ...(suite.timeoutMinutes === undefined ? {} : { timeoutMs: suite.timeoutMinutes * 60_000 }),
    })
  } catch (error) {
    throw new PrerequisiteError(
      `${suite.id}: could not start ${command}: ${(error as Error).message}`,
    )
  }
  const log = `${result.stdout}${result.stderr}`
  if (suite.runner === 'playwright' && MISSING_BROWSER.test(log)) {
    throw new PrerequisiteError(
      `${suite.id}: the ${suite.browsers.join(', ')} browser is not installed. Install it explicitly before the suite runs:\n` +
        `  npx playwright install --with-deps ${suite.browsers.join(' ')}`,
    )
  }

  const base = { id: suite.id, runner: suite.runner, durationMs: result.durationMs, log, report }
  if (temporary && options.watch) {
    rmSync(temporary, { recursive: true, force: true })
  }
  if (options.watch) {
    return {
      ...base,
      status: result.code === 0 ? 'passed' : 'failed',
      tests: { passed: 0, failed: 0, skipped: 0 },
    }
  }
  if (result.signal !== null) {
    return { ...base, status: 'interrupted', tests: { passed: 0, failed: 0, skipped: 0 } }
  }
  if (!existsSync(report)) {
    return {
      ...base,
      status: result.code === 0 ? 'no-report' : 'failed',
      tests: { passed: 0, failed: 0, skipped: 0 },
    }
  }
  let tests: TestCounts
  try {
    tests = countsFromReport(reportFormat(suite), readFileSync(report, 'utf8'))
  } catch (error) {
    return {
      ...base,
      status: 'no-report',
      log: `${log}\nUnreadable report ${report}: ${(error as Error).message}`,
      tests: { passed: 0, failed: 0, skipped: 0 },
    }
  }
  let status: SuiteStatus = 'passed'
  if (result.code !== 0 || tests.failed > 0) {
    status = 'failed'
  } else if (tests.passed === 0) {
    status = 'empty'
  }
  return { ...base, status, tests }
}

export const describeOutcome = (outcome: SuiteOutcome): string => {
  const counts = `${plural(outcome.tests.passed, 'test')} passed${outcome.tests.skipped > 0 ? `, ${outcome.tests.skipped} skipped` : ''}`
  switch (outcome.status) {
    case 'passed':
      return `${outcome.id}: ${counts} (${seconds(outcome.durationMs)})`
    case 'failed':
      return `${outcome.id}: ${plural(outcome.tests.failed, 'failure')} (${seconds(outcome.durationMs)})`
    case 'empty':
      return `${outcome.id}: no tests ran. A declared suite must discover and execute tests`
    case 'no-report':
      return `${outcome.id}: produced no ${outcome.runner === 'command' ? 'declared' : 'machine-readable'} report, so there is no evidence tests ran${outcome.runner === 'command' ? '' : '. Its config must come from the @toolpath/dev-config factory'}`
    case 'interrupted':
      return `${outcome.id}: interrupted`
  }
}

/** Prints outcomes concisely; failure output is the runner's own, in full. */
export const reportOutcomes = (
  outcomes: ReadonlyArray<SuiteOutcome>,
  output: Output,
  label = 'test',
): void => {
  output.record(
    'suites',
    outcomes.map(({ id, runner, status, tests, durationMs }) => ({
      id,
      runner,
      status,
      tests,
      durationMs: Math.round(durationMs),
    })),
  )
  const failed = outcomes.filter((outcome) => outcome.status !== 'passed')
  for (const outcome of failed) {
    if (outcome.log.trim() !== '') {
      output.failure(outcome.log.trimEnd())
    }
    output.failure(`✗ ${describeOutcome(outcome)}`)
  }
  for (const outcome of outcomes.filter((candidate) => candidate.status === 'passed')) {
    output.line(`${label} ${describeOutcome(outcome)}`)
  }
  if (failed.length > 0) {
    throw new CheckFailure(
      `${label}: ${plural(failed.length, 'suite')} did not pass: ${failed.map((outcome) => outcome.id).join(', ')}`,
    )
  }
}
