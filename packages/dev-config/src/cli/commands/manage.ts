import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from '../../config/define.js'
import { CONFIG_FILE, findConfigFile, loadConfig } from '../../config/load.js'
import {
  detectPackageManager,
  testedPackageManager,
  type PackageManagerName,
} from '../../config/packages.js'
import { readManifest, resolveConfig, type ResolvedConfig } from '../../config/resolve.js'
import type {
  DevConfigInput,
  ProjectConfig,
  ProjectKind,
  ProjectRuntime,
  ReactAdapter,
  ReactMinimumVersion,
} from '../../config/types.js'
import { moduleTypeIssues } from '../../config/module-type.js'
import { validateConfigShape } from '../../config/validate.js'
import { ConfigError, PrerequisiteError, UsageError } from '../../errors.js'
import { toolchain } from '../../policy/toolchain.js'
import { ADAPTER_WIRING } from '../../react/requirements.js'
import { assertInstallableIdentity, type ReleaseIdentity } from '../../release/metadata.js'
import { desiredState, type DesiredScope } from '../../sync/desired.js'
import {
  applyWrites,
  conflictIssues,
  describePlan,
  planSync,
  writeAtomically,
  type Plan,
  type Write,
} from '../../sync/engine.js'
import { installExact } from '../../sync/install.js'
import { RECEIPT_PATH, readReceipt, serializeReceipt } from '../../sync/receipt.js'
import {
  devConfigModule,
  jestExpoConfig,
  playwrightConfig,
  projectTestTsconfig,
  reactBuildConfig,
  projectTsconfig,
  TOOLING_FILES,
  toolingTsconfig,
  vitestConfig,
} from '../../sync/templates.js'
import { plural, type Output } from '../output.js'

/** The release this installed package was built as. */
export const installedIdentity = (): ReleaseIdentity =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../release.json', import.meta.url)), 'utf8'),
  ) as ReleaseIdentity

/** Legacy formats that would compete with the managed native configs. */
const COMPETING_CONFIGS = [
  ...[
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
  ].map((path) => ({
    path,
    reason:
      'is another ESLint configuration; the standard reads eslint.config.mjs only. Fold its project-specific rules into createEslintConfig options, then remove it',
  })),
  ...[
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.toml',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.ts',
  ].map((path) => ({
    path,
    reason:
      'is another Prettier configuration; the shared policy is fixed. Remove it (byte-retained files go in formatIgnore)',
  })),
  ...[
    '.lintstagedrc',
    '.lintstagedrc.json',
    '.lintstagedrc.js',
    '.lintstagedrc.mjs',
    'lint-staged.config.js',
    'lint-staged.config.mjs',
  ].map((path) => ({
    path,
    reason:
      'configures lint-staged separately; `toolpath-dev hooks pre-commit` owns staged-file fixes and formatting. Remove it or compose it (docs/adoption.md)',
  })),
]

/**
 * Git hooks another tool already owns: a custom `core.hooksPath`, or executable
 * hooks in `.git/hooks`. Pointing Git at `.husky/_` would silently stop them.
 */
export const foreignHooks = (root: string): string | undefined => {
  const git = (args: Array<string>): string => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    return result.status === 0 ? result.stdout.trim() : ''
  }
  const hooksPath = git(['config', '--get', 'core.hooksPath'])
  if (hooksPath !== '' && hooksPath !== '.husky/_') {
    return `Git runs hooks from ${hooksPath} (core.hooksPath), which another tool or the repository owns`
  }
  if (hooksPath === '') {
    const directory = git(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'])
    const active =
      directory !== '' && existsSync(directory)
        ? readdirSync(directory).filter(
            (name) => !name.endsWith('.sample') && !name.startsWith('.'),
          )
        : []
    if (active.length > 0) {
      return `.git/hooks has active hooks (${active.join(', ')}) that would stop running`
    }
  }
  return undefined
}

const gitPrefix = (root: string): string => {
  const result = spawnSync('git', ['rev-parse', '--show-prefix'], { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim().replace(/\/$/, '') : ''
}

const declaredVersions = (root: string): Record<string, string> => {
  const manifest = readManifest(root)
  return { ...(manifest?.dependencies ?? {}), ...(manifest?.devDependencies ?? {}) }
}

const competingConfigs = (root: string): typeof COMPETING_CONFIGS => {
  const manifest = readManifest(root) as
    (Record<string, unknown> & { eslintConfig?: unknown }) | undefined
  const extra: typeof COMPETING_CONFIGS = []
  for (const key of ['eslintConfig', 'prettier', 'lint-staged']) {
    if (manifest?.[key] !== undefined) {
      extra.push({
        path: `package.json#${key}`,
        reason: `package.json has a "${key}" field that competes with the managed configuration; remove it`,
      })
    }
  }
  // A hook that already formats or runs lint-staged would format staged files a second time.
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' })
  const hook = top.status === 0 ? join(top.stdout.trim(), '.husky/pre-commit') : undefined
  if (hook && existsSync(hook)) {
    const outside = readFileSync(hook, 'utf8').replace(
      /# toolpath-dev:begin pre-commit[\s\S]*?# toolpath-dev:end pre-commit\n?/,
      '',
    )
    if (/\b(lint-staged|prettier|eslint)\b/.test(outside)) {
      extra.push({
        path: '.husky/pre-commit',
        reason:
          'already runs lint-staged, Prettier or ESLint; the managed hook does staged fixes and formatting. Remove those commands and keep any others',
      })
    }
  }
  const owner = top.status === 0 ? foreignHooks(root) : undefined
  if (owner) {
    extra.push({
      path: 'git hooks',
      reason: `${owner}. Move those hooks into .husky/ (the managed pre-commit block runs beside them), unset core.hooksPath, then rerun`,
    })
  }
  return [...COMPETING_CONFIGS.filter((entry) => existsSync(join(root, entry.path))), ...extra]
}

interface ApplyOptions {
  root: string
  plan: Plan
  extraWrites?: Array<Write>
  dryRun: boolean
  install: boolean
  packageManager: PackageManagerName
  output: Output
  label: string
}

/** Prints a dry run, or refuses on conflicts before writing, or applies the plan and installs. */
const applyPlan = async ({
  root,
  plan,
  extraWrites = [],
  dryRun,
  install,
  packageManager,
  output,
  label,
}: ApplyOptions): Promise<void> => {
  const receiptPath = join(root, RECEIPT_PATH)
  const receiptBefore = existsSync(receiptPath) ? readFileSync(receiptPath, 'utf8') : undefined
  const combined: Plan = { ...plan, writes: [...extraWrites, ...plan.writes] }
  const diff = describePlan(combined, receiptBefore)
  output.record('plan', {
    writes: combined.writes.map((write) => write.path),
    installs: combined.installs,
    runtimeInstalls: combined.runtimeInstalls,
    conflicts: combined.conflicts,
  })
  if (plan.conflicts.length > 0) {
    for (const conflict of plan.conflicts) {
      if (conflict.patch !== '') {
        output.failure(`# proposed change for ${conflict.path} (not applied)\n${conflict.patch}`)
      }
    }
    throw new ConfigError(
      `${label}: nothing was changed; resolve these conflicts first:`,
      conflictIssues(plan),
    )
  }
  if (dryRun) {
    if (diff === '') {
      output.line(`${label} --dry-run: no changes`)
    } else if (!output.json) {
      process.stdout.write(`${diff}\n`)
    }
    return
  }
  if (diff === '') {
    output.line(`${label}: already up to date`)
    return
  }
  applyWrites(root, combined.writes)
  const installCount = Object.keys(plan.installs).length + Object.keys(plan.runtimeInstalls).length
  if (install && installCount > 0) {
    try {
      await installExact(root, packageManager, plan.installs)
      await installExact(root, packageManager, plan.runtimeInstalls, { runtime: true })
    } catch (error) {
      const recovery = join(root, '.toolpath/dev-config-recovery.patch')
      writeAtomically(recovery, `${diff}\n`)
      throw new PrerequisiteError(
        `${(error as Error).message}\n\n${label} had already written: ${combined.writes.map((write) => write.path).join(', ')}.\n` +
          `The complete change is saved in ${relative(process.cwd(), recovery)}; fix the install problem and rerun, or revert those files with Git.`,
      )
    }
  }
  writeAtomically(receiptPath, serializeReceipt(plan.receipt))
  output.line(
    `${label}: ${plural(combined.writes.length, 'file')} written${installCount > 0 ? `, ${plural(installCount, 'package')} installed` : ''}; receipt ${RECEIPT_PATH}`,
  )
}

const synchronize = async (
  resolved: ResolvedConfig,
  {
    scope,
    dryRun,
    install,
    output,
    label,
    extraWrites = [],
  }: {
    scope: DesiredScope
    dryRun: boolean
    install: boolean
    output: Output
    label: string
    extraWrites?: Array<Write>
  },
  explicitPackageManager?: PackageManagerName,
): Promise<void> => {
  const identity = installedIdentity()
  assertInstallableIdentity(identity)
  const packageManager = detectPackageManager(resolved.root, explicitPackageManager)
  if (!packageManager) {
    throw new ConfigError(
      'No package manager could be identified: package.json declares none and no lockfile exists. Pass --package-manager npm|pnpm.',
    )
  }
  const receipt = readReceipt(resolved.root)
  const desired = desiredState({
    resolved,
    packageManager: packageManager.name,
    identity,
    declared: declaredVersions(resolved.root),
    gitPrefix: gitPrefix(resolved.root),
    scope,
  })
  const plan = planSync({
    root: resolved.root,
    desired,
    receipt,
    identity,
    packageManager: testedPackageManager(packageManager.name),
    installedSelfVersion: identity.version,
    forbidden: scope === 'all' ? competingConfigs(resolved.root) : [],
    manifest: scope === 'all',
    writeDependencies: !install,
  })
  await applyPlan({
    root: resolved.root,
    plan,
    extraWrites,
    dryRun,
    install,
    packageManager: packageManager.name,
    output,
    label,
  })
  if (!dryRun && scope === 'all') {
    output.detail(`hooks: ${await activateHooks(resolved.root)}`)
  }
}

/**
 * Points Git at the managed hooks through Husky. Skipped in CI (`CI` or
 * `HUSKY=0`) and outside a work tree, so a CI install still runs its checks.
 */
const activateHooks = async (root: string): Promise<string> => {
  if (process.env.CI || process.env.HUSKY === '0') {
    return 'skipped in CI'
  }
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' })
  if (top.status !== 0) {
    return 'skipped; not a Git work tree'
  }
  const owner = foreignHooks(root)
  if (owner) {
    // Never take over another tool's hooks during an install; doctor reports this.
    return `skipped; ${owner}. Move them into .husky/ and unset core.hooksPath, then run toolpath-dev hooks install`
  }
  const { default: husky } = await import('husky')
  const previous = process.cwd()
  process.chdir(top.stdout.trim())
  try {
    const message = husky('.husky')
    if (message !== '') {
      throw new PrerequisiteError(`hooks install: ${message}`)
    }
  } finally {
    process.chdir(previous)
  }
  const hook = join(top.stdout.trim(), '.husky/pre-commit')
  if (!existsSync(hook) || !readFileSync(hook, 'utf8').includes('toolpath-dev hooks pre-commit')) {
    throw new ConfigError(
      'hooks install: .husky/pre-commit does not run `toolpath-dev hooks pre-commit`. Run `toolpath-dev sync` to restore it.',
    )
  }
  return 'pre-commit hook active'
}

/**
 * `hooks install`, which `prepare` runs on every install. It decides to skip
 * before reading the configuration, and needs only the configuration's
 * directory, so an install never fails over a configuration problem (a Docker
 * layer with only package.json, an expired exception); `check` reports those.
 */
export const runHooksInstall = async (
  flags: { config?: string },
  output: Output,
): Promise<void> => {
  if (process.env.CI || process.env.HUSKY === '0') {
    output.line('hooks install: skipped in CI')
    return
  }
  let file: string
  try {
    file = findConfigFile(process.cwd(), flags.config)
  } catch (error) {
    if (flags.config === undefined && error instanceof ConfigError) {
      output.line(`hooks install: skipped; no ${CONFIG_FILE} here`)
      return
    }
    throw error
  }
  output.line(`hooks install: ${await activateHooks(dirname(file))}`)
}

export interface SyncFlags {
  config?: string
  dryRun: boolean
  install: boolean
  packageManager?: PackageManagerName
}

export const runSync = async (
  flags: SyncFlags,
  output: Output,
  scope: DesiredScope = 'all',
): Promise<void> => {
  const config = await loadConfig(findConfigFile(process.cwd(), flags.config))
  await synchronize(
    resolveConfig(config),
    {
      scope,
      dryRun: flags.dryRun,
      install: flags.install,
      output,
      label: scope === 'agents' ? 'agents sync' : 'sync',
    },
    flags.packageManager,
  )
}

/** One `--project-spec name=app,root=apps/app,kind=application,runtime=dom,react=vite-modern,tests=vitest,browser=true`. */
export interface ProjectSpec {
  name: string
  root: string
  kind: ProjectKind
  runtime: ProjectRuntime
  react?: ReactAdapter
  reactMinimum?: ReactMinimumVersion
  tests: 'vitest' | 'jest-expo' | 'none'
  browser: boolean
  noUnitTestsReason?: string
}

export const parseProjectSpec = (text: string): ProjectSpec => {
  const fields = new Map<string, string>()
  for (const part of text.split(',')) {
    const [key, ...value] = part.split('=')
    if (!key || value.length === 0) {
      throw new UsageError(`--project-spec "${text}": "${part}" is not key=value`)
    }
    fields.set(key.trim(), value.join('=').trim())
  }
  const allowed = [
    'name',
    'root',
    'kind',
    'runtime',
    'react',
    'react-minimum',
    'tests',
    'browser',
    'no-unit-tests-reason',
  ]
  const unknown = [...fields.keys()].filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    throw new UsageError(
      `--project-spec "${text}": unknown key ${unknown.join(', ')} (allowed: ${allowed.join(', ')})`,
    )
  }
  const name = fields.get('name')
  if (!name) {
    throw new UsageError(`--project-spec "${text}": name is required`)
  }
  const reactAdapter = fields.get('react')
  const reactMinimum = fields.get('react-minimum')
  const reason = fields.get('no-unit-tests-reason')
  return {
    name,
    root: fields.get('root') ?? '.',
    kind: (fields.get('kind') ?? 'library') as ProjectKind,
    runtime: (fields.get('runtime') ?? 'node') as ProjectRuntime,
    ...(reactAdapter === undefined ? {} : { react: reactAdapter as ReactAdapter }),
    ...(reactMinimum === undefined ? {} : { reactMinimum: reactMinimum as ReactMinimumVersion }),
    tests: (fields.get('tests') ?? 'vitest') as ProjectSpec['tests'],
    browser: fields.get('browser') === 'true',
    ...(reason === undefined ? {} : { noUnitTestsReason: reason }),
  }
}

export interface InitFlags extends SyncFlags {
  specs: Array<ProjectSpec>
  engine?: { contract: string; integrationFiles: Array<string> }
  skillsDir?: string
}

const projectFromSpec = (spec: ProjectSpec): ProjectConfig => {
  const suites: NonNullable<ProjectConfig['suites']> = {}
  if (spec.tests === 'vitest') {
    suites.unit = { runner: 'vitest', config: 'vitest.config.ts' }
  }
  if (spec.tests === 'jest-expo') {
    suites.unit = { runner: 'jest-expo', config: 'jest.config.mjs' }
  }
  if (spec.browser) {
    suites.browser = { runner: 'playwright', config: 'playwright.config.ts' }
  }
  return {
    name: spec.name,
    root: spec.root,
    kind: spec.kind,
    runtime: spec.runtime,
    tsconfig: 'tsconfig.json',
    ...(spec.runtime === 'universal' || spec.runtime === 'native'
      ? { testTsconfig: 'tsconfig.test.json' }
      : {}),
    ...(spec.react === undefined
      ? {}
      : {
          react: {
            adapter: spec.react,
            ...(spec.reactMinimum === undefined ? {} : { minimumVersion: spec.reactMinimum }),
          },
        }),
    ...(Object.keys(suites).length > 0 ? { suites } : {}),
    ...(spec.tests === 'none' ? { noUnitTests: { reason: spec.noUnitTestsReason ?? '' } } : {}),
  }
}

/**
 * `init`: writes `dev.config.mjs` from explicit project facts, the project and
 * runner files that do not exist yet, and every managed integration. Nothing is
 * written until the whole plan validates; existing native configs that differ
 * produce a full diff and stop.
 */
export const runInit = async (flags: InitFlags, output: Output): Promise<void> => {
  const root = process.cwd()
  if (existsSync(join(root, CONFIG_FILE))) {
    throw new UsageError(
      `${CONFIG_FILE} already exists here. Use \`toolpath-dev sync\` to update an initialized repository.`,
    )
  }
  const manifest = readManifest(root)
  if (!manifest) {
    throw new ConfigError(
      `No package.json in ${root}. Create it first: \`npm init -y && npm pkg set type=module\`.`,
    )
  }
  const packageManager = detectPackageManager(root, flags.packageManager)
  if (!packageManager) {
    throw new UsageError(
      'package.json declares no packageManager and there is no lockfile. Pass --package-manager npm|pnpm.',
    )
  }
  if (flags.specs.length === 0) {
    throw new UsageError(
      'Describe at least one project: --name/--kind/--runtime for a single project, or --project-spec for each workspace project.',
    )
  }
  const input: DevConfigInput = {
    schemaVersion: 1,
    root: pathToFileURL(join(root, CONFIG_FILE)).href,
    projects: flags.specs.map(projectFromSpec),
    tooling: { files: TOOLING_FILES, tsconfig: 'tsconfig.tooling.json' },
    ci: { node: toolchain.runtime.node },
    ...(flags.engine ? { engine: flags.engine } : {}),
    ...(flags.skillsDir === undefined ? {} : { agents: { skillsDir: flags.skillsDir } }),
  }
  const issues = [...validateConfigShape(input), ...moduleTypeIssues(root, input.projects)]
  if (issues.length > 0) {
    throw new UsageError('The project description is invalid:', issues)
  }

  const creates: Array<Write> = []
  const createIfMissing = (path: string, content: string): void => {
    if (!existsSync(join(root, path))) {
      creates.push({ path, before: undefined, after: content })
    }
  }
  const { root: _root, ...rest } = input
  createIfMissing(CONFIG_FILE, devConfigModule(rest))
  createIfMissing('tsconfig.tooling.json', toolingTsconfig())
  const conflicts: Array<{ path: string; message: string }> = []
  for (const project of input.projects) {
    const prefix = project.root === '.' ? '' : `${project.root}/`
    createIfMissing(
      `${prefix}tsconfig.json`,
      projectTsconfig(project, { engine: input.engine !== undefined }),
    )
    if (project.testTsconfig !== undefined) {
      createIfMissing(`${prefix}${project.testTsconfig}`, projectTestTsconfig())
    }
    for (const [suite, definition] of Object.entries(project.suites ?? {})) {
      if (definition.runner === 'command') {
        continue
      }
      const path = `${prefix}${definition.config}`
      const factory = {
        vitest: 'createVitestConfig',
        'jest-expo': 'createJestExpoConfig',
        playwright: 'createPlaywrightConfig',
      }[definition.runner]
      if (existsSync(join(root, path))) {
        if (!readFileSync(join(root, path), 'utf8').includes(factory)) {
          conflicts.push({
            path,
            message: `exists and does not call ${factory}; fold its settings into the factory's extension options, then rerun`,
          })
        }
        continue
      }
      const content =
        definition.runner === 'vitest'
          ? vitestConfig(project, suite)
          : definition.runner === 'jest-expo'
            ? jestExpoConfig(project, suite)
            : playwrightConfig(project, suite)
      creates.push({ path, before: undefined, after: content })
    }
    if (project.react) {
      const wiring = ADAPTER_WIRING[project.react.adapter]
      const existing = wiring.configFiles.filter((file) => existsSync(join(root, prefix, file)))
      const template = reactBuildConfig(project)
      if (existing.length === 0 && template) {
        creates.push({
          path: `${prefix}${template.path}`,
          before: undefined,
          after: template.content,
        })
      }
      for (const file of existing) {
        if (!readFileSync(join(root, prefix, file), 'utf8').includes(wiring.specifier)) {
          conflicts.push({
            path: `${prefix}${file}`,
            message: `does not import ${wiring.specifier}, so React Compiler would not run in this build; ${wiring.remedy} (docs/react.md), then rerun`,
          })
        }
      }
      if (project.react.adapter === 'expo') {
        const appJson = `${prefix}app.json`
        const dynamic = ['app.config.js', 'app.config.ts'].find((file) =>
          existsSync(join(root, prefix, file)),
        )
        if (dynamic) {
          if (!readFileSync(join(root, prefix, dynamic), 'utf8').includes('withReactCompiler')) {
            conflicts.push({
              path: `${prefix}${dynamic}`,
              message:
                'must wrap its config with withReactCompiler from @toolpath/dev-config/react/expo',
            })
          }
        } else if (existsSync(join(root, appJson))) {
          const text = readFileSync(join(root, appJson), 'utf8')
          const app = JSON.parse(text) as { expo?: { experiments?: Record<string, unknown> } }
          if (app.expo?.experiments?.reactCompiler !== true) {
            const next = {
              ...app,
              expo: { ...app.expo, experiments: { ...app.expo?.experiments, reactCompiler: true } },
            }
            creates.push({
              path: appJson,
              before: text,
              after: `${JSON.stringify(next, null, 2)}\n`,
            })
          }
        } else {
          conflicts.push({
            path: appJson,
            message:
              'is missing; an Expo project needs its app config to enable experiments.reactCompiler',
          })
        }
      }
    }
  }
  if (conflicts.length > 0) {
    throw new ConfigError(
      'init: nothing was changed; these native configs need merging first:',
      conflicts,
    )
  }

  const planned = new Set(creates.map((write) => join(root, write.path)))
  const config = defineConfig(input)
  const resolved = resolveConfig(config, { planned })
  await synchronize(
    resolved,
    {
      scope: 'all',
      dryRun: flags.dryRun,
      install: flags.install,
      output,
      label: 'init',
      extraWrites: creates,
    },
    packageManager.name,
  )
}
