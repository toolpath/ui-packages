import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { ViteUserConfig } from 'vitest/config'
import { BUILT_IN_EXCLUSIONS } from '../config/files.js'
import type { DevConfig } from '../config/types.js'
import { ConfigError } from '../errors.js'
import {
  BROWSER_TEST_PATTERNS,
  DEFAULT_HOOK_TIMEOUT_MS,
  DEFAULT_UNIT_TIMEOUT_MS,
  UNIT_TEST_PATTERNS,
  unitWorkerCeiling,
} from '../policy/conventions.js'
import { nestedRoots, selectSuite, type SuiteSelection } from './select.js'

export { DEFAULT_HOOK_TIMEOUT_MS, DEFAULT_UNIT_TIMEOUT_MS } from '../policy/conventions.js'

/** The parts of a Vitest config an application may add to; everything else is policy. */
export interface VitestExtension {
  /** Project-relative or absolute setup files, run after the shared lifecycle setup. */
  setupFiles?: Array<string>
  /** Module aliases, as Vite's `resolve.alias`. */
  alias?: Record<string, string>
  /** Vite plugins the code under test needs to transform (for example a framework plugin). */
  plugins?: NonNullable<ViteUserConfig['plugins']>
  /** Compile-time constants, as Vite's `define`. */
  define?: Record<string, string>
  /** Longer bounds for a suite whose tests legitimately need them, in milliseconds. */
  timeouts?: { test?: number; hook?: number }
  /** `environmentOptions` for the runtime's environment (jsdom URL, for example). */
  environmentOptions?: NonNullable<ViteUserConfig['test']>['environmentOptions']
}

export interface VitestOptions extends SuiteSelection {
  extend?: VitestExtension
}

const setupFile = (name: string): string =>
  fileURLToPath(new URL(`./setup/${name}`, import.meta.url))

/**
 * A complete Vitest config for one declared suite: the runtime's environment,
 * explicit test imports, mock and timer lifecycle, bounded workers, one-shot runs,
 * no retries, and failure-first output. Coverage is not part of the standard.
 */
export const createVitestConfig = (config: DevConfig, options: VitestOptions): ViteUserConfig => {
  const { resolved, project, suite } = selectSuite(config, options, 'vitest')
  if (project.runtime === 'native') {
    throw new ConfigError(`${suite.id}: native projects test with jest-expo, not Vitest.`)
  }
  const extend = options.extend ?? {}
  const dom = project.runtime === 'dom'
  const testTimeout = Math.max(
    DEFAULT_UNIT_TIMEOUT_MS,
    extend.timeouts?.test ?? DEFAULT_UNIT_TIMEOUT_MS,
  )
  const hookTimeout = Math.max(
    DEFAULT_HOOK_TIMEOUT_MS,
    extend.timeouts?.hook ?? DEFAULT_HOOK_TIMEOUT_MS,
  )
  const report = process.env.TOOLPATH_DEV_REPORT

  return {
    root: project.directory,
    ...(extend.plugins ? { plugins: extend.plugins } : {}),
    ...(extend.define ? { define: extend.define } : {}),
    ...(extend.alias ? { resolve: { alias: extend.alias } } : {}),
    test: {
      name: suite.id,
      include: [...UNIT_TEST_PATTERNS],
      exclude: [
        ...BUILT_IN_EXCLUSIONS,
        ...BROWSER_TEST_PATTERNS,
        ...nestedRoots(resolved, project).map((root) => `${root}/**`),
      ],
      environment: dom ? 'jsdom' : 'node',
      ...(extend.environmentOptions ? { environmentOptions: extend.environmentOptions } : {}),
      globals: false,
      setupFiles: [
        setupFile(dom ? 'vitest-dom.js' : 'vitest-node.js'),
        ...(extend.setupFiles ?? []),
      ],
      clearMocks: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      testTimeout,
      hookTimeout,
      retry: 0,
      passWithNoTests: false,
      allowOnly: false,
      watch: false,
      maxWorkers: unitWorkerCeiling(availableParallelism()),
      reporters: report ? ['minimal', ['json', { outputFile: report }]] : ['minimal'],
    },
  }
}
