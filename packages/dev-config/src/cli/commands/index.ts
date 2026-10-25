import type { ParseArgsConfig } from 'node:util'
import type { Output } from '../output.js'
import type { PackageManagerName } from '../../config/packages.js'
import { UsageError } from '../../errors.js'
import { runDoctor } from './doctor.js'
import { verifyContract } from './engine.js'
import { hookFiles, preCommit } from './hooks.js'
import {
  parseProjectSpec,
  runHooksInstall,
  runInit,
  runSync,
  type InitFlags,
  type ProjectSpec,
  type SyncFlags,
} from './manage.js'
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

const packageManagerFlag = (value: unknown): PackageManagerName | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (value !== 'npm' && value !== 'pnpm') {
    throw new UsageError('--package-manager must be npm or pnpm')
  }
  return value
}

const syncFlags = (context: CommandContext): SyncFlags => {
  const packageManager = packageManagerFlag(context.values['package-manager'])
  return {
    ...(context.common.config === undefined ? {} : { config: context.common.config }),
    dryRun: context.values['dry-run'] === true,
    install: context.values['skip-install'] !== true,
    ...(packageManager === undefined ? {} : { packageManager }),
  }
}

const string = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const initFlags = (context: CommandContext): InitFlags => {
  const { values } = context
  const specs: Array<ProjectSpec> = Array.isArray(values['project-spec'])
    ? (values['project-spec'] as Array<string>).map(parseProjectSpec)
    : []
  const name = string(values.name)
  if (
    specs.length > 0 &&
    (name !== undefined || values.kind !== undefined || values.runtime !== undefined)
  ) {
    throw new UsageError(
      'Use either --project-spec (one per project) or the single-project flags --name/--kind/--runtime, not both.',
    )
  }
  if (specs.length === 0 && name !== undefined) {
    const react = string(values.react)
    const minimum = string(values['react-minimum'])
    const reason = string(values['no-unit-tests-reason'])
    specs.push({
      name,
      root: '.',
      kind: (string(values.kind) ?? 'library') as ProjectSpec['kind'],
      runtime: (string(values.runtime) ?? 'node') as ProjectSpec['runtime'],
      ...(react === undefined ? {} : { react: react as NonNullable<ProjectSpec['react']> }),
      ...(minimum === undefined
        ? {}
        : { reactMinimum: minimum as NonNullable<ProjectSpec['reactMinimum']> }),
      tests: (string(values.tests) ?? 'vitest') as ProjectSpec['tests'],
      browser: values['browser-tests'] === true,
      ...(reason === undefined ? {} : { noUnitTestsReason: reason }),
    })
  }
  const engine = string(values.engine)
  const integration = Array.isArray(values['engine-integration'])
    ? (values['engine-integration'] as Array<string>)
    : []
  if (engine === undefined && integration.length > 0) {
    throw new UsageError('--engine-integration needs --engine <contract>.')
  }
  const skillsDir = string(values['skills-dir'])
  return {
    ...syncFlags(context),
    specs,
    ...(engine === undefined
      ? {}
      : {
          engine: {
            contract: engine,
            integrationFiles:
              integration.length > 0 ? integration : ['src/integrations/engine/**/*.{ts,tsx}'],
          },
        }),
    ...(skillsDir === undefined ? {} : { skillsDir }),
  }
}

const INIT_USAGE = `toolpath-dev init [options]
Adds the standard to the repository in the current directory. Nothing is written until the
whole plan validates; --dry-run prints the complete diff instead.

Single project (root '.'):
  --name <name> --kind application|library|tooling --runtime node|dom|native|universal
  [--react vite-legacy|vite-modern|react-router|expo|library-esbuild|babel] [--react-minimum 17|18|19]
  [--tests vitest|jest-expo|none] [--no-unit-tests-reason <why>] [--browser-tests]
Workspace (one per project):
  --project-spec name=core,root=packages/core,kind=library,runtime=universal
  --project-spec name=app,root=apps/app,kind=application,runtime=dom,react=vite-modern,browser=true
Profiles and options:
  --engine api-1.29.1|api-1.32.0 [--engine-integration <glob>]...
  --skills-dir <repo-relative path>   (default .claude/skills)
  --package-manager npm|pnpm          (required when metadata is missing or conflicting)
  --skip-install                      (write exact devDependencies without installing)
  --dry-run`

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
  'hooks install': {
    usage:
      'toolpath-dev hooks install\nPoints Git at the managed pre-commit hook. Skipped in CI. The prepare script runs it on install.',
    options: {},
    run: (context) => runHooksInstall(context.common, context.output),
  },
  init: {
    usage: INIT_USAGE,
    options: {
      'dry-run': { type: 'boolean' },
      'package-manager': { type: 'string' },
      'skip-install': { type: 'boolean' },
      name: { type: 'string' },
      kind: { type: 'string' },
      runtime: { type: 'string' },
      react: { type: 'string' },
      'react-minimum': { type: 'string' },
      tests: { type: 'string' },
      'browser-tests': { type: 'boolean' },
      'no-unit-tests-reason': { type: 'string' },
      'project-spec': { type: 'string', multiple: true },
      engine: { type: 'string' },
      'engine-integration': { type: 'string', multiple: true },
      'skills-dir': { type: 'string' },
    },
    run: (context) => runInit(initFlags(context), context.output),
  },
  sync: {
    usage:
      'toolpath-dev sync [--dry-run] [--skip-install]\nUpdates managed files, scripts, tool versions, CI references and agent assets to the installed release. Project facts in dev.config.mjs are never reset.',
    options: {
      'dry-run': { type: 'boolean' },
      'package-manager': { type: 'string' },
      'skip-install': { type: 'boolean' },
    },
    run: (context) => runSync(syncFlags(context), context.output),
  },
  'agents sync': {
    usage:
      'toolpath-dev agents sync [--dry-run]\nSynchronizes the managed AGENTS.md section and installed skills, with the same conflict handling as sync.',
    options: { 'dry-run': { type: 'boolean' } },
    run: (context) => runSync({ ...syncFlags(context), install: false }, context.output, 'agents'),
  },
  doctor: {
    usage:
      'toolpath-dev doctor [--verbose] [--json]\nRead-only diagnosis of configuration, scope, TypeScript programs, tool versions, native configs, hooks, receipt and CI wiring.',
    options: {},
    run: (context) => runDoctor(context.common, context.output),
  },
  'engine verify-contract': {
    usage:
      'toolpath-dev engine verify-contract [--target production|staging|<url>] [--contract <id>]\n' +
      "Network check: compares the target's public /v1/openapi.json with the installed @toolpath/api's recorded contract\n" +
      "and the pinned snapshot (--contract, else engine.contract in dev.config.mjs, else the SDK's). Changes nothing.",
    options: { target: { type: 'string' }, contract: { type: 'string' } },
    run: (context) =>
      verifyContract(
        {
          ...(context.common.config === undefined ? {} : { config: context.common.config }),
          ...(typeof context.values.target === 'string' ? { target: context.values.target } : {}),
          ...(typeof context.values.contract === 'string'
            ? { contract: context.values.contract }
            : {}),
        },
        context.output,
      ),
  },
}
