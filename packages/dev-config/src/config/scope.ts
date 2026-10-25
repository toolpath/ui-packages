import { createMatcher, isScriptFile, isWithin, listFiles } from './files.js'
import type { ResolvedConfig, ResolvedProject } from './resolve.js'

export type Owner = { kind: 'project'; project: ResolvedProject } | { kind: 'tooling' }

export interface Scope {
  /** Maintained TS/JS files and the one program each belongs to. */
  owned: Map<string, Owner>
  /** Files excluded by a declared `generated` entry. */
  generated: Array<string>
  /** Maintained TS/JS files no project or tooling scope claims: a configuration error. */
  unowned: Array<string>
}

/**
 * The owner of one repository-relative path. Tooling globs win, so a project's
 * own `vite.config.ts` can be checked by the tooling program; otherwise the most
 * specific project root claims the file and its parent does not reprocess it.
 */
export const createOwnerLookup = (
  resolved: ResolvedConfig,
): ((path: string) => Owner | undefined) => {
  const isTooling = createMatcher(resolved.tooling?.files ?? [])
  const bySpecificity = [...resolved.projects].sort((a, b) =>
    a.path === '.' ? 1 : b.path === '.' ? -1 : b.path.length - a.path.length,
  )
  return (path) => {
    if (resolved.tooling && isTooling(path)) {
      return { kind: 'tooling' }
    }
    const project = bySpecificity.find((candidate) => isWithin(candidate.path, path))
    return project ? { kind: 'project', project } : undefined
  }
}

export const createGeneratedMatcher = (resolved: ResolvedConfig): ((path: string) => boolean) =>
  createMatcher(resolved.generated.flatMap((entry) => entry.files))

export const createFormatIgnoreMatcher = (resolved: ResolvedConfig): ((path: string) => boolean) =>
  createMatcher(resolved.formatIgnore.flatMap((entry) => entry.files))

export const classifyFiles = (
  resolved: ResolvedConfig,
  files: ReadonlyArray<string> = listFiles(resolved.root),
): Scope => {
  const ownerOf = createOwnerLookup(resolved)
  const isGenerated = createGeneratedMatcher(resolved)
  const scope: Scope = { owned: new Map(), generated: [], unowned: [] }
  for (const path of files) {
    if (!isScriptFile(path)) {
      continue
    }
    if (isGenerated(path)) {
      scope.generated.push(path)
      continue
    }
    const owner = ownerOf(path)
    if (owner) {
      scope.owned.set(path, owner)
    } else {
      scope.unowned.push(path)
    }
  }
  return scope
}

/** The maintained files one project owns (not its nested projects' or tooling's). */
export const filesOf = (scope: Scope, project: ResolvedProject): Array<string> =>
  [...scope.owned]
    .filter(([, owner]) => owner.kind === 'project' && owner.project === project)
    .map(([path]) => path)

export const toolingFiles = (scope: Scope): Array<string> =>
  [...scope.owned].filter(([, owner]) => owner.kind === 'tooling').map(([path]) => path)
