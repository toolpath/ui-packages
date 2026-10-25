import { join } from 'node:path'
import { listFiles } from '../../config/files.js'
import type { ResolvedProject, ResolvedSuite } from '../../config/resolve.js'
import { createCiPlan, type CiPlan } from '../../ci/plan.js'
import { createReceipt, writeReceipt, type Receipt } from '../../ci/receipts.js'
import { STANDARDS_STAGES, isStageId, isSuiteId, suiteReceiptId } from '../../ci/result-policy.mjs'
import { CheckFailure, ConfigError, UsageError } from '../../errors.js'
import { formatFiles } from '../../hooks/format.js'
import { prerequisiteBuilds, runBuilds } from '../build.js'
import { lintFiles, reportLint } from '../lint.js'
import { plural, seconds, type Output } from '../output.js'
import { interruption } from '../process.js'
import {
  describeOutcome,
  reportOutcomes,
  runSuite,
  type SuiteOutcome,
  type TestCounts,
} from '../suites.js'
import { checkTypes, inspectPrograms } from '../typescript.js'
import {
  assertOwnership,
  loadWorkspace,
  selectedFiles,
  selectedPrograms,
  type Workspace,
} from '../workspace.js'

export interface CiFlags {
  config?: string
  projects: Array<string>
  stage?: string
  suite?: string
  plan: boolean
  receiptDir?: string
  reportDir?: string
}

const UNFORMATTED_LIMIT = 30

interface StageContext {
  workspace: Workspace
  plan: CiPlan
  output: Output
  built: Set<string>
  reportDir: string | undefined
}

type StageResult = Pick<Receipt, 'tests' | 'suites'>

/** A stage that ran and failed, with the counts it still recorded. */
class StageFailure extends CheckFailure {
  readonly result: StageResult

  constructor(message: string, result: StageResult) {
    super(message)
    this.name = 'StageFailure'
    this.result = result
  }
}

/** Reports outcomes; a failure carries each failed suite's own description into the receipt. */
const reportStage = (
  outcomes: ReadonlyArray<SuiteOutcome>,
  output: Output,
  label: string,
  result: StageResult,
): void => {
  try {
    reportOutcomes(outcomes, output, label)
  } catch (error) {
    if (error instanceof CheckFailure) {
      const failed = outcomes.filter((outcome) => outcome.status !== 'passed').map(describeOutcome)
      throw new StageFailure(failed.length > 0 ? failed.join('; ') : error.message, result)
    }
    throw error
  }
}

const total = (outcomes: ReadonlyArray<SuiteOutcome>): TestCounts =>
  outcomes.reduce(
    (sum, outcome) => ({
      passed: sum.passed + outcome.tests.passed,
      failed: sum.failed + outcome.tests.failed,
      skipped: sum.skipped + outcome.tests.skipped,
    }),
    { passed: 0, failed: 0, skipped: 0 },
  )

const projectsNamed = (
  context: StageContext,
  names: ReadonlyArray<string>,
): Array<ResolvedProject> =>
  context.workspace.resolved.projects.filter((project) => names.includes(project.name))

/**
 * The read-only formatting backstop. It never writes: a commit made without the
 * hook fails here, and the fix is to commit through the hook, which formats
 * staged files itself.
 */
const formatStage = async (context: StageContext): Promise<StageResult> => {
  const started = performance.now()
  const { resolved } = context.workspace
  const files = listFiles(resolved.root)
  const result = await formatFiles(resolved, files, { check: true })
  if (result.errors.length > 0 || result.changed.length > 0) {
    const shown = result.changed.slice(0, UNFORMATTED_LIMIT)
    context.output.failure(
      [
        ...(result.changed.length > 0
          ? [
              `${plural(result.changed.length, 'file')} ${result.changed.length === 1 ? 'is' : 'are'} not formatted with the shared policy:`,
              ...shown.map((path) => `  - ${path}`),
              ...(result.changed.length > shown.length
                ? [`  … and ${result.changed.length - shown.length} more`]
                : []),
              'These were committed without the pre-commit hook. Commit them again with the hook installed',
              '(`toolpath-dev hooks install`, which `prepare` runs); it formats staged files automatically.',
            ]
          : []),
        ...result.errors.map(
          (entry) => `${entry.path}: Prettier could not parse this file: ${entry.message}`,
        ),
      ].join('\n'),
    )
    throw new CheckFailure(
      `format: ${plural(result.changed.length, 'unformatted file')}${result.errors.length > 0 ? `, ${plural(result.errors.length, 'unparseable file')}` : ''}`,
    )
  }
  context.output.line(
    `format: ${plural(files.length - result.skipped, 'file')} match the shared policy (${seconds(performance.now() - started)})`,
  )
  return {}
}

const lintStage = async (context: StageContext): Promise<StageResult> => {
  assertOwnership(context.workspace.scope())
  const run = await lintFiles(context.workspace.resolved, selectedFiles(context.workspace))
  await reportLint(run, context.output, 'lint')
  return {}
}

const typesStage = async (context: StageContext): Promise<StageResult> => {
  const programs = selectedPrograms(context.workspace)
  const issues = await inspectPrograms(context.workspace.resolved, programs)
  if (issues.length > 0) {
    throw new ConfigError('TypeScript programs do not meet the standard:', issues)
  }
  await runBuilds(
    projectsNamed(context, context.plan.standards.builds),
    context.output,
    context.built,
  )
  await checkTypes(context.workspace.resolved, programs, context.output)
  return {}
}

const suitesOf = (
  context: StageContext,
  ids: ReadonlyArray<string>,
): Array<{ project: ResolvedProject; suite: ResolvedSuite }> =>
  ids.map((id) => {
    for (const project of context.workspace.resolved.projects) {
      const suite = project.suites.find((candidate) => candidate.id === id)
      if (suite) {
        return { project, suite }
      }
    }
    throw new ConfigError(`${id} is not a declared suite`)
  })

const runAll = async (
  context: StageContext,
  selected: ReadonlyArray<{ project: ResolvedProject; suite: ResolvedSuite }>,
): Promise<Array<SuiteOutcome>> => {
  const outcomes: Array<SuiteOutcome> = []
  for (const { project, suite } of selected) {
    outcomes.push(
      await runSuite(
        project,
        suite,
        context.reportDir === undefined ? {} : { reportDir: context.reportDir },
      ),
    )
    if (interruption()) {
      break
    }
  }
  return outcomes
}

const unitStage = async (context: StageContext): Promise<StageResult> => {
  await runBuilds(
    projectsNamed(context, context.plan.standards.builds),
    context.output,
    context.built,
  )
  const selected = suitesOf(context, context.plan.standards.unitSuites)
  if (selected.length === 0) {
    context.output.line('unit: no unit suites; every project declares noUnitTests with its reason')
    return { tests: { passed: 0, failed: 0, skipped: 0 }, suites: [] }
  }
  const outcomes = await runAll(context, selected)
  const result: StageResult = {
    tests: total(outcomes),
    suites: outcomes.map((outcome) => ({
      id: outcome.id,
      status: outcome.status,
      tests: outcome.tests,
    })),
  }
  reportStage(outcomes, context.output, 'unit', result)
  return result
}

const suiteStage = async (context: StageContext, id: string): Promise<StageResult> => {
  const [entry] = suitesOf(context, [id])
  if (!entry) {
    throw new ConfigError(`${id} is not a declared suite`)
  }
  await runBuilds(
    prerequisiteBuilds(context.workspace.resolved, [entry.project]),
    context.output,
    context.built,
  )
  const outcomes = await runAll(context, [entry])
  const result: StageResult = { tests: total(outcomes) }
  reportStage(outcomes, context.output, 'suite', result)
  return result
}

/** What an invocation runs, as receipt ids, in order. */
const selectCiWork = (plan: CiPlan, flags: Pick<CiFlags, 'stage' | 'suite'>): Array<string> => {
  if (flags.stage !== undefined && flags.suite !== undefined) {
    throw new UsageError('ci takes --stage or --suite, not both.')
  }
  if (flags.suite !== undefined) {
    if (!isSuiteId(flags.suite)) {
      throw new UsageError(
        `--suite ${flags.suite}: use <project>:<suite> as declared in dev.config.mjs.`,
      )
    }
    return [suiteReceiptId(flags.suite)]
  }
  if (flags.stage === 'standards') {
    return [...STANDARDS_STAGES]
  }
  if (flags.stage !== undefined) {
    if (!isStageId(flags.stage)) {
      throw new UsageError(`--stage ${flags.stage}: use standards, format, lint, types or unit.`)
    }
    return [flags.stage]
  }
  return [...plan.receipts]
}

/**
 * The CI quality contract. Without `--stage`/`--suite` it runs everything the
 * central workflow would: the read-only format backstop, lint, types and unit
 * suites, then each required central suite. Delegated and manual suites are
 * listed, not run. With `--receipt-dir` each stage writes the receipt the CI
 * result policy verifies.
 */
export const ci = async (flags: CiFlags, output: Output): Promise<void> => {
  if (flags.projects.length > 0) {
    throw new UsageError('ci checks the whole repository; --project is for focused local commands.')
  }
  const workspace = await loadWorkspace({
    ...(flags.config === undefined ? {} : { config: flags.config }),
    projects: [],
  })
  const plan = createCiPlan(workspace.resolved)
  if (flags.plan) {
    if (flags.stage !== undefined || flags.suite !== undefined) {
      throw new UsageError(
        '--plan prints the whole execution plan; it takes no --stage or --suite.',
      )
    }
    if (output.json) {
      output.record('plan', plan)
    } else {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
    }
    return
  }
  const work = selectCiWork(plan, flags)
  const receiptDir = flags.receiptDir ?? process.env.TOOLPATH_DEV_RECEIPT_DIR
  const reportDir =
    flags.reportDir ?? (receiptDir === undefined ? undefined : join(receiptDir, '..', 'reports'))
  const context: StageContext = { workspace, plan, output, built: new Set(), reportDir }
  const failed: Array<string> = []
  const errors: Array<UsageError> = []
  const receipts: Array<Receipt> = []

  for (const id of work) {
    if (interruption()) {
      failed.push(id)
      continue
    }
    const started = performance.now()
    let status: Receipt['status'] = 'passed'
    let message: string | undefined
    let result: StageResult = {}
    try {
      switch (id) {
        case 'format':
          result = await formatStage(context)
          break
        case 'lint':
          result = await lintStage(context)
          break
        case 'types':
          result = await typesStage(context)
          break
        case 'unit':
          result = await unitStage(context)
          break
        default:
          result = await suiteStage(context, id.slice('suite:'.length))
      }
    } catch (error) {
      if (error instanceof CheckFailure) {
        status = 'failed'
        message = error.message
        result = error instanceof StageFailure ? error.result : {}
        output.failure(error.message)
        failed.push(id)
      } else if (error instanceof UsageError) {
        status = 'error'
        message = error.message
        output.failure(error.message)
        errors.push(error)
      } else {
        throw error
      }
    }
    const receipt = createReceipt({
      id,
      status,
      durationMs: performance.now() - started,
      ...result,
      ...(message === undefined ? {} : { message }),
    })
    receipts.push(receipt)
    if (receiptDir !== undefined) {
      writeReceipt(receiptDir, receipt)
    }
  }

  output.record('receipts', receipts)
  if (
    work.length === plan.receipts.length &&
    flags.stage === undefined &&
    flags.suite === undefined
  ) {
    for (const entry of plan.external) {
      output.line(`ci: ${entry.suite} runs in the caller job ${entry.job}`)
    }
    for (const entry of plan.manual) {
      output.line(`ci: ${entry.suite} is manual (${entry.reason})`)
    }
  }
  const signal = interruption()
  if (signal) {
    throw new CheckFailure(`ci: interrupted by ${signal}`)
  }
  if (errors.length > 0) {
    throw new UsageError(
      `ci: ${errors.length === 1 ? 'a stage' : `${errors.length} stages`} could not run: ${receipts
        .filter((receipt) => receipt.status === 'error')
        .map((receipt) => receipt.id)
        .join(', ')}`,
    )
  }
  if (failed.length > 0) {
    throw new CheckFailure(`ci failed: ${failed.join(', ')}`)
  }
  output.line(`ci: passed (${work.join(', ')})`)
}
