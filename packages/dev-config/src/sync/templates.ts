import type { DevConfigInput, ProjectConfig, ProjectRuntime } from '../config/types.js'
import type { PackageManagerName } from '../config/packages.js'

/** Native files stay small: they import the shared factories and add nothing that weakens them. */
export const ESLINT_CONFIG = `import config from './dev.config.mjs'
import { createEslintConfig } from '@toolpath/dev-config/eslint'

export default await createEslintConfig(config)
`

export const PRETTIER_CONFIG = `export { default } from '@toolpath/dev-config/prettier'
`

const exec = (packageManager: PackageManagerName): string =>
  packageManager === 'pnpm' ? 'pnpm exec' : 'npx --no --'

/** The managed `.husky/pre-commit` block. */
export const preCommitBlock = (packageManager: PackageManagerName): string =>
  `${exec(packageManager)} toolpath-dev hooks pre-commit\n`

export const MANAGED_SCRIPTS: Readonly<Record<string, string>> = {
  lint: 'toolpath-dev lint',
  'lint:fix': 'toolpath-dev lint:fix',
  'check-types': 'toolpath-dev check-types',
  test: 'toolpath-dev test',
  'test:watch': 'toolpath-dev test --watch',
  check: 'toolpath-dev check',
  prepare: 'toolpath-dev hooks install',
}

const PRESET_FOR_RUNTIME: Record<ProjectRuntime, string> = {
  node: 'node',
  dom: 'browser',
  native: 'browser',
  universal: 'library',
}

/** TypeScript `exclude` patterns for test files, which a separate test program owns. */
const TEST_EXCLUDES = ['test', 'spec', 'test-utils'].flatMap((kind) =>
  ['ts', 'tsx', 'mts', 'cts'].map((extension) => `**/*.${kind}.${extension}`),
)

/** Runtimes whose source program has no timers or test-runner types, so tests get their own. */
const needsTestProgram = (project: ProjectConfig): boolean =>
  project.runtime === 'universal' || project.runtime === 'native'

/**
 * A project's check program: the runtime's preset, its source and tests. Native
 * projects use bundler resolution without the DOM library; React Native ships
 * its own global types. Universal and native projects check tests in
 * `tsconfig.test.json`, so runner and Node types never reach the source program.
 */
export const projectTsconfig = (
  project: ProjectConfig,
  { engine = false }: { engine?: boolean } = {},
): string => {
  const preset =
    project.kind === 'library' && project.runtime === 'universal'
      ? 'library'
      : PRESET_FOR_RUNTIME[project.runtime]
  const compilerOptions =
    project.runtime === 'native'
      ? { lib: ['ES2023'], types: [] }
      : project.runtime === 'node'
        ? // The Engine SDK's generated fetch runtime declares its types with the DOM library's.
          { types: ['node'], ...(engine ? { lib: ['ES2023', 'DOM', 'DOM.Iterable'] } : {}) }
        : {}
  const separate = needsTestProgram(project)
  return `${JSON.stringify(
    {
      extends: `@toolpath/dev-config/typescript/${preset}.json`,
      ...(Object.keys(compilerOptions).length > 0 ? { compilerOptions } : {}),
      include: separate ? ['src'] : ['src', 'tests'],
      ...(separate ? { exclude: [...TEST_EXCLUDES, '**/__tests__/**', '**/test-utils/**'] } : {}),
    },
    null,
    2,
  )}\n`
}

/** The test program for a project with a separate one: the source settings plus Node's types. */
export const projectTestTsconfig = (): string =>
  `${JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: { types: ['node'] },
      include: ['src', 'tests'],
      exclude: [],
    },
    null,
    2,
  )}\n`

/** Maintained configuration and scripts, checked as JavaScript or TypeScript with Node types. */
export const TOOLING_FILES = [
  'dev.config.mjs',
  '*.config.{js,mjs,cjs,ts,mts,cts}',
  '**/*.config.{js,mjs,cjs,ts,mts,cts}',
  'scripts/**/*.{js,mjs,cjs,ts,mts,cts}',
]

/** TypeScript's `include` has no brace expansion, so `a.{js,ts}` becomes `a.js`, `a.ts`. */
const expandBraces = (pattern: string): Array<string> => {
  const match = /\{([^{}]*)\}/.exec(pattern)
  if (!match) {
    return [pattern]
  }
  const [whole, alternatives = ''] = match
  return alternatives
    .split(',')
    .flatMap((alternative) => expandBraces(pattern.replace(whole, alternative)))
}

export const toolingTsconfig = (): string =>
  `${JSON.stringify(
    {
      extends: '@toolpath/dev-config/typescript/node.json',
      compilerOptions: { allowJs: true, checkJs: true },
      include: TOOLING_FILES.flatMap(expandBraces),
      exclude: ['**/node_modules', '**/dist'],
    },
    null,
    2,
  )}\n`

const relativeConfigImport = (root: string): string => {
  // `./packages/core/` and `packages/core` are the same directory.
  const depth = root.split('/').filter((segment) => segment !== '' && segment !== '.').length
  return depth === 0 ? './dev.config.mjs' : `${'../'.repeat(depth)}dev.config.mjs`
}

export const vitestConfig = (project: ProjectConfig, suite: string): string =>
  `import config from '${relativeConfigImport(project.root)}'
import { createVitestConfig } from '@toolpath/dev-config/vitest'

export default createVitestConfig(config, { project: '${project.name}', suite: '${suite}' })
`

export const jestExpoConfig = (project: ProjectConfig, suite: string): string =>
  `import config from '${relativeConfigImport(project.root)}'
import { createJestExpoConfig } from '@toolpath/dev-config/jest-expo'

export default createJestExpoConfig(config, { project: '${project.name}', suite: '${suite}' })
`

export const playwrightConfig = (project: ProjectConfig, suite: string): string =>
  `import config from '${relativeConfigImport(project.root)}'
import { createPlaywrightConfig } from '@toolpath/dev-config/playwright'

export default createPlaywrightConfig(config, { project: '${project.name}', suite: '${suite}' })
`

/**
 * The native build config `init` writes for a React project that has none, so
 * the compiler runs in the real build from the first commit. Libraries choose
 * their own entries and formats, so `library-esbuild` gets no template; `doctor`
 * and `react verify` name the plugin to add.
 */
export const reactBuildConfig = (
  project: ProjectConfig,
): { path: string; content: string } | undefined => {
  const configImport = relativeConfigImport(project.root)
  switch (project.react?.adapter) {
    case 'vite-legacy':
    case 'vite-modern':
      return {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import config from '${configImport}'
import { createReactPlugins } from '@toolpath/dev-config/react/vite'

export default defineConfig({
  plugins: [...(await createReactPlugins(config, { project: '${project.name}' }))],
})
`,
      }
    case 'react-router':
      return {
        path: 'vite.config.ts',
        content: `import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import config from '${configImport}'
import { createReactRouterCompilerPlugin } from '@toolpath/dev-config/react/babel'

export default defineConfig({
  plugins: [reactRouter(), await createReactRouterCompilerPlugin(config, { project: '${project.name}' })],
})
`,
      }
    case 'babel':
      return {
        path: 'babel.config.mjs',
        content: `import config from '${configImport}'
import { createBabelConfig } from '@toolpath/dev-config/react/babel'

export default createBabelConfig(config, {
  project: '${project.name}',
  presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
})
`,
      }
    case 'expo':
      return {
        path: 'babel.config.js',
        content: `const { createExpoBabelConfig } = require('@toolpath/dev-config/react/expo')
const { default: config } = require('${configImport}')

module.exports = (api) => {
  api.cache(true)
  return createExpoBabelConfig(config, { project: '${project.name}' })
}
`,
      }
    case 'library-esbuild':
    case undefined:
      return undefined
  }
}

const literal = (value: unknown, indent: string): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
    if (value.every((item) => typeof item !== 'object' || item === null)) {
      return `[${value.map((item) => literal(item, indent)).join(', ')}]`
    }
    return `[\n${value.map((item) => `${indent}  ${literal(item, `${indent}  `)},`).join('\n')}\n${indent}]`
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)
    if (entries.length === 0) {
      return '{}'
    }
    return `{\n${entries
      .map(
        ([key, entry]) =>
          `${indent}  ${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${literal(entry, `${indent}  `)},`,
      )
      .join('\n')}\n${indent}}`
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }
  return String(value)
}

/** A readable `dev.config.mjs` for an initialized repository: project facts only. */
export const devConfigModule = (config: Omit<DevConfigInput, 'root'>): string => {
  const { schemaVersion, ...rest } = config
  const body = literal({ schemaVersion, root: '__ROOT__', ...rest }, '')
  return `import { defineConfig } from '@toolpath/dev-config'

export default defineConfig(${body.replace("'__ROOT__'", 'import.meta.url')})
`
}
