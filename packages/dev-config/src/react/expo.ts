import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { DevConfig } from '../config/types.js'
import { CheckFailure, ConfigError } from '../errors.js'
import { toolchain } from '../policy/toolchain.js'
import {
  assertCompiledOutput,
  COMPILER_PACKAGE,
  compilerOptionsFor,
  PROBE_COMPONENT,
  selectReactProject,
  type CompilerEvidence,
  type ReactProjectSelection,
} from './compiler.js'
import { assertMajor, importPeer, requireInstalled } from './peers.js'
import type { BabelPluginEntry } from './vite.js'

/**
 * React Compiler for Expo, the way the SDK ships it: `experiments.reactCompiler`
 * in the app config makes Metro ask `babel-preset-expo` for the compiler, and the
 * preset's `react-compiler` option carries the standard settings. The compiler is
 * never added as a second Babel plugin, which would run it twice.
 */

const PRESET = 'babel-preset-expo'
const TESTED_EXPO_MAJOR = Number.parseInt(toolchain.tested.expo?.split('.')[0] ?? '58', 10)

export interface ExpoBabelOptions extends ReactProjectSelection {
  /** Other `babel-preset-expo` options; `react-compiler` belongs to the adapter. */
  presetOptions?: Record<string, unknown>
  /** Plugins the application needs (for example a worklets plugin, which must come last). */
  plugins?: Array<BabelPluginEntry>
}

export interface ExpoBabelConfig {
  presets: Array<readonly [string, Record<string, unknown>]>
  plugins: Array<BabelPluginEntry>
}

const namesCompiler = (entry: BabelPluginEntry): boolean =>
  (typeof entry === 'string' ? entry : entry[0]).includes(COMPILER_PACKAGE)

/**
 * The project's `babel.config.js` value. Node 24 can `require` this package's ESM
 * build, so a CommonJS Babel config may use it directly:
 *
 * ```js
 * // babel.config.js
 * const { createExpoBabelConfig } = require('@toolpath/dev-config/react/expo')
 * const { default: config } = require('./dev.config.mjs')
 *
 * module.exports = (api) => {
 *   api.cache(true)
 *   return createExpoBabelConfig(config, { project: 'mobile' })
 * }
 * ```
 */
export const createExpoBabelConfig = (
  config: DevConfig,
  options: ExpoBabelOptions,
): ExpoBabelConfig => {
  const { project } = selectReactProject(config, options, ['expo'])
  if (options.presetOptions && 'react-compiler' in options.presetOptions) {
    throw new ConfigError("createExpoBabelConfig owns babel-preset-expo's react-compiler option.")
  }
  const plugins = options.plugins ?? []
  if (plugins.some(namesCompiler)) {
    throw new ConfigError(
      `${COMPILER_PACKAGE} is enabled through babel-preset-expo; listing it as a plugin too would compile every component twice.`,
    )
  }
  return {
    presets: [
      [
        PRESET,
        {
          ...options.presetOptions,
          'react-compiler': { ...compilerOptionsFor(project.react.minimumVersion) },
        },
      ],
    ],
    plugins: [...plugins],
  }
}

/** The app config with React Compiler enabled, for `app.config.(js|ts)`. `app.json` sets the same key. */
export const withReactCompiler = <T extends { experiments?: Record<string, unknown> }>(
  expoConfig: T,
): T & { experiments: Record<string, unknown> & { reactCompiler: true } } => ({
  ...expoConfig,
  experiments: { ...expoConfig.experiments, reactCompiler: true },
})

export interface ExpoVerification {
  projectRoot: string
  /** The Metro platform to transform for. Default `'ios'`. */
  platform?: 'ios' | 'android' | 'web'
}

interface ExpoConfigModule {
  getConfig: (
    projectRoot: string,
    options: Record<string, unknown>,
  ) => { exp: { experiments?: Record<string, unknown> } }
}

interface ConfigItem {
  file?: { request?: string; resolved?: string } | null
}

interface BabelCore {
  transformAsync: (
    code: string,
    options: Record<string, unknown>,
  ) => Promise<{ code?: string | null } | null>
  loadPartialConfigAsync: (
    options: Record<string, unknown>,
  ) => Promise<{ options: { plugins?: Array<ConfigItem>; presets?: Array<ConfigItem> } } | null>
}

/**
 * Proves the Expo app compiles components the way Metro will: the app config
 * enables the experiment, the Babel config does not add the compiler a second
 * time, and a probe component transformed with Metro's caller contract
 * (`supportsReactCompiler`, which Expo derives from the experiment) comes out
 * compiled.
 */
export const verifyExpoReactCompiler = async ({
  projectRoot,
  platform = 'ios',
}: ExpoVerification): Promise<CompilerEvidence> => {
  const expo = requireInstalled(projectRoot, 'expo', 'React (expo)')
  assertMajor(
    expo,
    TESTED_EXPO_MAJOR,
    'expo',
    `This release is tested with Expo SDK ${String(TESTED_EXPO_MAJOR)}.`,
  )
  const fromExpo = createRequire(join(expo.directory, 'package.json'))
  const expoConfig = (await import(pathToFileURL(fromExpo.resolve('@expo/config')).href)) as
    ExpoConfigModule | { default: ExpoConfigModule }
  const getConfig = 'getConfig' in expoConfig ? expoConfig.getConfig : expoConfig.default.getConfig
  const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true, isPublicConfig: false })
  if (exp.experiments?.reactCompiler !== true) {
    throw new CheckFailure(
      `${projectRoot}: the app config does not set experiments.reactCompiler, so Metro never asks babel-preset-expo for the compiler. Set "experiments": { "reactCompiler": true } in app.json (or use withReactCompiler in app.config).`,
    )
  }

  const babelModule = await importPeer<Partial<BabelCore> & { default?: BabelCore }>(
    projectRoot,
    '@babel/core',
    'React (expo)',
  )
  const babel: BabelCore | undefined =
    babelModule.transformAsync && babelModule.loadPartialConfigAsync
      ? (babelModule as BabelCore)
      : babelModule.default
  if (!babel) {
    throw new ConfigError('@babel/core does not export transformAsync.')
  }
  const filename = join(projectRoot, 'toolpath-react-compiler-probe.tsx')
  const caller = {
    name: 'metro',
    bundler: 'metro',
    platform,
    isDev: false,
    isServer: false,
    isNodeModule: false,
    projectRoot,
    supportsReactCompiler: true,
  }
  const partial = await babel.loadPartialConfigAsync({
    filename,
    cwd: projectRoot,
    root: projectRoot,
    caller,
  })
  const direct = (partial?.options.plugins ?? []).filter((item) =>
    `${item.file?.request ?? ''} ${item.file?.resolved ?? ''}`.includes(COMPILER_PACKAGE),
  )
  if (direct.length > 0) {
    throw new CheckFailure(
      `${projectRoot}: the Babel config lists ${COMPILER_PACKAGE} as a plugin while babel-preset-expo also runs it, so every component would compile twice. Remove the plugin and configure it through createExpoBabelConfig.`,
    )
  }
  const result = await babel.transformAsync(PROBE_COMPONENT, {
    filename,
    cwd: projectRoot,
    root: projectRoot,
    sourceType: 'module',
    caller,
  })
  return assertCompiledOutput(
    result?.code ?? '',
    `Babel configuration in ${projectRoot}`,
    'Use babel-preset-expo (createExpoBabelConfig) as the Babel preset.',
  )
}
