import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ESLint, Linter } from 'eslint'
import type { ResolvedConfig } from '../config/resolve.js'
import { CheckFailure, ConfigError, type Issue } from '../errors.js'
import { createEslintConfig } from '../eslint/index.js'
import { plural, seconds, type Output } from './output.js'

export const ESLINT_CONFIG_FILE = 'eslint.config.mjs'

type Severity = 0 | 1 | 2

const severity = (entry: Linter.RuleEntry | undefined): Severity => {
  const value = Array.isArray(entry) ? entry[0] : entry
  if (value === 'error' || value === 2) {
    return 2
  }
  if (value === 'warn' || value === 1) {
    return 1
  }
  return 0
}

const options = (entry: Linter.RuleEntry | undefined): string =>
  JSON.stringify(Array.isArray(entry) ? entry.slice(1) : [])

/**
 * Baseline rules a native config changed for `file`. Raising a rule the baseline
 * turns off is allowed; anything else that differs (lower severity, different
 * options) is a weakening the standard gate refuses.
 */
export const weakenedRules = (
  baseline: Partial<Linter.RulesRecord>,
  effective: Partial<Linter.RulesRecord>,
): Array<{ rule: string; baseline: string; effective: string }> => {
  const changes: Array<{ rule: string; baseline: string; effective: string }> = []
  for (const [rule, expected] of Object.entries(baseline)) {
    const actual = effective[rule]
    const expectedSeverity = severity(expected)
    const actualSeverity = severity(actual)
    if (expectedSeverity === 0) {
      continue
    }
    if (actualSeverity !== expectedSeverity || options(expected) !== options(actual)) {
      changes.push({
        rule,
        baseline: JSON.stringify(expected),
        effective: actual === undefined ? 'unset' : JSON.stringify(actual),
      })
    }
  }
  return changes
}

const loadEslint = async (): Promise<typeof ESLint> => {
  const module = await import('eslint')
  return module.ESLint
}

const POLICY_RULE = 'toolpath/no-blanket-quality-disable'

/**
 * A directive that disables every rule also silences the report about itself,
 * so the policy rule's suppressed messages count as errors: a blanket disable
 * cannot hide its own violation.
 */
export const promoteSelfSuppressed = (result: ESLint.LintResult): ESLint.LintResult => {
  const promoted = result.suppressedMessages.filter((message) => message.ruleId === POLICY_RULE)
  if (promoted.length === 0) {
    return result
  }
  const messages = [
    ...result.messages,
    ...promoted.map(({ suppressions: _suppressions, ...message }) => ({
      ...message,
      severity: 2 as const,
    })),
  ]
  messages.sort((a, b) => a.line - b.line || a.column - b.column)
  return {
    ...result,
    messages,
    suppressedMessages: result.suppressedMessages.filter(
      (message) => message.ruleId !== POLICY_RULE,
    ),
    errorCount: result.errorCount + promoted.length,
  }
}

export interface LintRun {
  results: Array<ESLint.LintResult>
  errorCount: number
  warningCount: number
  fixedFiles: number
  durationMs: number
}

/**
 * Lints `files` (repository-relative) with the repository's native ESLint
 * config, after proving that config leaves every baseline rule intact.
 */
export const lintFiles = async (
  resolved: ResolvedConfig,
  files: ReadonlyArray<string>,
  { fix = false }: { fix?: boolean } = {},
): Promise<LintRun> => {
  const started = performance.now()
  const configFile = join(resolved.root, ESLINT_CONFIG_FILE)
  if (!existsSync(configFile)) {
    throw new ConfigError(
      `${ESLINT_CONFIG_FILE} is missing at ${resolved.root}. It must export \`await createEslintConfig(config)\` from @toolpath/dev-config/eslint (\`toolpath-dev init\` writes it).`,
    )
  }
  if (files.length === 0) {
    return { results: [], errorCount: 0, warningCount: 0, fixedFiles: 0, durationMs: 0 }
  }
  const ESLintClass = await loadEslint()
  const native = new ESLintClass({
    cwd: resolved.root,
    overrideConfigFile: configFile,
    cache: false,
    fix,
    errorOnUnmatchedPattern: true,
  })
  const baseline = new ESLintClass({
    cwd: resolved.root,
    overrideConfigFile: true,
    overrideConfig: await createEslintConfig(resolved.config),
    cache: false,
  })

  const issues: Array<Issue> = []
  for (const file of files) {
    const absolute = join(resolved.root, file)
    const [expected, actual] = (await Promise.all([
      baseline.calculateConfigForFile(absolute),
      native.calculateConfigForFile(absolute),
    ])) as [Linter.Config | undefined, Linter.Config | undefined]
    if (!actual) {
      issues.push({ path: file, message: `${ESLINT_CONFIG_FILE} ignores this maintained file` })
      continue
    }
    for (const change of weakenedRules(expected?.rules ?? {}, actual.rules ?? {})) {
      issues.push({
        path: file,
        message: `${ESLINT_CONFIG_FILE} changes baseline rule ${change.rule} from ${change.baseline} to ${change.effective}. Baseline rules are fixed; declare a narrow exception in dev.config.mjs instead`,
      })
    }
    if (issues.length >= 20) {
      break
    }
  }
  if (issues.length > 0) {
    throw new ConfigError(`${ESLINT_CONFIG_FILE} weakens the shared policy:`, issues)
  }

  const results = (await native.lintFiles(files.map((file) => join(resolved.root, file)))).map(
    promoteSelfSuppressed,
  )
  let fixedFiles = 0
  if (fix) {
    fixedFiles = results.filter((result) => result.output !== undefined).length
    await ESLintClass.outputFixes(results)
  }
  return {
    results,
    errorCount: results.reduce(
      (sum, result) => sum + result.errorCount + result.fatalErrorCount,
      0,
    ),
    warningCount: results.reduce((sum, result) => sum + result.warningCount, 0),
    fixedFiles,
    durationMs: performance.now() - started,
  }
}

/** Prints a lint run concisely and fails on any error or warning. */
export const reportLint = async (run: LintRun, output: Output, label: string): Promise<void> => {
  const problems = run.errorCount + run.warningCount
  output.record('lint', {
    files: run.results.length,
    errors: run.errorCount,
    warnings: run.warningCount,
    fixedFiles: run.fixedFiles,
    durationMs: Math.round(run.durationMs),
  })
  if (problems === 0) {
    output.line(
      `${label}: ${plural(run.results.length, 'file')} clean${run.fixedFiles > 0 ? `, ${plural(run.fixedFiles, 'file')} fixed` : ''} (${seconds(run.durationMs)})`,
    )
    return
  }
  const ESLintClass = await loadEslint()
  const formatter = await new ESLintClass().loadFormatter('stylish')
  output.failure(await formatter.format(run.results.filter((result) => result.messages.length > 0)))
  throw new CheckFailure(
    `${label}: ${plural(run.errorCount, 'error')}${run.warningCount > 0 ? ` and ${plural(run.warningCount, 'warning')} (warnings fail too)` : ''}`,
  )
}
