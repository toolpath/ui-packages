import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DevConfig } from '../config/types.js'
import { ConfigError } from '../errors.js'
import {
  assertCompiledOutput,
  COMPILER_PACKAGE,
  compilerOptionsFor,
  PROBE_COMPONENT,
  selectReactProject,
  type CompilerEvidence,
  type ReactCompilerOptions,
  type ReactProjectSelection,
} from './compiler.js'
import { importPeer, resolvePeer } from './peers.js'
import type { BabelPluginEntry, ReactVitePlugin } from './vite.js'

/**
 * React Compiler for Babel pipelines: a conventional `babel.config.*`, and the
 * React Router adapter, which runs Babel inside Vite through `vite-plugin-babel`
 * because React Router's Vite plugin does not run one itself.
 */

export type { BabelPluginEntry } from './vite.js'

export interface ReactCompilerBabelConfig {
  plugins: Array<BabelPluginEntry>
  presets: Array<string | readonly [string, Record<string, unknown>]>
}

export interface BabelConfigOptions extends ReactProjectSelection {
  /** Plugins the application needs; they run after the compiler. */
  plugins?: Array<BabelPluginEntry>
  /** Presets the application needs (TypeScript, JSX, environment). Babel runs presets after plugins. */
  presets?: Array<string | readonly [string, Record<string, unknown>]>
}

/** The compiler as one Babel plugin entry, resolved from the project, with the standard options. */
export const createReactCompilerBabelPlugin = (
  config: DevConfig,
  selection: ReactProjectSelection,
): readonly [string, ReactCompilerOptions] => {
  const { project } = selectReactProject(config, selection, ['babel', 'react-router'])
  return [
    resolvePeer(project.directory, COMPILER_PACKAGE, `React (${project.react.adapter})`),
    compilerOptionsFor(project.react.minimumVersion),
  ]
}

/**
 * A `babel.config.*` value with the compiler first. Babel runs plugins before
 * presets and plugins in order, so the compiler sees the source before any
 * other transform.
 *
 * ```js
 * // babel.config.mjs
 * import config from './dev.config.mjs'
 * import { createBabelConfig } from '@toolpath/dev-config/react/babel'
 *
 * export default createBabelConfig(config, { project: 'web', presets: ['@babel/preset-typescript'] })
 * ```
 */
export const createBabelConfig = (
  config: DevConfig,
  options: BabelConfigOptions,
): ReactCompilerBabelConfig => {
  const compiler = createReactCompilerBabelPlugin(config, options)
  return { plugins: [compiler, ...(options.plugins ?? [])], presets: [...(options.presets ?? [])] }
}

export interface ReactRouterOptions extends ReactProjectSelection {
  /** Plugins the application needs; they run after the compiler. */
  babelPlugins?: Array<BabelPluginEntry>
}

type ViteBabel = (options: Record<string, unknown>) => ReactVitePlugin

/**
 * The React Router build's compiler plugin: `vite-plugin-babel` with the
 * compiler first and `@babel/preset-typescript`, as React's installation guide
 * documents. `include` names `.ts`/`.tsx` explicitly; since vite-plugin-babel
 * 1.7 its default covers only `.js`/`.jsx`, and a `filter` alone would narrow
 * that further rather than widen it.
 *
 * ```js
 * // vite.config.ts
 * import { reactRouter } from '@react-router/dev/vite'
 * import config from './dev.config.mjs'
 * import { createReactRouterCompilerPlugin } from '@toolpath/dev-config/react/babel'
 *
 * export default defineConfig({
 *   plugins: [reactRouter(), await createReactRouterCompilerPlugin(config, { project: 'app' })],
 * })
 * ```
 */
export const createReactRouterCompilerPlugin = async (
  config: DevConfig,
  options: ReactRouterOptions,
): Promise<ReactVitePlugin> => {
  const { project } = selectReactProject(config, options, ['react-router'])
  const directory = project.directory
  const profile = 'React (react-router)'
  const compiler = resolvePeer(directory, COMPILER_PACKAGE, profile)
  const typescript = resolvePeer(directory, '@babel/preset-typescript', profile)
  await importPeer<unknown>(directory, '@babel/core', profile)
  const { default: babel } = await importPeer<{ default: ViteBabel }>(
    directory,
    'vite-plugin-babel',
    profile,
  )
  return babel({
    include: /\.[cm]?[jt]sx?$/,
    exclude: /[\\/]node_modules[\\/]/,
    babelConfig: {
      babelrc: false,
      configFile: false,
      cwd: directory,
      presets: [typescript],
      plugins: [
        [compiler, compilerOptionsFor(project.react.minimumVersion)],
        ...(options.babelPlugins ?? []),
      ],
    },
  })
}

interface BabelCore {
  transformAsync: (
    code: string,
    options: Record<string, unknown>,
  ) => Promise<{ code?: string | null } | null>
}

export interface BabelVerification {
  /** The directory whose Babel configuration (`babel.config.*` or `.babelrc*`) is checked. */
  root: string
  /** Extra Babel caller metadata, for presets that depend on their caller. */
  caller?: Record<string, unknown>
}

const BABEL_CONFIG_FILES = [
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
  'babel.config.cts',
  'babel.config.json',
  '.babelrc',
  '.babelrc.js',
  '.babelrc.cjs',
  '.babelrc.mjs',
  '.babelrc.json',
]

/**
 * Proves a project's own Babel configuration compiles components: transforms a
 * probe component with the configuration Babel loads for that directory and
 * checks the output for compiler memo caches.
 */
export const verifyBabelReactCompiler = async ({
  root,
  caller,
}: BabelVerification): Promise<CompilerEvidence> => {
  if (!BABEL_CONFIG_FILES.some((file) => existsSync(join(root, file)))) {
    throw new ConfigError(
      `${root} has no Babel configuration file; create one from createBabelConfig.`,
    )
  }
  const babel = await importPeer<{ default?: BabelCore } & Partial<BabelCore>>(
    root,
    '@babel/core',
    'React (babel)',
  )
  const transformAsync = babel.transformAsync ?? babel.default?.transformAsync
  if (!transformAsync) {
    throw new ConfigError('@babel/core does not export transformAsync.')
  }
  const filename = join(root, 'toolpath-react-compiler-probe.tsx')
  const result = await transformAsync(PROBE_COMPONENT, {
    filename,
    cwd: root,
    root,
    sourceType: 'module',
    // The probe is TSX; a configuration without a TypeScript preset still parses it.
    parserOpts: { plugins: ['jsx', 'typescript'] },
    caller: { name: '@toolpath/dev-config', supportsStaticESM: true, ...caller },
  })
  return assertCompiledOutput(
    result?.code ?? '',
    `Babel configuration in ${root}`,
    'Put createReactCompilerBabelPlugin first in its plugins, or export createBabelConfig.',
  )
}
