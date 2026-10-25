import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DevConfig } from '../config/types.js'
import {
  compileModule,
  compilerOptionsFor,
  inspectCompiledOutput,
  selectReactProject,
  type CompilerEvidence,
  type ReactCompilerOptions,
  type ReactProjectSelection,
} from './compiler.js'
import { requireInstalled, resolvePeer } from './peers.js'

export {
  compilerRuntimeModule,
  inspectCompiledOutput,
  type CompilerEvidence,
  type ReactCompilerOptions,
} from './compiler.js'

/**
 * React Compiler for published libraries built with esbuild or tsup. The plugin
 * runs Babel with only the compiler before esbuild lowers TypeScript and JSX, so
 * the shipped JavaScript is compiled while declarations stay with `tsc`.
 */

/** Build-tool-neutral compiler options for one declared library project. */
export const reactLibraryCompilerOptions = (
  config: DevConfig,
  selection: ReactProjectSelection,
): ReactCompilerOptions => {
  const { project } = selectReactProject(config, selection, ['library-esbuild'])
  return compilerOptionsFor(project.react.minimumVersion)
}

type Loader = 'js' | 'jsx' | 'ts' | 'tsx'

/** The esbuild plugin interface this adapter uses, structurally. */
export interface ReactCompilerEsbuildPlugin {
  name: string
  setup: (build: {
    onLoad: (
      options: { filter: RegExp; namespace?: string },
      callback: (args: {
        path: string
        namespace: string
      }) => Promise<{ contents: string; loader: Loader; resolveDir: string } | undefined>,
    ) => void
  }) => void
}

export interface EsbuildPluginOptions extends ReactProjectSelection {
  /**
   * Files the compiler may skip outright, for speed. By default a file is
   * compiled when it can contain a component or hook: a capitalized name,
   * `use…`, `memo` or `forwardRef`, the same filter `@vitejs/plugin-react` uses.
   */
  candidate?: RegExp
}

const SOURCE = /\.[cm]?[jt]sx?$/
const DEFAULT_CANDIDATE = /forwardRef|memo|\b(?:[A-Z]|use[A-Z0-9])/

const loaderFor = (path: string): Loader => {
  if (/\.[cm]?tsx$/.test(path)) {
    return 'tsx'
  }
  if (/\.[cm]?ts$/.test(path)) {
    return 'ts'
  }
  if (/\.[cm]?jsx$/.test(path)) {
    return 'jsx'
  }
  return 'js'
}

/**
 * An esbuild `onLoad` plugin that compiles each project source file with React
 * Compiler first. Babel's source map travels inline into esbuild, which chains
 * it into the bundle's map. Resolution is untouched, so platform files
 * (`.web.tsx`, `.native.tsx`) and `external` packages behave exactly as the
 * build's own options say; dependency code is never compiled.
 *
 * ```js
 * // tsup.config.ts
 * import { defineConfig } from 'tsup'
 * import config from './dev.config.mjs'
 * import { reactCompilerEsbuildPlugin } from '@toolpath/dev-config/react/library'
 *
 * export default defineConfig({
 *   entry: ['src/index.ts'],
 *   format: ['esm'],
 *   external: ['react', 'react/compiler-runtime'],
 *   esbuildPlugins: [reactCompilerEsbuildPlugin(config, { project: 'ui' })],
 * })
 * ```
 */
export const reactCompilerEsbuildPlugin = (
  config: DevConfig,
  options: EsbuildPluginOptions,
): ReactCompilerEsbuildPlugin => {
  const { project } = selectReactProject(config, options, ['library-esbuild'])
  const compiler = compilerOptionsFor(project.react.minimumVersion)
  const directory = project.directory
  const profile = 'React (library-esbuild)'
  // Fail when the plugin is created, not on the first file, if a peer is missing.
  requireInstalled(directory, '@babel/core', profile)
  resolvePeer(directory, 'babel-plugin-react-compiler', profile)
  const candidate = options.candidate ?? DEFAULT_CANDIDATE
  return {
    name: 'toolpath:react-compiler',
    setup: (build) => {
      build.onLoad({ filter: SOURCE, namespace: 'file' }, async (args) => {
        if (/[\\/]node_modules[\\/]/.test(args.path)) {
          return undefined
        }
        const source = await readFile(args.path, 'utf8')
        if (!candidate.test(source)) {
          return undefined
        }
        const compiled = await compileModule(source, {
          filename: args.path,
          directory,
          options: compiler,
          sourceMaps: 'inline',
        })
        return {
          contents: compiled.code,
          loader: loaderFor(args.path),
          resolveDir: dirname(args.path),
        }
      })
    },
  }
}

/**
 * esbuild `resolveExtensions` for one platform build of a library that ships
 * web and native variants: a platform file wins over the shared one.
 */
export const platformResolveExtensions = (
  platform: 'web' | 'native' | 'ios' | 'android',
): Array<string> => {
  const base = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json']
  const prefixes =
    platform === 'web'
      ? ['.web']
      : platform === 'native'
        ? ['.native']
        : [`.${platform}`, '.native']
  return [
    ...prefixes.flatMap((prefix) => base.slice(0, 4).map((extension) => `${prefix}${extension}`)),
    ...base,
  ]
}

/** Evidence that a built artifact contains compiler output (keep the compiler runtime external to see it). */
export const inspectBuiltArtifact = (code: string): CompilerEvidence => inspectCompiledOutput(code)
