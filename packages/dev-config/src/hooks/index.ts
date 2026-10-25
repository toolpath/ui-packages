import { isAbsolute, relative } from 'node:path'
import { isExcludedByDefault, toPosix } from '../config/files.js'
import { resolveConfig, type ResolvedConfig } from '../config/resolve.js'
import { classifyFiles } from '../config/scope.js'
import type { DevConfig } from '../config/types.js'
import { CheckFailure } from '../errors.js'
import { lintFiles } from '../cli/lint.js'
import { formatFiles } from './format.js'

export {
  BUILT_IN_FORMAT_EXCLUSIONS,
  createFormatScope,
  formatFiles,
  type FormatResult,
} from './format.js'

export interface StagedFilesResult {
  linted: number
  fixed: number
  formatted: number
}

const toRelative = (resolved: ResolvedConfig, files: ReadonlyArray<string>): Array<string> =>
  files
    .map((file) => toPosix(isAbsolute(file) ? relative(resolved.root, file) : file))
    .filter((file) => file !== '' && !file.startsWith('../') && !isExcludedByDefault(file))

/**
 * The pre-commit worker for one batch of staged files: safe ESLint fixes for the
 * maintained TS/JS files (each with its owning program), then Prettier last on
 * every supported text file. Index management stays with lint-staged, which
 * restages what this changed and restores unstaged edits afterwards.
 */
export const processStagedFiles = async (
  config: DevConfig,
  files: ReadonlyArray<string>,
  log: (text: string) => void = () => undefined,
): Promise<StagedFilesResult> => {
  const resolved = resolveConfig(config)
  const relativeFiles = toRelative(resolved, files)
  const scope = classifyFiles(resolved, relativeFiles)
  const lintable = relativeFiles.filter((file) => scope.owned.has(file))

  const lint = await lintFiles(resolved, lintable, { fix: true })
  const format = await formatFiles(resolved, relativeFiles)

  const problems: Array<string> = []
  if (lint.errorCount + lint.warningCount > 0) {
    const { ESLint } = await import('eslint')
    const formatter = await new ESLint().loadFormatter('stylish')
    problems.push(await formatter.format(lint.results.filter((entry) => entry.messages.length > 0)))
  }
  for (const error of format.errors) {
    problems.push(`${error.path}: Prettier could not parse this file: ${error.message}`)
  }
  if (problems.length > 0) {
    throw new CheckFailure(
      `${problems.join('\n')}\nThe commit was stopped; your staged and unstaged changes are preserved. Fix the problems above and commit again.`,
    )
  }
  const result = {
    linted: lintable.length,
    fixed: lint.fixedFiles,
    formatted: format.changed.length,
  }
  log(`toolpath-dev: ${result.linted} linted, ${result.fixed} fixed, ${result.formatted} formatted`)
  return result
}

export interface StagedTask {
  title: string
  task: (files: ReadonlyArray<string>) => Promise<void>
}

/** The lint-staged task that runs `processStagedFiles` on the files it matches. */
export const createStagedTask = (config: DevConfig): StagedTask => ({
  title: 'toolpath-dev: safe lint fixes, then formatting',
  task: async (files) => {
    try {
      await processStagedFiles(config, files)
    } catch (error) {
      // lint-staged reports only that the task failed; the diagnostic is ours to print.
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      throw error
    }
  },
})

/** A complete lint-staged configuration for a repository the standard owns entirely. */
export const createLintStagedConfig = (config: DevConfig): Record<string, StagedTask> => ({
  '*': createStagedTask(config),
})
