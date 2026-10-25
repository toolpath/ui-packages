import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  type ReactProjectSelection,
} from './compiler.js'
import { assertMajor, importPeer, requireInstalled, resolvePeer } from './peers.js'

/**
 * Vite integration of React Compiler. The adapter is the one `dev.config.mjs`
 * declares, never guessed from a user's Vite config:
 *
 * - `vite-legacy`: `@vitejs/plugin-react` before 6, with the compiler first in its
 *   Babel plugins (named by package so the plugin also drops it for SSR and
 *   pre-bundles the compiler runtime).
 * - `vite-modern`: `@vitejs/plugin-react` 6 and later, which no longer runs Babel;
 *   the compiler runs through `@rolldown/plugin-babel` with the plugin's own
 *   `reactCompilerPreset`, as its documentation orders them.
 */

/** A Vite plugin, structurally; assignable to Vite's own `Plugin` type. */
export interface ReactVitePlugin {
  name: string
}

/** A Babel plugin entry: a module name or path, optionally with options. */
export type BabelPluginEntry = string | readonly [string, Record<string, unknown>]

export interface ReactViteOptions extends ReactProjectSelection {
  /**
   * `@vitejs/plugin-react` options other than the compiler and Babel wiring,
   * which the adapter owns (for example `jsxImportSource` or `include`).
   */
  react?: Record<string, unknown>
  /**
   * Further Babel plugins the application needs. They run after the compiler,
   * so it always sees the code as written.
   */
  babelPlugins?: Array<BabelPluginEntry>
}

const OWNED_REACT_OPTIONS = ['babel', 'compiler']

type ViteReactFactory = (options?: Record<string, unknown>) => Array<ReactVitePlugin>
interface ViteReactModule {
  default: ViteReactFactory
  reactCompilerPreset?: (options: Record<string, unknown>) => unknown
}
// `@rolldown/plugin-babel` resolves its options asynchronously, so its factory returns a promise.
type RolldownBabel = (options: Record<string, unknown>) => Promise<ReactVitePlugin>

const checkReactOptions = (
  options: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const owned = Object.keys(options ?? {}).filter((key) => OWNED_REACT_OPTIONS.includes(key))
  if (owned.length > 0) {
    throw new ConfigError(
      `createReactPlugins owns @vitejs/plugin-react's ${owned.join(' and ')} option${owned.length === 1 ? '' : 's'}; pass extra Babel plugins as babelPlugins.`,
    )
  }
  return options ?? {}
}

/**
 * The React plugins for a Vite build: `@vitejs/plugin-react` with React Compiler
 * wired the way the declared adapter's plugin version requires.
 *
 * ```js
 * // vite.config.ts
 * import { defineConfig } from 'vite'
 * import config from '../../dev.config.mjs'
 * import { createReactPlugins } from '@toolpath/dev-config/react/vite'
 *
 * export default defineConfig({ plugins: [...(await createReactPlugins(config, { project: 'app' }))] })
 * ```
 */
export const createReactPlugins = async (
  config: DevConfig,
  options: ReactViteOptions,
): Promise<Array<ReactVitePlugin>> => {
  const { project } = selectReactProject(config, options, ['vite-legacy', 'vite-modern'])
  const directory = project.directory
  const adapter = project.react.adapter
  const compiler = compilerOptionsFor(project.react.minimumVersion)
  const reactOptions = checkReactOptions(options.react)
  const extraPlugins = options.babelPlugins ?? []
  resolvePeer(directory, COMPILER_PACKAGE, `React (${adapter})`)

  const installed = requireInstalled(directory, '@vitejs/plugin-react', `React (${adapter})`)
  if (adapter === 'vite-legacy') {
    assertMajor(
      installed,
      5,
      adapter,
      "Declare react.adapter: 'vite-modern' for plugin-react 6 and later.",
    )
    await importPeer<unknown>(directory, '@babel/core', `React (${adapter})`)
    const { default: react } = await importPeer<ViteReactModule>(
      directory,
      '@vitejs/plugin-react',
      `React (${adapter})`,
    )
    return react({
      ...reactOptions,
      babel: {
        // Plugin names resolve from the project, wherever Vite was started.
        cwd: directory,
        plugins: [[COMPILER_PACKAGE, { ...compiler }], ...extraPlugins],
      },
    })
  }

  assertMajor(installed, 6, adapter, "Declare react.adapter: 'vite-legacy' for plugin-react 5.")
  const reactModule = await importPeer<ViteReactModule>(
    directory,
    '@vitejs/plugin-react',
    `React (${adapter})`,
  )
  const { reactCompilerPreset } = reactModule
  if (!reactCompilerPreset) {
    throw new ConfigError(
      `@vitejs/plugin-react ${installed.version} does not export reactCompilerPreset.`,
    )
  }
  const { default: babel } = await importPeer<{ default: RolldownBabel }>(
    directory,
    '@rolldown/plugin-babel',
    `React (${adapter})`,
  )
  // A separate Babel pass after the compiler's, so application plugins never run before it.
  return [
    ...reactModule.default(reactOptions),
    await babel({ presets: [reactCompilerPreset({ ...compiler })] }),
    ...(extraPlugins.length > 0 ? [await babel({ plugins: extraPlugins })] : []),
  ]
}

export interface ViteVerification {
  /** The project root Vite resolves its config from. */
  root: string
  /** A specific config file, when it is not the default `vite.config.*`. */
  configFile?: string
}

interface ViteDevServer {
  environments: Record<
    string,
    { transformRequest: (url: string) => Promise<{ code: string } | null> }
  >
  close: () => Promise<void>
}
interface ViteModule {
  createServer: (config: Record<string, unknown>) => Promise<ViteDevServer>
}

const PROBE_ID = '/toolpath-react-compiler-probe.tsx'

/**
 * Proves a project's real Vite config compiles components with React Compiler:
 * starts Vite in middleware mode with the project's own config, transforms a
 * probe component through the client pipeline, and checks the output. It
 * catches an installed compiler that the config never wires in.
 */
export const verifyViteReactCompiler = async ({
  root,
  configFile,
}: ViteVerification): Promise<CompilerEvidence> => {
  const vite = await importPeer<ViteModule>(root, 'vite', 'React (Vite)')
  const cacheDir = mkdtempSync(join(tmpdir(), 'toolpath-vite-'))
  const probe = {
    name: 'toolpath:react-compiler-probe',
    enforce: 'pre',
    resolveId: (id: string) => (id === PROBE_ID ? join(root, PROBE_ID) : undefined),
    load: (id: string) => (id === join(root, PROBE_ID) ? PROBE_COMPONENT : undefined),
  }
  const server = await vite.createServer({
    root,
    ...(configFile === undefined ? {} : { configFile }),
    cacheDir,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [probe],
  })
  try {
    const client = server.environments.client
    if (!client) {
      throw new ConfigError('Vite reported no client environment for this project.')
    }
    const result = await client.transformRequest(PROBE_ID)
    return assertCompiledOutput(
      result?.code ?? '',
      configFile ?? join(root, 'vite.config.*'),
      'Add the plugins from createReactPlugins (or the React Router adapter) to its plugins.',
    )
  } finally {
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
}
