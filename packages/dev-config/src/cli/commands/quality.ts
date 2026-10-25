import { CheckFailure, ConfigError, UsageError } from '../../errors.js'
import { prerequisiteBuilds, runBuilds } from '../build.js'
import { lintFiles, reportLint } from '../lint.js'
import { verifyReactProjects } from '../react-gate.js'
import type { Output } from '../output.js'
import { interruption } from '../process.js'
import { reportOutcomes, runSuite, type SuiteOutcome } from '../suites.js'
import { checkTypes, inspectPrograms } from '../typescript.js'
import {
  assertOwnership,
  loadWorkspace,
  selectedFiles,
  selectedPrograms,
  type Workspace,
} from '../workspace.js'

export interface QualityFlags {
  config?: string
  projects: Array<string>
  suites: Array<string>
  watch: boolean
  filters: Array<string>
  reportDir?: string
}

const assertPrograms = async (workspace: Workspace): Promise<void> => {
  const issues = await inspectPrograms(workspace.resolved, selectedPrograms(workspace))
  if (issues.length > 0) {
    throw new ConfigError('TypeScript programs do not meet the standard:', issues)
  }
}

export const lint = async (
  flags: QualityFlags,
  output: Output,
  { fix = false } = {},
): Promise<void> => {
  const workspace = await loadWorkspace(flags)
  assertOwnership(workspace.scope())
  const run = await lintFiles(workspace.resolved, selectedFiles(workspace), { fix })
  await reportLint(run, output, fix ? 'lint:fix' : 'lint')
}

export const typecheck = async (
  flags: QualityFlags,
  output: Output,
  workspace?: Workspace,
  built?: Set<string>,
): Promise<void> => {
  const current = workspace ?? (await loadWorkspace(flags))
  assertOwnership(current.scope())
  await assertPrograms(current)
  await runBuilds(prerequisiteBuilds(current.resolved, current.selected), output, built)
  await checkTypes(current.resolved, selectedPrograms(current), output)
}

/** The suites a `test` invocation runs: named ones (`--suite`), else every ordinary suite of the selection. */
const selectedSuites = (
  workspace: Workspace,
  names: ReadonlyArray<string>,
): Array<{ projectName: string; suiteName: string }> => {
  if (names.length > 0) {
    return names.map((name) => {
      const [projectName, suiteName] = name.includes(':')
        ? name.split(':', 2)
        : [workspace.selected[0]?.name, name]
      const project = workspace.resolved.projects.find(
        (candidate) => candidate.name === projectName,
      )
      const suite = project?.suites.find((candidate) => candidate.name === suiteName)
      if (!project || !suite) {
        throw new ConfigError(
          `--suite ${name}: no such suite. Use <project>:<suite>, e.g. ${workspace.resolved.projects[0]?.suites[0]?.id ?? 'app:unit'}`,
        )
      }
      return { projectName: project.name, suiteName: suite.name }
    })
  }
  return workspace.selected.flatMap((project) =>
    project.suites
      .filter((suite) => suite.ordinary)
      .map((suite) => ({ projectName: project.name, suiteName: suite.name })),
  )
}

export const test = async (
  flags: QualityFlags,
  output: Output,
  workspace?: Workspace,
  built?: Set<string>,
): Promise<Array<SuiteOutcome>> => {
  const current = workspace ?? (await loadWorkspace(flags))
  const chosen = selectedSuites(current, flags.suites)
  if (flags.watch && chosen.length !== 1) {
    throw new UsageError(
      `--watch runs one suite; this selection has ${chosen.length}. Add --suite <project>:<suite>.`,
    )
  }
  if (flags.filters.length > 0 && chosen.length !== 1) {
    throw new UsageError(
      'A file filter after -- applies to one suite. Add --project or --suite to choose it.',
    )
  }
  const projects = chosen.map(({ projectName }) =>
    current.resolved.projects.find((project) => project.name === projectName),
  )
  await runBuilds(
    prerequisiteBuilds(
      current.resolved,
      projects.filter((project) => project !== undefined),
    ),
    output,
    built,
  )

  const outcomes: Array<SuiteOutcome> = []
  // Suites run one at a time: each runner already uses a bounded worker pool.
  for (const { projectName, suiteName } of chosen) {
    const project = current.resolved.projects.find((candidate) => candidate.name === projectName)
    const suite = project?.suites.find((candidate) => candidate.name === suiteName)
    if (!project || !suite) {
      continue
    }
    const outcome = await runSuite(project, suite, {
      filters: flags.filters,
      watch: flags.watch,
      ...(flags.reportDir === undefined ? {} : { reportDir: flags.reportDir }),
    })
    outcomes.push(outcome)
    if (interruption()) {
      break
    }
  }
  if (flags.watch) {
    if (outcomes.some((outcome) => outcome.status !== 'passed')) {
      throw new CheckFailure('test --watch ended with a failure')
    }
    return outcomes
  }
  if (chosen.length === 0) {
    output.line('test: the selected projects declare noUnitTests; nothing to run')
    return outcomes
  }
  reportOutcomes(outcomes, output)
  return outcomes
}

/**
 * The local gate: essentials, prerequisite builds, lint, type checks, and every
 * ordinary suite. It never formats or checks formatting; the pre-commit hook and
 * CI own that.
 */
export const check = async (flags: QualityFlags, output: Output): Promise<void> => {
  if (flags.watch || flags.filters.length > 0 || flags.suites.length > 0) {
    throw new UsageError(
      'check runs the complete gate; use `toolpath-dev test` for --watch, --suite or file filters.',
    )
  }
  const workspace = await loadWorkspace(flags)
  assertOwnership(workspace.scope())
  await assertPrograms(workspace)
  const built = new Set<string>()
  await runBuilds(prerequisiteBuilds(workspace.resolved, workspace.selected), output, built)
  const failures: Array<string> = []
  const stage = async (name: string, body: () => Promise<unknown>): Promise<void> => {
    if (interruption()) {
      return
    }
    try {
      await body()
    } catch (error) {
      if (error instanceof CheckFailure) {
        output.failure(error.message)
        failures.push(name)
        return
      }
      throw error
    }
  }
  await stage('lint', async () => {
    const run = await lintFiles(workspace.resolved, selectedFiles(workspace))
    await reportLint(run, output, 'lint')
  })
  await stage('check-types', () =>
    checkTypes(workspace.resolved, selectedPrograms(workspace), output),
  )
  await stage('react', () => verifyReactProjects(workspace.resolved, workspace.selected, output))
  await stage('test', () => test({ ...flags, suites: [], filters: [] }, output, workspace, built))
  const signal = interruption()
  if (signal) {
    throw new CheckFailure(`check: interrupted by ${signal}`)
  }
  if (failures.length > 0) {
    throw new CheckFailure(`check failed: ${failures.join(', ')}`)
  }
  output.line('check: passed')
}
