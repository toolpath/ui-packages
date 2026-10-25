# @toolpath/dev-config

One versioned development standard for TypeScript repositories: strict TypeScript and lint
policy, React quality rules with the React Compiler actually wired into the build, consistent
unit/component/browser/native test runners, automatic formatting at commit, shared GitHub
Actions quality workflows, deterministic Engine API test fixtures, and short agent instructions.

A repository keeps only its project facts in `dev.config.mjs` and a few native files that import
the shared factories. Rules, tool versions, and pipelines live here and change together in a
release.

It is a development dependency. It adds nothing to an application's or library's runtime, and it
does not raise the runtime floor of a package that uses it for linting.

## Requirements

- Node `>=24.18.0 <25` for the tooling (the development runtime, not your package's floor).
- npm (the version that ships with that Node) or pnpm `10.6.5`.
- ESLint `10.9.1` and TypeScript `5.9.3` or `6.0.3`, as exact dev dependencies. `init` installs
  them; every other tool is installed only when a profile needs it.

## Start

From the repository root, describe each project once. Nothing is written until the whole plan
validates; `--dry-run` prints the complete diff instead.

```sh
# A single Node library
npx @toolpath/dev-config init --name core --kind library --runtime node

# A React application built with Vite 8 and @vitejs/plugin-react 6, with browser tests
npx @toolpath/dev-config init --name web --kind application --runtime dom --react vite-modern --browser-tests

# A workspace
npx @toolpath/dev-config init \
  --project-spec name=core,root=packages/core,kind=library,runtime=universal \
  --project-spec name=web,root=apps/web,kind=application,runtime=dom,react=vite-modern

# An Expo application
npx @toolpath/dev-config init --name mobile --kind application --runtime native --react expo --tests jest-expo
```

`init` writes `dev.config.mjs`, the native config files, `package.json` scripts, the pre-commit
hook, `.github/workflows/quality.yml`, a managed section in `AGENTS.md` plus the `commit`, `pr`
and `review` skills, and a synchronization receipt (`.toolpath/dev-config.json`). It installs the
exact tool versions with your package manager. An existing native config that differs stops the
run with a diff; see [adoption](docs/adoption.md).

After upgrading the package, `npx toolpath-dev sync` updates every managed file, script, tool
version, workflow reference and agent asset, merging local edits and stopping on overlapping ones.

## Daily commands

| Command                               | What it does                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `toolpath-dev check`                  | Doctor essentials, prerequisite builds, lint, type checks, ordinary tests            |
| `toolpath-dev lint`                   | Strict lint of every maintained file in scope, zero warnings, no changes             |
| `toolpath-dev lint:fix`               | Safe ESLint fixes only; optional, never a formatting step                            |
| `toolpath-dev check-types`            | Strict no-emit checks of every source, test and tooling program                      |
| `toolpath-dev test`                   | Unit and component suites, once; `--watch` and `--suite` for one suite               |
| `toolpath-dev doctor`                 | Read-only diagnosis of config, scope, programs, versions, hooks, receipt and CI      |
| `toolpath-dev react verify`           | Proves React Compiler runs in each React project's real build (also part of `check`) |
| `toolpath-dev ci`                     | The CI contract: read-only formatting backstop plus every required stage             |
| `toolpath-dev sync`                   | Update managed integrations to the installed release                                 |
| `toolpath-dev agents sync`            | Update only the managed agent section and skills                                     |
| `toolpath-dev engine verify-contract` | Explicit network check of an Engine target's public contract                         |

Common flags are `--project <name>` (repeatable), `--config <path>`, `--verbose` and `--json`. A
file filter goes after `--`: `toolpath-dev test --project core -- src/sum.test.ts`. Exit codes are
stable: `0` success, `1` a check failed, `2` invalid invocation, configuration or prerequisite. An
interrupted run never reports success.

**Nobody runs a formatter.** The pre-commit hook applies safe lint fixes and then Prettier to the
staged files and restages them; CI verifies formatting read-only for commits made without the hook.
There is no `format` script, and `check` never formats.

## Native files

```js
// eslint.config.mjs
import config from './dev.config.mjs'
import { createEslintConfig } from '@toolpath/dev-config/eslint'

export default await createEslintConfig(config)
```

```js
// prettier.config.mjs
export { default } from '@toolpath/dev-config/prettier'
```

```js
// vitest.config.ts
import config from './dev.config.mjs'
import { createVitestConfig } from '@toolpath/dev-config/vitest'

export default createVitestConfig(config, { project: 'core', suite: 'unit' })
```

```jsonc
// tsconfig.json
{ "extends": "@toolpath/dev-config/typescript/library.json", "include": ["src"] }
```

Repository-specific additions go through the factories' options (stricter import boundaries,
setup files, aliases); a native config that weakens a baseline rule is refused by the standard
commands. The only way to narrow a rule is a reasoned, narrow `exceptions` entry.

## Entry points

| Import                                     | Contents                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `@toolpath/dev-config`                     | `defineConfig`, configuration types, `loadConfig`, `resolveConfig`, `toolchain` |
| `@toolpath/dev-config/eslint`              | `createEslintConfig(config, options?)`, the policy groups                       |
| `@toolpath/dev-config/eslint/plugin`       | The `toolpath/*` rules                                                          |
| `@toolpath/dev-config/prettier`            | The formatting policy                                                           |
| `@toolpath/dev-config/hooks`               | The staged-file task for lint-staged compositions                               |
| `@toolpath/dev-config/typescript/*.json`   | `base`, `node`, `browser`, `library` presets                                    |
| `@toolpath/dev-config/vitest`              | `createVitestConfig`                                                            |
| `@toolpath/dev-config/playwright`          | `createPlaywrightConfig`                                                        |
| `@toolpath/dev-config/jest-expo`           | `createJestExpoConfig`                                                          |
| `@toolpath/dev-config/react/vite`          | React Compiler for Vite (`vite-legacy`, `vite-modern`)                          |
| `@toolpath/dev-config/react/babel`         | React Compiler for Babel and React Router                                       |
| `@toolpath/dev-config/react/expo`          | Expo's compiler configuration and verification                                  |
| `@toolpath/dev-config/react/library`       | Compiler options and an esbuild plugin for tsup/esbuild libraries               |
| `@toolpath/dev-config/engine/testing`      | Engine fixtures, scenarios and an injected-fetch transport                      |
| `@toolpath/dev-config/engine/testing/node` | A real Node HTTP Engine test server                                             |
| `@toolpath/dev-config/engine/testing/msw`  | MSW handlers over the same scenarios                                            |
| `@toolpath/dev-config/engine/eslint`       | The optional Engine boundary rule                                               |
| `@toolpath/dev-config/release.json`        | This release's toolchain and workflow identity                                  |

The root, lint, formatting and configuration entries load no React, SDK, MSW, Expo, Playwright,
Jest, Vite or Babel. An optional entry used without its tools fails with the profile and the exact
install command; it never falls back to a weaker standard.

## Installed guidance

Agents and people can read the shipped documentation at
`node_modules/@toolpath/dev-config/docs/`:

- [policy.md](docs/policy.md): what the lint and TypeScript policy enforces and why, and the
  exception mechanism.
- [configuration.md](docs/configuration.md): every `dev.config.mjs` field.
- [testing.md](docs/testing.md): the runner factories and test conventions.
- [react.md](docs/react.md): React Compiler adapters, rules and opt-outs.
- [engine-testing.md](docs/engine-testing.md): the Engine scenario kit and its limits.
- [ci.md](docs/ci.md): the shared workflow, composite actions and the `quality` check.
- [agents.md](docs/agents.md): agent instructions, skills and the optional Claude files.
- [adoption.md](docs/adoption.md): adopting the standard in an existing repository.
- [maintenance.md](docs/maintenance.md): changing a default, a tool version or a rule.

## Versions

A fix that rejects no correctly supported consumer is a patch; a new opt-in profile or export is
a minor; a rule or default that rejects previously accepted code, a formatting change, a raised
runtime or peer floor, a new required CI stage, or a schema change is a breaking policy change,
released with migration notes. Tool upgrades and policy changes ship together; run `sync` after
upgrading.

## License

MIT
