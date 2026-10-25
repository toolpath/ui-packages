import type { ESLint, Linter } from 'eslint'
import { BUILT_IN_EXCLUSIONS } from '../config/files.js'
import { resolveConfig, type ResolvedConfig, type ResolvedProject } from '../config/resolve.js'
import type { DevConfig } from '../config/types.js'
import { ConfigError, type Issue } from '../errors.js'
import {
  BROWSER_TEST_PATTERNS,
  NODE_BUILTINS,
  TEST_SUPPORT_PATTERNS,
  UNIT_TEST_PATTERNS,
} from '../policy/conventions.js'
import {
  accessibilityRules,
  commonJsRules,
  engineRules,
  javascriptRules,
  jestRules,
  playwrightRules,
  reactDomRules,
  reactHooksRules,
  reactQualityRules,
  reactResourceRules,
  testingLibraryRules,
  toolpathRules,
  typescriptCheckedCoreRules,
  typescriptRules,
  typescriptSyntaxRules,
  vitestRules,
  type RuleMap,
} from '../policy/rules.js'

export {
  POLICY_GROUPS,
  knownPolicyRules,
  type PolicyGroup,
  type RuleEntry,
  type RuleMap,
} from '../policy/rules.js'

type Config = Linter.Config
type Plugin = ESLint.Plugin

interface RestrictedPath {
  name: string
  importNames?: Array<string>
  message?: string
  allowTypeImports?: boolean
}

interface RestrictedPattern {
  group: Array<string>
  message?: string
  allowTypeImports?: boolean
}

export interface ImportRestriction {
  /** Repository-relative globs the restriction applies to. */
  files: Array<string>
  paths?: Array<RestrictedPath>
  patterns?: Array<RestrictedPattern>
}

export interface EslintOptions {
  /**
   * Additional, stricter configuration for this repository: architectural import
   * rules, extra plugins. It is composed before the shared baseline, so it cannot
   * change a baseline rule; `toolpath-dev lint` also rejects a native config that
   * does.
   */
  extend?: Array<Config>
  /**
   * Repository import boundaries, enforced with core `no-restricted-imports` so
   * they never collide with the baseline's runtime boundaries.
   */
  restrictedImports?: Array<ImportRestriction>
}

const SCRIPT_EXTENSIONS = '{ts,tsx,mts,cts,js,jsx,mjs,cjs}'
const TYPESCRIPT_EXTENSIONS = '{ts,tsx,mts,cts}'

const prefixed = (project: ResolvedProject, pattern: string): string =>
  project.path === '.' ? pattern : `${project.path}/${pattern}`

const projectFiles = (project: ResolvedProject): string =>
  prefixed(project, `**/*.${SCRIPT_EXTENSIONS}`)

/** Nested project roots and tooling globs, which another program owns. */
const ownedElsewhere = (resolved: ResolvedConfig, project: ResolvedProject): Array<string> => [
  ...resolved.projects
    .filter(
      (other) =>
        other !== project &&
        (project.path === '.' ? other.path !== '.' : other.path.startsWith(`${project.path}/`)),
    )
    .map((other) => `${other.path}/**`),
  ...(resolved.tooling?.files ?? []),
]

/** Each pattern restricted to the project: a file must match both (flat config's AND form). */
const within = (project: ResolvedProject, patterns: ReadonlyArray<string>): Array<Array<string>> =>
  patterns.map((pattern) => [projectFiles(project), pattern])

const loadPlugin = async (specifier: string, profile: string): Promise<Plugin> => {
  try {
    const module = (await import(specifier)) as { default?: Plugin }
    return module.default ?? (module as Plugin)
  } catch (error) {
    throw new ConfigError(
      `The ${profile} lint profile could not load ${specifier}, a dependency of @toolpath/dev-config: ${(error as Error).message}. Reinstall dependencies with the repository's package manager.`,
    )
  }
}

const runtimeGlobals = async (
  runtime: ResolvedProject['runtime'],
): Promise<Record<string, 'readonly' | 'writable'>> => {
  const { default: globals } = (await import('globals')) as {
    default: Record<string, Record<string, boolean>>
  }
  const pick = (name: string): Record<string, 'readonly' | 'writable'> =>
    Object.fromEntries(
      Object.entries(globals[name] ?? {}).map(([key, writable]) => [
        key,
        writable ? 'writable' : 'readonly',
      ]),
    )
  switch (runtime) {
    case 'node':
      return pick('node')
    case 'dom':
      return pick('browser')
    case 'native':
      return { ...pick('shared-node-browser'), __DEV__: 'readonly' }
    case 'universal':
      return pick('shared-node-browser')
  }
}

interface RestrictionContext {
  test: boolean
  engineIntegration: boolean
}

/** The baseline's import boundaries for one combination of project, test, and integration scope. */
const baselineRestrictions = (
  resolved: ResolvedConfig,
  project: ResolvedProject,
  { test, engineIntegration }: RestrictionContext,
): { paths: Array<RestrictedPath>; patterns: Array<RestrictedPattern> } => {
  const paths: Array<RestrictedPath> = []
  const patterns: Array<RestrictedPattern> = []
  const runtimeMessage = `This is a '${project.runtime}' project; that module belongs to another platform.`
  if (!test && project.runtime !== 'node') {
    for (const name of NODE_BUILTINS) {
      paths.push({ name, message: runtimeMessage })
    }
  }
  if (project.runtime === 'native' || project.runtime === 'universal') {
    paths.push({ name: 'react-dom', message: runtimeMessage })
    patterns.push({ group: ['react-dom/*'], message: runtimeMessage })
  }
  if (project.runtime === 'dom' || project.runtime === 'universal') {
    paths.push({ name: 'react-native', message: runtimeMessage })
  }
  if (project.react) {
    paths.push({
      name: 'react',
      importNames: ['default'],
      message: "Import the React APIs you use by name, e.g. `import { useState } from 'react'`.",
    })
  }
  if (resolved.engine) {
    patterns.push({
      group: ['@toolpath/api/*'],
      message:
        '@toolpath/api has one public entry point; its internal paths are not part of the SDK contract.',
    })
    if (!engineIntegration && !test) {
      paths.push({
        name: '@toolpath/api',
        allowTypeImports: true,
        message:
          'Construct and call the SDK in a configured Engine integration module (dev.config.mjs engine.integrationFiles). Type-only imports are fine anywhere.',
      })
    }
  }
  return { paths, patterns }
}

const restrictionRule = (
  restrictions: ReturnType<typeof baselineRestrictions>,
): Linter.RuleEntry =>
  restrictions.paths.length === 0 && restrictions.patterns.length === 0
    ? 'off'
    : ['error', { paths: restrictions.paths, patterns: restrictions.patterns }]

const exceptionIssues = (resolved: ResolvedConfig, known: ReadonlySet<string>): Array<Issue> => {
  const issues: Array<Issue> = []
  resolved.exceptions.forEach((exception, index) => {
    if (!known.has(exception.rule)) {
      issues.push({
        path: `exceptions[${index}].rule`,
        message: `"${exception.rule}" is not a rule this configuration's policy enables`,
      })
    }
    for (const glob of exception.files) {
      const broad = resolved.projects.some(
        (project) =>
          glob === `${project.path}/**` ||
          glob === `${project.path}/**/*` ||
          (project.path === '.' && (glob === '**' || glob.startsWith('**/*'))),
      )
      if (broad) {
        issues.push({
          path: `exceptions[${index}].files`,
          message: `"${glob}" covers a whole project; name the files the exception is for`,
        })
      }
    }
  })
  return issues
}

/**
 * The repository's complete ESLint flat config: one typed block per project
 * program, runtime and import boundaries, and the React, test, and Engine
 * profiles the configuration selects. Optional plugins load only for the
 * profiles in use.
 */
export const createEslintConfig = async (
  config: DevConfig,
  options: EslintOptions = {},
): Promise<Array<Config>> => {
  const resolved = resolveConfig(config)
  const { default: tseslint } = await import('typescript-eslint')
  const { plugin: toolpath } = await import('./plugin/index.js')

  const reactProjects = resolved.projects.filter((project) => project.react)
  const hasRunner = (runner: string): boolean =>
    resolved.projects.some((project) => project.suites.some((suite) => suite.runner === runner))

  const plugins: Record<string, Plugin> = {
    '@typescript-eslint': tseslint.plugin,
    toolpath: toolpath as unknown as Plugin,
  }
  const enabled: Array<RuleMap> = [
    javascriptRules,
    typescriptCheckedCoreRules,
    typescriptRules,
    typescriptSyntaxRules,
    commonJsRules,
    toolpathRules,
  ]
  if (reactProjects.length > 0) {
    plugins['react-hooks'] = await loadPlugin('eslint-plugin-react-hooks', 'React')
    plugins['@eslint-react'] = await loadPlugin('@eslint-react/eslint-plugin', 'React')
    enabled.push(reactHooksRules, reactQualityRules, reactResourceRules)
    if (reactProjects.some((project) => project.runtime === 'dom')) {
      plugins['jsx-a11y-x'] = await loadPlugin('eslint-plugin-jsx-a11y-x', 'React DOM')
      enabled.push(reactDomRules, accessibilityRules)
    }
  }
  if (hasRunner('vitest')) {
    plugins.vitest = await loadPlugin('@vitest/eslint-plugin', 'Vitest')
    enabled.push(vitestRules)
    if (reactProjects.some((project) => project.runtime === 'dom')) {
      plugins['testing-library'] = await loadPlugin(
        'eslint-plugin-testing-library',
        'Testing Library',
      )
      enabled.push(testingLibraryRules)
    }
  }
  if (hasRunner('jest-expo')) {
    plugins.jest = await loadPlugin('eslint-plugin-jest', 'Jest Expo')
    enabled.push(jestRules)
  }
  if (hasRunner('playwright')) {
    plugins.playwright = await loadPlugin('eslint-plugin-playwright', 'Playwright')
    enabled.push(playwrightRules)
  }
  let engineOrigins: Array<string> = []
  if (resolved.engine) {
    const engine = await import('../engine/eslint/index.js')
    plugins['toolpath-engine'] = engine.plugin as unknown as Plugin
    engineOrigins = [...(resolved.engine.origins ?? engine.DEFAULT_ENGINE_ORIGINS)]
    enabled.push(engineRules)
  }

  const known = new Set(enabled.flatMap((rules) => Object.keys(rules)))
  known.add('@typescript-eslint/no-restricted-imports')
  const issues = exceptionIssues(resolved, known)
  if (issues.length > 0) {
    throw new ConfigError('dev.config.mjs exceptions are invalid:', issues)
  }

  const configs: Array<Config> = [
    {
      name: 'toolpath/ignores',
      ignores: [...BUILT_IN_EXCLUSIONS, ...resolved.generated.flatMap((entry) => entry.files)],
    },
    {
      name: 'toolpath/linter-options',
      linterOptions: { reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error' },
    },
    ...(options.extend ?? []),
  ]

  const baseRules: Linter.RulesRecord = {
    ...javascriptRules,
    ...typescriptCheckedCoreRules,
    ...typescriptRules,
    ...toolpathRules,
  } as Linter.RulesRecord

  const programBlock = (
    name: string,
    files: Array<string | Array<string>>,
    ignores: Array<string>,
    tsconfig: string,
    tsconfigRootDir: string,
    globals: Record<string, 'readonly' | 'writable'>,
    restrictions: Linter.RuleEntry,
  ): Config => ({
    name,
    files,
    ignores,
    plugins,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: [tsconfig], tsconfigRootDir, ecmaFeatures: { jsx: true } },
      globals,
    },
    rules: { ...baseRules, '@typescript-eslint/no-restricted-imports': restrictions },
  })

  for (const project of resolved.projects) {
    const files = [projectFiles(project)]
    const ignores = ownedElsewhere(resolved, project)
    const globals = await runtimeGlobals(project.runtime)
    const restrictions = (context: RestrictionContext): Linter.RuleEntry =>
      restrictionRule(baselineRestrictions(resolved, project, context))
    configs.push(
      programBlock(
        `toolpath/project/${project.name}`,
        files,
        ignores,
        project.tsconfig,
        project.directory,
        globals,
        restrictions({ test: false, engineIntegration: false }),
      ),
    )
    const testPatterns = [...UNIT_TEST_PATTERNS, ...BROWSER_TEST_PATTERNS, ...TEST_SUPPORT_PATTERNS]
    if (project.testTsconfig !== undefined) {
      configs.push({
        name: `toolpath/project/${project.name}/test-program`,
        files: within(project, testPatterns),
        ignores,
        languageOptions: {
          parserOptions: { project: [project.testTsconfig], tsconfigRootDir: project.directory },
        },
      })
    }
    configs.push({
      name: `toolpath/project/${project.name}/tests`,
      files: within(project, testPatterns),
      ignores,
      rules: {
        '@typescript-eslint/no-restricted-imports': restrictions({
          test: true,
          engineIntegration: false,
        }),
      },
    })
    if (resolved.engine) {
      const integration = [
        ...resolved.engine.integrationFiles,
        ...(resolved.engine.compatibilityFiles ?? []).flatMap((entry) => entry.files),
      ]
      configs.push({
        name: `toolpath/project/${project.name}/engine`,
        files: [projectFiles(project)],
        ignores: [...ignores, ...integration],
        rules: { 'toolpath-engine/no-direct-engine-http': ['error', { origins: engineOrigins }] },
      })
      configs.push({
        name: `toolpath/project/${project.name}/engine-integration`,
        files: within(project, integration),
        ignores,
        rules: {
          '@typescript-eslint/no-restricted-imports': restrictions({
            test: false,
            engineIntegration: true,
          }),
        },
      })
    }

    if (project.react) {
      configs.push({
        name: `toolpath/project/${project.name}/react`,
        files,
        ignores,
        rules: {
          ...reactHooksRules,
          ...reactQualityRules,
          ...reactResourceRules,
        } as Linter.RulesRecord,
      })
      if (project.runtime === 'dom') {
        configs.push({
          name: `toolpath/project/${project.name}/react-dom`,
          files,
          ignores,
          rules: { ...reactDomRules, ...accessibilityRules } as Linter.RulesRecord,
        })
      }
    }

    const runners = new Set(project.suites.map((suite) => suite.runner))
    if (runners.has('vitest')) {
      configs.push({
        name: `toolpath/project/${project.name}/vitest`,
        files: within(project, [...UNIT_TEST_PATTERNS, ...TEST_SUPPORT_PATTERNS]),
        ignores,
        rules: {
          ...vitestRules,
          ...(project.react && project.runtime === 'dom' ? testingLibraryRules : {}),
        } as Linter.RulesRecord,
      })
    }
    if (runners.has('jest-expo')) {
      configs.push({
        name: `toolpath/project/${project.name}/jest-expo`,
        files: within(project, [...UNIT_TEST_PATTERNS, ...TEST_SUPPORT_PATTERNS]),
        ignores,
        rules: jestRules as Linter.RulesRecord,
      })
    }
    if (runners.has('playwright')) {
      configs.push({
        name: `toolpath/project/${project.name}/playwright`,
        files: within(project, BROWSER_TEST_PATTERNS),
        ignores,
        rules: playwrightRules as Linter.RulesRecord,
      })
    }
  }

  if (resolved.tooling) {
    configs.push(
      programBlock(
        'toolpath/tooling',
        resolved.tooling.files,
        [],
        resolved.tooling.tsconfig,
        resolved.root,
        await runtimeGlobals('node'),
        'off',
      ),
    )
  }

  configs.push(
    {
      name: 'toolpath/typescript-syntax',
      files: [`**/*.${TYPESCRIPT_EXTENSIONS}`],
      plugins,
      rules: typescriptSyntaxRules as Linter.RulesRecord,
    },
    {
      name: 'toolpath/commonjs',
      files: ['**/*.{cjs,cts}'],
      plugins,
      rules: commonJsRules as Linter.RulesRecord,
    },
  )

  for (const restriction of options.restrictedImports ?? []) {
    configs.push({
      name: 'toolpath/repository-import-boundaries',
      files: restriction.files,
      rules: {
        'no-restricted-imports': [
          'error',
          { paths: restriction.paths ?? [], patterns: restriction.patterns ?? [] },
        ],
      },
    })
  }

  resolved.exceptions.forEach((exception, index) => {
    configs.push({
      name: `toolpath/exception/${index}`,
      files: exception.files,
      rules: { [exception.rule]: 'off' },
    })
  })

  return configs
}
