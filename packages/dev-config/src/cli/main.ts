#!/usr/bin/env node
import { parseArgs, type ParseArgsConfig } from 'node:util'
import {
  CheckFailure,
  EXIT_CHECK_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  UsageError,
} from '../errors.js'
import { COMMANDS, type CommandContext } from './commands/index.js'
import { createOutput } from './output.js'
import { installSignalHandlers, interruption } from './process.js'

const USAGE = `Usage: toolpath-dev <command> [options]

Commands:
  init                 Add the standard to a repository (preview with --dry-run)
  sync                 Update managed files and tool versions to this release
  doctor               Read-only diagnosis of configuration, tools, hooks and CI wiring
  lint                 Strict lint, zero warnings, no changes
  lint:fix             Apply safe ESLint fixes (optional; never a formatting step)
  check-types          Strict no-emit type checks of every selected program
  test                 One-shot unit/component suites (--watch for one suite)
  check                Doctor essentials, prerequisite builds, lint, types, tests
  ci                   The CI quality contract (format backstop + required stages)
  hooks install        Install the managed pre-commit hook
  hooks pre-commit     The pre-commit entry point (safe lint fixes, then formatting)
  agents sync          Synchronize agent instructions and skills
  engine verify-contract  Network check of an Engine target's public contract

Common options:
  --project <name>     Limit to a project (repeatable)
  --config <path>      Use this dev.config.mjs
  --verbose            Show detail
  --json               Print one JSON document
  -h, --help           Show this help

Exit codes: 0 success, 1 a check failed, 2 invalid invocation, configuration or prerequisite.
`

const GLOBAL_OPTIONS = {
  project: { type: 'string', multiple: true },
  config: { type: 'string' },
  verbose: { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} satisfies ParseArgsConfig['options']

const main = async (argv: Array<string>): Promise<number> => {
  const [first, second] = argv
  if (first === undefined || first === '--help' || first === '-h' || first === 'help') {
    process.stdout.write(USAGE)
    return first === undefined ? EXIT_USAGE : EXIT_SUCCESS
  }
  const key = second !== undefined && COMMANDS[`${first} ${second}`] ? `${first} ${second}` : first
  const command = COMMANDS[key]
  if (!command) {
    process.stderr.write(`Unknown command "${first}".\n\n${USAGE}`)
    return EXIT_USAGE
  }
  const rest = argv.slice(key.split(' ').length)
  let parsed
  try {
    parsed = parseArgs({
      args: rest,
      options: { ...GLOBAL_OPTIONS, ...command.options },
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    process.stderr.write(
      `toolpath-dev ${key}: ${(error as Error).message}\nSee toolpath-dev --help.\n`,
    )
    return EXIT_USAGE
  }
  const values = parsed.values as Record<string, unknown>
  if (values.help === true) {
    process.stdout.write(`${command.usage}\n`)
    return EXIT_SUCCESS
  }
  const separator = rest.indexOf('--')
  const positionals =
    separator === -1
      ? parsed.positionals
      : parsed.positionals.slice(0, parsed.positionals.length - (rest.length - separator - 1))
  const afterSeparator = separator === -1 ? [] : rest.slice(separator + 1)
  if (positionals.length > 0 && !command.positionals) {
    process.stderr.write(
      `toolpath-dev ${key}: unexpected argument "${positionals[0] ?? ''}".\n${command.usage}\n`,
    )
    return EXIT_USAGE
  }
  if (afterSeparator.length > 0 && !command.passthrough) {
    process.stderr.write(
      `toolpath-dev ${key}: does not accept arguments after --.\n${command.usage}\n`,
    )
    return EXIT_USAGE
  }

  const output = createOutput({ json: values.json === true, verbose: values.verbose === true })
  const context: CommandContext = {
    values,
    positionals,
    passthrough: afterSeparator,
    output,
    common: {
      ...(typeof values.config === 'string' ? { config: values.config } : {}),
      projects: Array.isArray(values.project) ? (values.project as Array<string>) : [],
    },
  }
  try {
    await command.run(context)
    output.record('ok', true)
    output.flush()
  } catch (error) {
    output.record('ok', false)
    if (error instanceof UsageError || error instanceof CheckFailure) {
      output.record('error', error.message)
      output.flush()
      output.failure(error.message)
      return error.exitCode
    }
    output.flush()
    output.failure(
      `toolpath-dev ${key}: unexpected error\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    )
    return EXIT_USAGE
  }
  return interruption() ? EXIT_CHECK_FAILURE : EXIT_SUCCESS
}

installSignalHandlers()
const code = await main(process.argv.slice(2))
const signal = interruption()
process.exitCode = signal ? (signal === 'SIGINT' ? 130 : 143) : code
