import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ResolvedConfig } from '../config/resolve.js'
import { createMatcher, isExcludedByDefault } from '../config/files.js'
import { createFormatIgnoreMatcher } from '../config/scope.js'
import prettierConfig from '../prettier/index.js'

/**
 * Files Prettier never rewrites, whatever a repository declares: lockfiles
 * belong to their package manager, which rewrites them on every install.
 */
export const BUILT_IN_FORMAT_EXCLUSIONS = [
  '**/package-lock.json',
  '**/npm-shrinkwrap.json',
  '**/pnpm-lock.yaml',
]

const isBuiltInFormatExclusion = createMatcher(BUILT_IN_FORMAT_EXCLUSIONS)

export interface FormatResult {
  /** Files whose content changed (write mode) or would change (check mode). */
  changed: Array<string>
  /** Files Prettier could not parse, with its message. */
  errors: Array<{ path: string; message: string }>
  /** Files skipped because no installed parser supports them, or they are excluded. */
  skipped: number
}

/** Whether the repository's policy formats this repository-relative path at all. */
export const createFormatScope = (resolved: ResolvedConfig): ((path: string) => boolean) => {
  const ignored = createFormatIgnoreMatcher(resolved)
  return (path) => !isExcludedByDefault(path) && !isBuiltInFormatExclusion(path) && !ignored(path)
}

/**
 * Formats (or, with `check`, verifies) files with the shared policy through
 * Prettier's API. Byte-retained `formatIgnore` paths and files without a parser
 * are left exactly as they are.
 */
export const formatFiles = async (
  resolved: ResolvedConfig,
  files: ReadonlyArray<string>,
  { check = false }: { check?: boolean } = {},
): Promise<FormatResult> => {
  const prettier = await import('prettier')
  const inScope = createFormatScope(resolved)
  const result: FormatResult = { changed: [], errors: [], skipped: 0 }
  for (const path of files) {
    const absolute = join(resolved.root, path)
    if (!inScope(path)) {
      result.skipped += 1
      continue
    }
    const info = await prettier.getFileInfo(absolute, { resolveConfig: false })
    if (info.inferredParser === null) {
      result.skipped += 1
      continue
    }
    const source = await readFile(absolute, 'utf8')
    let formatted: string
    try {
      formatted = await prettier.format(source, { ...prettierConfig, filepath: absolute })
    } catch (error) {
      result.errors.push({
        path,
        message: (error as Error).message.split('\n')[0] ?? String(error),
      })
      continue
    }
    if (formatted !== source) {
      result.changed.push(path)
      if (!check) {
        await writeFile(absolute, formatted)
      }
    }
  }
  return result
}
