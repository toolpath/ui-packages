import { join } from 'node:path'
import type { PlaywrightTestConfig } from '@playwright/test'
import { BUILT_IN_EXCLUSIONS } from '../config/files.js'
import type { DevConfig } from '../config/types.js'
import { ConfigError } from '../errors.js'
import {
  BROWSER_TEST_PATTERNS,
  DEFAULT_BROWSER_TIMEOUT_MS,
  DEFAULT_EXPECT_TIMEOUT_MS,
  browserWorkers,
} from '../policy/conventions.js'
import { nestedRoots, selectSuite, type SuiteSelection } from './select.js'

export { DEFAULT_BROWSER_TIMEOUT_MS, DEFAULT_EXPECT_TIMEOUT_MS } from '../policy/conventions.js'

/** A server the suite needs, with an explicit readiness contract. */
export interface ManagedWebServer {
  /** The command Playwright starts (through a shell), for example `npm run preview -- --port 4173`. */
  command: string
  /** The URL that answers once the server is ready; tests use it as their base URL unless `baseURL` is set. */
  url: string
  /** Project-relative working directory. Default: the project root. */
  cwd?: string
  /** Startup bound in milliseconds. Default 60 000. */
  timeoutMs?: number
  /**
   * Reuse a developer's already-running server at `url` instead of starting one.
   * Off by default; never honoured in CI, which always starts its own instance.
   */
  reuseLocalServer?: boolean
  env?: Record<string, string>
}

export interface PlaywrightExtension {
  /** Test options other than the artifact and headless policy (for example `locale`, `viewport`, `storageState`). */
  use?: Omit<
    NonNullable<PlaywrightTestConfig['use']>,
    'headless' | 'screenshot' | 'trace' | 'video' | 'baseURL'
  >
  globalSetup?: string
  globalTeardown?: string
  /** Longer bounds for suites that legitimately need them, in milliseconds. */
  timeouts?: { test?: number; expect?: number }
}

export interface PlaywrightOptions extends SuiteSelection {
  /** The application's URL when it is not the managed server's. */
  baseURL?: string
  webServer?: ManagedWebServer | Array<ManagedWebServer>
  extend?: PlaywrightExtension
}

const OWNED_USE_KEYS = ['headless', 'screenshot', 'trace', 'video', 'baseURL']

/**
 * A complete Playwright config for one declared browser/API suite: explicit test
 * files (`*.spec.*`), headless browsers, zero retries, bounded timeouts and
 * workers, and failure-first artifacts (screenshots and traces kept only for
 * failures, no video). When `toolpath-dev` runs the suite it also writes the
 * JSON report that proves which tests ran.
 */
export const createPlaywrightConfig = (
  config: DevConfig,
  options: PlaywrightOptions,
): PlaywrightTestConfig => {
  const { resolved, project, suite } = selectSuite(config, options, 'playwright')
  const extend = options.extend ?? {}
  const owned = Object.keys(extend.use ?? {}).filter((key) => OWNED_USE_KEYS.includes(key))
  if (owned.length > 0) {
    throw new ConfigError(
      `${suite.id}: extend.use cannot set ${owned.join(', ')}; the standard owns them.`,
    )
  }
  const servers = options.webServer === undefined ? [] : [options.webServer].flat()
  const baseURL = options.baseURL ?? servers[0]?.url
  const ci = Boolean(process.env.CI)
  const report = process.env.TOOLPATH_DEV_REPORT
  const outputDir = join(project.directory, 'test-results', suite.name)

  return {
    testDir: project.directory,
    testMatch: [...BROWSER_TEST_PATTERNS],
    testIgnore: [
      ...BUILT_IN_EXCLUSIONS,
      ...nestedRoots(resolved, project).map((root) => `${root}/**`),
    ],
    outputDir,
    forbidOnly: true,
    retries: 0,
    workers: browserWorkers(),
    fullyParallel: false,
    timeout: Math.max(
      DEFAULT_BROWSER_TIMEOUT_MS,
      extend.timeouts?.test ?? DEFAULT_BROWSER_TIMEOUT_MS,
    ),
    expect: {
      timeout: Math.max(
        DEFAULT_EXPECT_TIMEOUT_MS,
        extend.timeouts?.expect ?? DEFAULT_EXPECT_TIMEOUT_MS,
      ),
    },
    reporter: report ? [['dot'], ['json', { outputFile: report }]] : [['line']],
    ...(extend.globalSetup === undefined
      ? {}
      : { globalSetup: join(project.directory, extend.globalSetup) }),
    ...(extend.globalTeardown === undefined
      ? {}
      : { globalTeardown: join(project.directory, extend.globalTeardown) }),
    use: {
      ...extend.use,
      headless: true,
      screenshot: 'only-on-failure',
      trace: 'retain-on-failure',
      video: 'off',
      ...(baseURL === undefined ? {} : { baseURL }),
    },
    projects: suite.browsers.map((browser) => ({ name: browser, use: { browserName: browser } })),
    ...(servers.length === 0
      ? {}
      : {
          webServer: servers.map((server) => ({
            command: server.command,
            url: server.url,
            cwd: server.cwd === undefined ? project.directory : join(project.directory, server.cwd),
            timeout: server.timeoutMs ?? 60_000,
            reuseExistingServer: server.reuseLocalServer === true && !ci,
            stdout: 'ignore' as const,
            stderr: 'pipe' as const,
            ...(server.env === undefined ? {} : { env: server.env }),
          })),
        }),
  }
}
