import { findConfigFile, loadConfig } from '../config/load.js'
import {
  resolveConfig,
  selectProjects,
  type ResolvedConfig,
  type ResolvedProject,
} from '../config/resolve.js'
import { classifyFiles, filesOf, toolingFiles, type Scope } from '../config/scope.js'
import { ConfigError, type Issue } from '../errors.js'
import type { Program } from './typescript.js'

export interface Workspace {
  resolved: ResolvedConfig
  /** The projects `--project` selected; every project when none was given. */
  selected: Array<ResolvedProject>
  /** Whether the selection is the whole repository (no `--project`), which includes tooling. */
  whole: boolean
  scope: () => Scope
}

export const loadWorkspace = async ({
  config,
  projects,
}: {
  config?: string
  projects: Array<string>
}): Promise<Workspace> => {
  const file = findConfigFile(process.cwd(), config)
  const resolved = resolveConfig(await loadConfig(file))
  const selected = selectProjects(resolved, projects)
  let scope: Scope | undefined
  return {
    resolved,
    selected,
    whole: projects.length === 0,
    scope: () => {
      scope ??= classifyFiles(resolved)
      return scope
    },
  }
}

/** Maintained files with no owning program, which no check would read. */
export const ownershipIssues = (scope: Scope): Array<Issue> =>
  scope.unowned.slice(0, 20).map((path) => ({
    path,
    message: 'is maintained JS/TS that no project root or tooling glob in dev.config.mjs owns',
  }))

export const assertOwnership = (scope: Scope): void => {
  const issues = ownershipIssues(scope)
  if (issues.length > 0) {
    const more = scope.unowned.length - issues.length
    throw new ConfigError(
      `Every maintained file must belong to one project or the tooling scope${more > 0 ? ` (${more} more not shown)` : ''}:`,
      issues,
    )
  }
}

/** The lint file list for the selection: each selected project's own files, plus tooling for a whole run. */
export const selectedFiles = (workspace: Workspace): Array<string> => {
  const scope = workspace.scope()
  return [
    ...workspace.selected.flatMap((project) => filesOf(scope, project)),
    ...(workspace.whole ? toolingFiles(scope) : []),
  ]
}

export const selectedPrograms = (workspace: Workspace): Array<Program> => {
  const scope = workspace.scope()
  const programs: Array<Program> = workspace.selected.map((project) => ({
    label: project.name,
    tsconfig: project.tsconfig,
    files: filesOf(scope, project),
  }))
  if (workspace.whole && workspace.resolved.tooling) {
    programs.push({
      label: 'tooling',
      tsconfig: workspace.resolved.tooling.tsconfig,
      files: toolingFiles(scope),
    })
  }
  return programs
}
