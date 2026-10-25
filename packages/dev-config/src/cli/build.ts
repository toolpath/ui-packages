import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { withDependencies, type ResolvedConfig, type ResolvedProject } from '../config/resolve.js'
import { CheckFailure, PrerequisiteError } from '../errors.js'
import { plural, seconds, type Output } from './output.js'
import { run } from './process.js'

/**
 * The projects whose declared build must run before `selected` can be checked:
 * every transitive dependency of a selected project that declares `build`.
 */
export const prerequisiteBuilds = (
  resolved: ResolvedConfig,
  selected: ReadonlyArray<ResolvedProject>,
): Array<ResolvedProject> => {
  const needed = new Set<string>()
  for (const project of selected) {
    for (const dependency of withDependencies(resolved, project.dependsOn)) {
      needed.add(dependency.name)
    }
  }
  return resolved.projects.filter((project) => needed.has(project.name) && project.build)
}

/** Runs builds once each, in graph order, and checks their declared outputs exist. */
export const runBuilds = async (
  projects: ReadonlyArray<ResolvedProject>,
  output: Output,
  built = new Set<string>(),
): Promise<void> => {
  const pending = projects.filter((project) => !built.has(project.name))
  if (pending.length === 0) {
    return
  }
  const started = performance.now()
  for (const project of pending) {
    const [command = '', ...args] = project.build?.argv ?? []
    let result
    try {
      result = await run(command, args, { cwd: project.directory })
    } catch (error) {
      throw new PrerequisiteError(
        `build ${project.name}: could not start ${command}: ${(error as Error).message}`,
      )
    }
    if (result.code !== 0) {
      output.failure(`${result.stdout}${result.stderr}`.trimEnd())
      throw new CheckFailure(
        `build ${project.name}: \`${project.build?.argv.join(' ') ?? ''}\` failed; dependent checks need its output`,
      )
    }
    const missing = (project.build?.outputs ?? []).filter(
      (path) => !existsSync(join(project.directory, path)),
    )
    if (missing.length > 0) {
      throw new CheckFailure(
        `build ${project.name}: finished without producing ${missing.join(', ')}`,
      )
    }
    built.add(project.name)
  }
  output.line(
    `build: ${plural(pending.length, 'prerequisite project')} built (${seconds(performance.now() - started)})`,
  )
}
