# Configuration

`dev.config.mjs` at the repository root declares the repository's projects. It is executable
configuration validated strictly when it loads: unknown or misspelled fields, duplicate names,
ambiguous roots, paths outside the repository, dependency cycles and missing files all fail with
the exact path to fix.

```js
import { defineConfig } from '@toolpath/dev-config'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [
    {
      name: 'web',
      root: 'apps/web',
      kind: 'application',
      runtime: 'dom',
      tsconfig: 'tsconfig.json',
      dependsOn: ['core'],
      react: { adapter: 'vite-modern' },
      suites: {
        unit: { runner: 'vitest', config: 'vitest.config.ts' },
        browser: { runner: 'playwright', config: 'playwright.config.ts' },
      },
    },
    {
      name: 'core',
      root: 'packages/core',
      kind: 'library',
      runtime: 'universal',
      tsconfig: 'tsconfig.json',
      testTsconfig: 'tsconfig.test.json',
      suites: { unit: { runner: 'vitest', config: 'vitest.config.ts' } },
    },
  ],
  tooling: {
    files: ['*.config.{js,mjs,cjs,ts}', 'scripts/**/*.{js,mjs,ts}'],
    tsconfig: 'tsconfig.tooling.json',
  },
  generated: [
    { files: ['packages/core/src/generated/**'], reason: 'Written by the API client generator' },
  ],
  ci: { node: '24.18.0' },
})
```

## Top level

| Field           | Required | Meaning                                                                                        |
| --------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `schemaVersion` | yes      | Exactly `1`.                                                                                   |
| `root`          | yes      | `import.meta.url`. It names the configuration module; every path resolves from its directory.  |
| `projects`      | yes      | The projects, below. Nested roots are allowed; the most specific root owns a file.             |
| `tooling`       | no       | Maintained configuration and scripts, and the program (`allowJs`, `checkJs`) that checks them. |
| `generated`     | no       | `{ files, reason }`: generated code excluded from lint and type ownership.                     |
| `formatIgnore`  | no       | `{ files, reason }`: byte-retained files the formatter never touches.                          |
| `exceptions`    | no       | `{ rule, files, reason, issue?, expires? }`: see [policy](policy.md#exceptions).               |
| `ci`            | yes      | `{ node, externalSuites? }`; `node` must be the release's pinned Node.                         |
| `engine`        | no       | The optional Engine profile, below.                                                            |
| `agents`        | no       | `{ skillsDir }`, the repository-relative skill directory (default `.claude/skills`).           |

Every maintained TS/JS file must belong to one project or the tooling scope. Dependency
directories, `.git`, `dist`, `build`, framework output, test reports and `.toolpath/ci-source` are
always excluded.

## Projects

| Field          | Meaning                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `name`         | Stable lowercase identifier, used by `--project` and in CI.                                              |
| `root`         | Directory relative to the configuration; `'.'` for a root project.                                       |
| `kind`         | `application`, `library` or `tooling`.                                                                   |
| `runtime`      | `node`, `dom`, `native` or `universal`: the platform APIs the code may use and its test environment.     |
| `tsconfig`     | The project's check program, relative to its root.                                                       |
| `testTsconfig` | Optional separate program for its tests, so test-only types stay out of the source program.              |
| `dependsOn`    | Projects this one needs; workspace manifest dependencies are added automatically. A contradiction fails. |
| `react`        | `{ adapter, minimumVersion? }`: see [React](react.md). React profiles always enable the compiler.        |
| `suites`       | Named suites, below.                                                                                     |
| `noUnitTests`  | `{ reason }`, required when the project declares no Vitest or Jest Expo suite.                           |
| `build`        | `{ argv, outputs }`: the build dependents need first. It runs once per command, in graph order.          |

## Suites

| Runner       | Fields                                                                  | Runs in                                  |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| `vitest`     | `config`                                                                | Every `check` and `test`                 |
| `jest-expo`  | `config`                                                                | Every `check` and `test`                 |
| `playwright` | `config`, `ci?`, `reason?`, `browsers?`, `prerequisites?`               | CI, and `test --suite <project>:<suite>` |
| `command`    | `argv`, `report`, `ci?`, `reason?`, `prerequisites?`, `timeoutMinutes?` | CI, and `test --suite …`                 |

A declared suite must discover and run tests; an empty suite fails. `ci` is `required` (default)
or `manual`, and a manual suite needs a `reason`. A `command` suite runs `argv` without a shell
and must write a machine-readable `report` (`vitest-json`, `jest-json`, `playwright-json` or
`junit`) that proves its tests ran. `prerequisites` names environment variables (names only) and
executables the suite needs; a missing one fails before the suite starts, with exit code 2.

```js
device: {
  runner: 'command',
  argv: ['node', 'scripts/run-device-tests.mjs'],
  report: { format: 'junit', path: 'reports/device.xml' },
  ci: 'manual',
  reason: 'Needs a simulator; runs in the release checklist',
  prerequisites: { commands: ['xcrun'] },
},
```

## CI

`ci.externalSuites` delegates a required specialized suite to a job in the caller workflow, for
suites that need a database, service container or simulator:

```js
ci: {
  node: '24.18.0',
  externalSuites: [{ project: 'api', suite: 'integration', job: 'api-integration' }],
},
```

Each entry names an existing required suite and a stable job ID; `init`/`sync` generate the job
skeleton and include it in the `quality` aggregate. See [CI](ci.md).

## Engine

```js
engine: {
  contract: 'api-1.29.1',
  integrationFiles: ['src/integrations/engine/**/*.{ts,tsx}'],
  compatibilityFiles: [
    { files: ['src/integrations/engine/compatibility/**/*.ts'], reason: 'Staging endpoint used before the SDK publishes it' },
  ],
  origins: ['https://api.toolpath.com', 'https://api.staging.toolpath.com'],
},
```

`contract` is one of the immutable supported contracts (`api-1.29.1` stable, `api-1.32.0`
staging) and must match the installed `@toolpath/api`. See [Engine testing](engine-testing.md).

## Examples

A single Node library:

```js
export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [
    {
      name: 'core',
      root: '.',
      kind: 'library',
      runtime: 'node',
      tsconfig: 'tsconfig.json',
      suites: { unit: { runner: 'vitest', config: 'vitest.config.ts' } },
    },
  ],
  tooling: { files: ['*.config.{js,mjs,ts}'], tsconfig: 'tsconfig.tooling.json' },
  ci: { node: '24.18.0' },
})
```

An Expo application, with a device suite run by hand:

```js
projects: [
  {
    name: 'mobile',
    root: '.',
    kind: 'application',
    runtime: 'native',
    tsconfig: 'tsconfig.json',
    testTsconfig: 'tsconfig.test.json',
    react: { adapter: 'expo' },
    suites: {
      unit: { runner: 'jest-expo', config: 'jest.config.mjs' },
      device: {
        runner: 'command',
        argv: ['npx', 'maestro', 'test', '--format', 'junit', '--output', 'reports/device.xml', 'flows'],
        report: { format: 'junit', path: 'reports/device.xml' },
        ci: 'manual',
        reason: 'Needs an emulator; run before each store release',
      },
    },
  },
],
```
