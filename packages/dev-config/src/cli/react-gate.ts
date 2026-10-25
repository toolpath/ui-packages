import type { ResolvedConfig, ResolvedProject } from '../config/resolve.js'
import { CheckFailure, ConfigError } from '../errors.js'
import { reactAdapterIssues } from '../react/requirements.js'
import { verifyReactProject } from '../react/verify.js'
import { plural, seconds, type Output } from './output.js'

/**
 * Proves React Compiler is wired as each React project declares: the adapter
 * checks, then a probe component transformed through the project's own build
 * configuration. An installed but unused compiler fails here.
 */
export const verifyReactProjects = async (
  resolved: ResolvedConfig,
  selected: ReadonlyArray<ResolvedProject>,
  output: Output,
): Promise<void> => {
  const projects = selected.filter((project) => project.react)
  if (projects.length === 0) {
    return
  }
  const issues = reactAdapterIssues({ ...resolved, projects })
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
        `react ${project.name} (${project.react?.adapter ?? ''}): compiled (${seconds(durationMs)})`,
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
      `react: ${plural(failures.length, 'project')} did not compile: ${failures.join(', ')}`,
    )
  }
}
