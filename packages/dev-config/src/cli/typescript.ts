import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ResolvedConfig } from '../config/resolve.js'
import { findInstalledPackage, packageBin } from '../config/packages.js'
import { CheckFailure, PrerequisiteError, type Issue } from '../errors.js'
import { mapLimit, processConcurrency, run } from './process.js'
import { plural, seconds, type Output } from './output.js'

/** Compiler options every check program must have, and their required values. */
const REQUIRED_COMPILER_OPTIONS: Readonly<Record<string, boolean>> = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  forceConsistentCasingInFileNames: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
}

export interface Program {
  /** `project name` or `tooling`. */
  label: string
  tsconfig: string
  /** Repository-relative maintained files this program must contain. */
  files: Array<string>
}

interface TypeScriptModule {
  version: string
  sys: {
    fileExists: (path: string) => boolean
    readFile: (path: string) => string | undefined
  } & Record<string, unknown>
  getParsedCommandLineOfConfigFile: (
    path: string,
    options: Record<string, unknown>,
    host: Record<string, unknown>,
  ) =>
    | {
        options: Record<string, unknown>
        fileNames: Array<string>
        errors: Array<{ messageText: unknown }>
      }
    | undefined
  flattenDiagnosticMessageText: (text: unknown, newLine: string) => string
}

const loadTypeScript = async (root: string): Promise<{ ts: TypeScriptModule; tsc: string }> => {
  const installed = findInstalledPackage(root, 'typescript')
  if (!installed) {
    throw new PrerequisiteError(
      'TypeScript is not installed. It is a required dev dependency of @toolpath/dev-config consumers.',
    )
  }
  const module = (await import(join(installed.directory, 'lib', 'typescript.js'))) as {
    default: TypeScriptModule
  }
  return { ts: module.default, tsc: packageBin(installed, 'tsc') }
}

/**
 * Problems with a program's configuration: missing strict flags, a skipped
 * library check, JS files it cannot check, and maintained files it omits.
 */
export const inspectPrograms = async (
  resolved: ResolvedConfig,
  programs: ReadonlyArray<Program>,
): Promise<Array<Issue>> => {
  const { ts } = await loadTypeScript(resolved.root)
  const issues: Array<Issue> = []
  for (const program of programs) {
    const where = program.tsconfig.slice(resolved.root.length + 1) || program.tsconfig
    const parsed = ts.getParsedCommandLineOfConfigFile(
      program.tsconfig,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => undefined,
      },
    )
    if (!parsed) {
      issues.push({ path: where, message: 'could not be read as a TypeScript configuration' })
      continue
    }
    for (const error of parsed.errors) {
      issues.push({ path: where, message: ts.flattenDiagnosticMessageText(error.messageText, ' ') })
    }
    for (const [option, value] of Object.entries(REQUIRED_COMPILER_OPTIONS)) {
      if (parsed.options[option] !== value) {
        issues.push({
          path: where,
          message: `${option} must be ${String(value)} (extend @toolpath/dev-config/typescript/*.json)`,
        })
      }
    }
    if (parsed.options.skipLibCheck === true) {
      issues.push({
        path: where,
        message:
          'skipLibCheck hides declaration errors in every dependency; fix the incompatible declaration or document a narrow exception',
      })
    }
    const included = new Set(
      parsed.fileNames.map((file) => {
        try {
          return realpathSync(file)
        } catch {
          return file
        }
      }),
    )
    const hasScript = program.files.some((file) => /\.[cm]?jsx?$/.test(file))
    if (hasScript && (parsed.options.allowJs !== true || parsed.options.checkJs !== true)) {
      issues.push({
        path: where,
        message: 'owns JavaScript files, so it needs allowJs and checkJs to check them',
      })
    }
    const missing = program.files.filter((file) => !included.has(join(resolved.root, file)))
    for (const file of missing.slice(0, 10)) {
      issues.push({
        path: file,
        message: `is maintained ${program.label} source but ${where} does not include it`,
      })
    }
    if (missing.length > 10) {
      issues.push({
        path: where,
        message: `and ${missing.length - 10} more maintained files it does not include`,
      })
    }
  }
  return issues
}

export interface TypeCheckResult {
  label: string
  ok: boolean
  output: string
  durationMs: number
}

/** Strict no-emit checking of each program with the repository's own TypeScript, bounded in parallel. */
export const checkTypes = async (
  resolved: ResolvedConfig,
  programs: ReadonlyArray<Program>,
  output: Output,
): Promise<Array<TypeCheckResult>> => {
  const { tsc } = await loadTypeScript(resolved.root)
  const started = performance.now()
  const results = await mapLimit(programs, processConcurrency(), async (program) => {
    const result = await run(
      process.execPath,
      [tsc, '-p', program.tsconfig, '--noEmit', '--pretty', 'false'],
      {
        cwd: dirname(program.tsconfig),
      },
    )
    return {
      label: program.label,
      ok: result.code === 0,
      output: `${result.stdout}${result.stderr}`.trim(),
      durationMs: result.durationMs,
    }
  })
  output.record(
    'types',
    results.map(({ label, ok, durationMs }) => ({ label, ok, durationMs: Math.round(durationMs) })),
  )
  const failed = results.filter((result) => !result.ok)
  for (const result of failed) {
    output.failure(`${result.label} (${seconds(result.durationMs)}):\n${result.output}`)
  }
  if (failed.length > 0) {
    throw new CheckFailure(
      `check-types: ${plural(failed.length, 'program')} failed: ${failed.map((result) => result.label).join(', ')}`,
    )
  }
  output.line(
    `check-types: ${plural(results.length, 'program')} clean (${seconds(performance.now() - started)})`,
  )
  return results
}
