# Testing

Suites are declared in `dev.config.mjs`; each runner config calls this package's factory for its suite, so every suite gets the same discovery, lifecycle, bounds, and output. `toolpath-dev` runs them and proves from each runner's machine-readable report that tests actually executed. There is no coverage collection, reporting, threshold, or badge.

| Runner       | Suite kind                                         | Factory                                                         | Runs in                            |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| `vitest`     | Unit and component tests (Node, DOM, universal)    | `createVitestConfig` from `@toolpath/dev-config/vitest`         | every `check` and `test`           |
| `jest-expo`  | Unit and component tests for React Native          | `createJestExpoConfig` from `@toolpath/dev-config/jest-expo`    | every `check` and `test`           |
| `playwright` | Browser and API tests against a running app        | `createPlaywrightConfig` from `@toolpath/dev-config/playwright` | CI (`ci: 'required'`) or on demand |
| `command`    | Specialized integration, device, or service suites | none: `argv` plus a declared report                             | CI (`ci: 'required'`) or on demand |

```js
// dev.config.mjs (one project)
{
  name: 'app',
  root: 'apps/app',
  kind: 'application',
  runtime: 'dom',
  tsconfig: 'tsconfig.json',
  suites: {
    unit: { runner: 'vitest', config: 'vitest.config.ts' },
    browser: { runner: 'playwright', config: 'playwright.config.ts' },
  },
}
```

## Conventions

| Files                                                    | Meaning                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `*.test.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `__tests__/**` | Unit and component tests, run by Vitest or Jest Expo       |
| `*.spec.{…}`                                             | Browser and API tests, run by Playwright                   |
| `test-utils/**`, `*.test-utils.{…}`                      | Shared test helpers: linted with the test rules, never run |

The lint profiles use the same patterns, so a file the runner executes is linted as a test and the other way round. A nested project's files belong to its own suites; the parent's suites exclude them.

Test APIs are imported explicitly (`import { describe, expect, it } from 'vitest'`); Vitest runs with `globals: false`. Test files are type-checked by the project's TypeScript program with the same strict options as source: a transpiling runner is not a type checker, and a cast inside a test is no safer than one outside it.

## Vitest

```ts
// vitest.config.ts
import config from '../../dev.config.mjs'
import { createVitestConfig } from '@toolpath/dev-config/vitest'

export default createVitestConfig(config, {
  project: 'app',
  suite: 'unit',
  extend: {
    setupFiles: ['./test/setup.ts'],
    alias: { '~': new URL('./src', import.meta.url).pathname },
  },
})
```

- The project's `runtime` picks the environment: `dom` runs in jsdom with React Testing Library cleanup after each test and `@testing-library/jest-dom` matchers when installed; `node` and `universal` run in Node. Native projects use Jest Expo.
- `extend` adds setup files (after the shared lifecycle), aliases, Vite plugins, `define`, `environmentOptions`, and longer timeouts. The rest is policy.
- Write component tests with `@testing-library/react` and `@testing-library/user-event` against roles and text, not renderer snapshots.

## Playwright

```ts
// playwright.config.ts
import config from './dev.config.mjs'
import { createPlaywrightConfig } from '@toolpath/dev-config/playwright'

export default createPlaywrightConfig(config, {
  project: 'app',
  suite: 'browser',
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
  },
})
```

- Headless, `forbidOnly`, zero retries, 30 s per test and 5 s per expectation, and one project per declared `browsers` entry (default Chromium).
- Failure-first artifacts: a screenshot and a retained trace only for failing tests, no video, written under the project's `test-results/<suite>/` for CI to upload.
- A managed `webServer` declares its readiness URL; tests use it as `baseURL` unless `baseURL` is given. `reuseLocalServer: true` lets a developer point a run at a server they already started; it is ignored in CI, which always starts its own.
- `extend.use` may set options such as `locale`, `viewport` or `storageState`; it cannot change the headless or artifact policy. `extend.globalSetup`, `extend.globalTeardown` and longer `extend.timeouts` are available.
- Browsers are installed explicitly before a suite runs, never inside `test`: `npx playwright install --with-deps chromium`. A missing browser exits 2 with that command, as a prerequisite failure, never a pass.

## Jest Expo

```js
// jest.config.mjs
import config from './dev.config.mjs'
import { createJestExpoConfig } from '@toolpath/dev-config/jest-expo'

export default createJestExpoConfig(config, { project: 'mobile', suite: 'unit' })
```

A CommonJS `jest.config.js` can export an async function, which Jest awaits:

```js
module.exports = async () => {
  const [{ default: config }, { createJestExpoConfig }] = await Promise.all([
    import('./dev.config.mjs'),
    import('@toolpath/dev-config/jest-expo'),
  ])
  return createJestExpoConfig(config, { project: 'mobile', suite: 'unit' })
}
```

- The tested line is jest-expo 58, Jest 30, React Native 0.88 and `@testing-library/react-native` 14 (whose `render` and user events are awaited).
- The jest-expo preset supplies the React Native environment, transforms, asset handling and tsconfig `paths`. Its `transformIgnorePatterns` are restated (they are replaced, not merged, when set), pnpm layouts included; `extend.transformPackages` adds packages that ship untranspiled code.
- Unlike the bare preset, which passes with no tests, an empty suite fails.
- Device and simulator checks are `command` suites with their prerequisites; the ordinary unit gate never needs an emulator.

## Command suites

```js
e2e: {
  runner: 'command',
  argv: ['node', 'scripts/service-tests.mjs'],
  report: { format: 'junit', path: 'reports/service.xml' },
  prerequisites: { env: ['DATABASE_URL'], commands: ['docker'] },
  timeoutMinutes: 30,
}
```

`argv` runs without a shell from the project root. A zero exit is not evidence that tests ran: the declared report (`junit`, `vitest-json`, `jest-json` or `playwright-json`) must exist and count at least one executed test. Missing environment variables (names only, never values) or executables fail before the suite starts, with exit code 2.

A suite that genuinely cannot run in CI declares `ci: 'manual'` with a reason; it stays visible in `doctor` and CI summaries and still runs with `toolpath-dev test --suite <project>:<suite>`.

## Lifecycle and isolation

- Mocks are cleared and spies restored before each test (`clearMocks`, `restoreMocks`); Vitest also unstubs environment variables and globals. A mock's implementation set inside a test is not erased mid-test.
- Timers return to real time after every test, so one test's fake timers cannot leak into the next.
- DOM tests unmount between tests. Test servers, MSW handlers and Engine scenarios close in the test that opened them ([Engine testing](engine-testing.md)).

## Bounds and concurrency

| Bound                      | Default                                           | Change                                                           |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Unit test timeout          | 5 s                                               | `extend.timeouts.test` (longer only)                             |
| Unit hook timeout          | 10 s                                              | `extend.timeouts.hook` (Vitest, longer only)                     |
| Browser test / expectation | 30 s / 5 s                                        | `extend.timeouts.test` / `.expect` (longer only)                 |
| Unit workers               | `max(1, min(4, floor(availableParallelism / 2)))` | `TOOLPATH_DEV_MAX_WORKERS` lowers it (constrained CI)            |
| Browser workers            | 2 locally, 1 in CI                                |                                                                  |
| Retries                    | none, in every runner and in CI                   | a narrow, explained override for a genuinely flaky external test |

`toolpath-dev` runs suites one at a time; each runner already uses its bounded pool, so a run over many projects never starts a full pool per project at once.

## Running tests

```sh
toolpath-dev test                               # every ordinary suite, once
toolpath-dev test --project app                 # one project's ordinary suites (its dependencies' builds first)
toolpath-dev test --suite app:browser           # a declared browser or command suite
toolpath-dev test --suite app:unit -- src/cart  # a file filter for one suite
toolpath-dev test --watch --suite app:unit      # the runner's own watch mode, for one suite
```

Tests run once unless `--watch` is given. A passing suite prints one line (`test app:unit: 42 tests passed (1.8s)`); a failing one prints the runner's failure output — test names, diffs, locations and stacks — without the names of passing tests. In CI the same runs also write the reports the quality workflow aggregates.
