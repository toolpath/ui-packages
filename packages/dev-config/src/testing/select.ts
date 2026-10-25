import {
  resolveConfig,
  type ResolvedConfig,
  type ResolvedProject,
  type ResolvedSuite,
  type SuiteRunner,
} from '../config/resolve.js'
import type { DevConfig } from '../config/types.js'
import { ConfigError } from '../errors.js'

export interface SuiteSelection {
  /** The project name in `dev.config.mjs`. */
  project: string
  /** The suite name under that project's `suites`. */
  suite: string
}

/** The declared suite a runner config belongs to, checked against the runner it is used with. */
export const selectSuite = (
  config: DevConfig,
  { project: projectName, suite: suiteName }: SuiteSelection,
  runner: SuiteRunner,
): { resolved: ResolvedConfig; project: ResolvedProject; suite: ResolvedSuite } => {
  const resolved = resolveConfig(config)
  const project = resolved.projects.find((candidate) => candidate.name === projectName)
  if (!project) {
    throw new ConfigError(
      `No project "${projectName}" in dev.config.mjs (configured: ${resolved.projects.map((p) => p.name).join(', ')}).`,
    )
  }
  const suite = project.suites.find((candidate) => candidate.name === suiteName)
  if (!suite) {
    throw new ConfigError(`Project "${projectName}" declares no suite "${suiteName}".`)
  }
  if (suite.runner !== runner) {
    throw new ConfigError(`${suite.id} is a ${suite.runner} suite; this is the ${runner} factory.`)
  }
  return { resolved, project, suite }
}

/** Nested project roots, relative to `project`, which their own suites test. */
export const nestedRoots = (resolved: ResolvedConfig, project: ResolvedProject): Array<string> =>
  resolved.projects
    .filter(
      (other) =>
        other !== project &&
        (project.path === '.' ? other.path !== '.' : other.path.startsWith(`${project.path}/`)),
    )
    .map((other) => (project.path === '.' ? other.path : other.path.slice(project.path.length + 1)))
