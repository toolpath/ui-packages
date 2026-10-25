import { builtinModules } from 'node:module'

/**
 * File conventions shared by the runner factories and the lint profiles, so a
 * file the runner executes as a test is linted with the test rules and vice versa.
 */
const EXTENSIONS = '{ts,tsx,mts,cts,js,jsx,mjs,cjs}'

/** Unit and component tests (Vitest, Jest Expo). */
export const UNIT_TEST_PATTERNS = [`**/*.test.${EXTENSIONS}`, `**/__tests__/**/*.${EXTENSIONS}`]

/** Browser and API tests (Playwright). */
export const BROWSER_TEST_PATTERNS = [`**/*.spec.${EXTENSIONS}`]

/** Shared test helpers that are not themselves tests but use test APIs. */
export const TEST_SUPPORT_PATTERNS = [
  `**/test-utils/**/*.${EXTENSIONS}`,
  `**/*.test-utils.${EXTENSIONS}`,
]

/** Every file a test program owns when a project separates one (`testTsconfig`). */
export const TEST_PROGRAM_PATTERNS = [
  ...UNIT_TEST_PATTERNS,
  ...BROWSER_TEST_PATTERNS,
  ...TEST_SUPPORT_PATTERNS,
]

export const SCRIPT_GLOB = `**/*.${EXTENSIONS}`

/** Every Node builtin by both its bare and `node:` names, for runtime import boundaries. */
export const NODE_BUILTINS = [
  ...new Set(
    builtinModules
      .filter((name) => !name.startsWith('_'))
      .flatMap((name) => (name.startsWith('node:') ? [name] : [name, `node:${name}`])),
  ),
].sort()

export const DEFAULT_UNIT_TIMEOUT_MS = 5_000
export const DEFAULT_HOOK_TIMEOUT_MS = 10_000
export const DEFAULT_BROWSER_TIMEOUT_MS = 30_000
export const DEFAULT_EXPECT_TIMEOUT_MS = 5_000

/** `max(1, min(4, floor(availableParallelism / 2)))`, lowered by `TOOLPATH_DEV_MAX_WORKERS`. */
export const unitWorkerCeiling = (
  availableParallelism: number,
  environment: NodeJS.ProcessEnv = process.env,
): number => {
  const ceiling = Math.max(1, Math.min(4, Math.floor(availableParallelism / 2)))
  const requested = Number.parseInt(environment.TOOLPATH_DEV_MAX_WORKERS ?? '', 10)
  return Number.isInteger(requested) && requested >= 1 ? Math.min(ceiling, requested) : ceiling
}

/** Browser workers: two locally, one in CI. */
export const browserWorkers = (environment: NodeJS.ProcessEnv = process.env): number =>
  environment.CI ? 1 : 2
