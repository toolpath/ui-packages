import { findConfigFile, loadConfig } from '../../config/load.js'
import { resolveConfig } from '../../config/resolve.js'
import { CheckFailure } from '../../errors.js'
import { createLintStagedConfig, processStagedFiles } from '../../hooks/index.js'
import type { Output } from '../output.js'
import { deferInterruptExit } from '../process.js'

/** `hooks files -- <files>`: one batch from an outer lint-staged invocation. Index management stays with it. */
export const hookFiles = async (
  flags: { config?: string },
  files: ReadonlyArray<string>,
  output: Output,
): Promise<void> => {
  const config = await loadConfig(findConfigFile(process.cwd(), flags.config))
  await processStagedFiles(config, files, (text) => {
    output.detail(text)
  })
}

/**
 * `hooks pre-commit`: lint-staged over the staged index with the standard's one
 * task. lint-staged hides unstaged edits while it runs, restages what the task
 * changed, and restores the edits afterwards; a failed restore is reported by it
 * with the backup it kept.
 */
export const preCommit = async (flags: { config?: string }, output: Output): Promise<void> => {
  const config = await loadConfig(findConfigFile(process.cwd(), flags.config))
  const resolved = resolveConfig(config)
  // An interruption must reach lint-staged, which restores hidden unstaged edits.
  deferInterruptExit()
  const { default: lintStaged } = await import('lint-staged')
  const passed = await lintStaged({
    config: createLintStagedConfig(config),
    cwd: resolved.root,
    concurrent: false,
    quiet: !output.verbose,
  })
  if (!passed) {
    throw new CheckFailure(
      'pre-commit: the staged files did not pass. Nothing was committed; your changes are preserved.',
    )
  }
}
