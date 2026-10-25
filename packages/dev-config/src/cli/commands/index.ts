import type { ParseArgsConfig } from 'node:util'
import type { Output } from '../output.js'
import { hookFiles, preCommit } from './hooks.js'
import { check, lint, test, typecheck, type QualityFlags } from './quality.js'

export interface CommandContext {
  values: Record<string, unknown>
  positionals: Array<string>
  /** Arguments after `--`. */
  passthrough: Array<string>
  output: Output
  common: { config?: string; projects: Array<string> }
}

export interface Command {
  usage: string
  options: NonNullable<ParseArgsConfig['options']>
  positionals?: boolean
  passthrough?: boolean
  run: (context: CommandContext) => Promise<void>
}

const qualityFlags = (context: CommandContext): QualityFlags => ({
  ...context.common,
  suites: Array.isArray(context.values.suite) ? (context.values.suite as Array<string>) : [],
  watch: context.values.watch === true,
  filters: context.passthrough,
  ...(typeof context.values['report-dir'] === 'string'
    ? { reportDir: context.values['report-dir'] }
    : {}),
})

export const COMMANDS: Record<string, Command> = {
  lint: {
    usage:
      'toolpath-dev lint [--project <name>]...\nStrict lint of every maintained file in the selection. Zero warnings; nothing is changed.',
    options: {},
    run: (context) => lint(qualityFlags(context), context.output),
  },
  'lint:fix': {
    usage:
      'toolpath-dev lint:fix [--project <name>]...\nApplies safe ESLint fixes, then reports what remains. Optional; formatting happens at commit.',
    options: {},
    run: (context) => lint(qualityFlags(context), context.output, { fix: true }),
  },
  'check-types': {
    usage:
      'toolpath-dev check-types [--project <name>]...\nStrict no-emit checks of each selected source, test and tooling program.',
    options: {},
    run: (context) => typecheck(qualityFlags(context), context.output),
  },
  test: {
    usage:
      'toolpath-dev test [--project <name>]... [--suite <project>:<suite>]... [--watch] [-- <file filters>]\n' +
      'Runs ordinary unit/component suites once. --suite also runs a declared browser or command suite.',
    options: {
      suite: { type: 'string', multiple: true },
      watch: { type: 'boolean' },
      'report-dir': { type: 'string' },
    },
    passthrough: true,
    run: async (context) => {
      await test(qualityFlags(context), context.output)
    },
  },
  check: {
    usage:
      'toolpath-dev check [--project <name>]...\nDoctor essentials, prerequisite builds, lint, type checks and ordinary tests. Never formats.',
    options: {},
    run: (context) => check(qualityFlags(context), context.output),
  },
  'hooks files': {
    usage:
      'toolpath-dev hooks files [--config <path>] -- <files>...\nInternal: safe lint fixes then formatting for one staged batch, for a lint-staged task that already manages the index.',
    options: {},
    passthrough: true,
    run: (context) => hookFiles(context.common, context.passthrough, context.output),
  },
  'hooks pre-commit': {
    usage:
      'toolpath-dev hooks pre-commit\nThe managed pre-commit entry point: safe lint fixes for staged TS/JS, then formatting, restaged.',
    options: {},
    run: (context) => preCommit(context.common, context.output),
  },
}
