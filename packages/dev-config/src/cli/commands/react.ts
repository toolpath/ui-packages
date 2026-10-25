import { CheckFailure, ConfigError, UsageError } from '../../errors.js'
import { reactAdapterIssues } from '../../react/requirements.js'
import { verifyReactProject } from '../../react/verify.js'
import { plural, seconds, type Output } from '../output.js'
import { loadWorkspace } from '../workspace.js'

/**
 * `react verify`: for each selected React project, the doctor-level adapter
 * checks and then a real transform of a probe component through the project's
 * own build configuration.
 */
export const reactVerify = async (
  flags: { config?: string; projects: Array<string> },
  output: Output,
): Promise<void> => {
  const workspace = await loadWorkspace(flags)
  const projects = workspace.selected.filter((project) => project.react)
  if (projects.length === 0) {
    throw new UsageError('react verify: the selected projects declare no react profile.')
  }
  const issues = reactAdapterIssues({ ...workspace.resolved, projects })
  if (issues.length > 0) {
    throw new ConfigError('React Compiler is not wired as declared:', issues)
  }
  const failures: Array<string> = []
  const results: Array<{
    project: string
    adapter: string
    cacheAllocations: number
    durationMs: number
  }> = []
  for (const project of projects) {
    const started = performance.now()
    try {
      const evidence = await verifyReactProject(project)
      const durationMs = performance.now() - started
      results.push({
        project: project.name,
        adapter: project.react?.adapter ?? '',
        cacheAllocations: evidence.cacheAllocations,
        durationMs: Math.round(durationMs),
      })
      output.line(
        `react verify ${project.name} (${project.react?.adapter ?? ''}): compiled (${seconds(durationMs)})`,
      )
    } catch (error) {
      if (!(error instanceof CheckFailure)) {
        throw error
      }
      output.failure(error.message)
      failures.push(project.name)
    }
  }
  output.record('react', results)
  if (failures.length > 0) {
    throw new CheckFailure(
      `react verify: ${plural(failures.length, 'project')} did not compile: ${failures.join(', ')}`,
    )
  }
}
