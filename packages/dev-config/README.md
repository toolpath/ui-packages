# @toolpath/dev-config

Shared oxlint and TypeScript configuration for Toolpath repositories, the ESLint and Prettier configs that remain, and helpers
that keep React Compiler switched on. It is configuration only: nothing is generated or
synchronized, and each repository adds a few small files once.

```sh
pnpm add -D @toolpath/dev-config oxlint oxlint-tsgolint prettier \
  typescript@npm:@typescript/typescript6@6.0.2 @typescript/native@npm:typescript@7.0.2
```

That is TypeScript's documented side-by-side setup. `tsc` runs TypeScript 7, and `import 'typescript'`
gets the TypeScript 6 API for tools that need one, such as declaration builds, because TypeScript 7.0
ships no compiler API. Remove the alias when your tools support TypeScript 7's API.

## oxlint

```ts
// oxlint.config.ts
import { createOxlintConfig } from '@toolpath/dev-config/oxlint'

export default createOxlintConfig({ react: true })
```

Run it as `oxlint`. Every rule is an error or off, and a disable comment that suppresses nothing is
an error. Type-aware rules run on TypeScript 7, so a tsconfig needs to be valid there (no `baseUrl`).

- **All JS and TS files:** the correctness rules of `@eslint/js` recommended, plus `curly`,
  `eqeqeq`, `prefer-const`, `no-var`, `no-eval`, `no-new-func`, `no-self-compare`,
  `no-template-curly-in-string`, `no-unreachable-loop`, and arrow callbacks
  (`prefer-arrow-callback`, which allows named function expressions, so `memo(function Row…)`
  keeps its name). Unused names may start with `_`, but a `_` name that is read is reported.
- **Defect-finding plugin rules**, none of their style presets:
  - `unicorn`: event timing (`currentTarget` read after `await`), promises (`resolve()` called
    twice), discarded results (a thrown-away `.map()`), HTML sinks and URL protocol comparisons.
  - `regexp`: misleading regular expressions and super-linear backtracking (ReDoS).
  - `import`: `no-duplicates`, `no-self-import` and `no-cycle`.
  - `no-extraneous-dependencies`: devDependencies only in tests and test setup files, stories,
    scripts, `*.config.*`, `vite.*`, `*-test-support.*` and React Router's `app/routes.ts`.
  - `no-relative-packages`: a relative import may not reach into another package.
- **TypeScript files:** typescript-eslint's `strictTypeChecked` rules, plus:
  - `strict-boolean-expressions`: booleans, strings, nullable booleans and nullable objects or
    strings may be used as conditions; numbers are compared explicitly (`count > 0`). String
    truthiness treats an empty string like a missing value.
  - Type assertions are `as` only, never on an object or array literal (use `satisfies` or an
    annotation), and never narrow a type without proof (`no-unsafe-type-assertion`: use a type
    guard or a parser).
  - Non-null assertions (`!`) are allowed only on an index access (`values[i]!`), where a loop bound
    usually proves the value exists. `map.get(key)!`, `list.find(…)!` and `box.size!` need a guard.
  - `no-unnecessary-condition` trusts your types, so fix a wrong type instead of deleting a guard
    it flags. `while (true)` is allowed.
  - `restrict-template-expressions` accepts only strings and numbers; `switch-exhaustiveness-check`
    lets no `default:` absorb a union member; `no-floating-promises` checks thenables;
    `only-throw-error` rejects throwing `unknown`, and allows `Response`, `Promise` (Suspense) and
    React Router's `data()`.
  - `method-signature-style: property` (method syntax makes parameters bivariant),
    `prefer-readonly`, `prefer-nullish-coalescing`, `prefer-optional-chain`,
    `require-array-sort-compare`, `Array<T>`, separate type-only imports and
    `no-import-type-side-effects`.
  - `@ts-ignore` is banned. `@ts-expect-error` is allowed only in tests, with a 10-character
    reason; shipped code fixes the type.
- **Tests** (`*.test.*`, `*.spec.*`, `*.test-d.*`, `tests/` and similar): Vitest's correctness rules,
  plus no `.only`, `.skip` or `.todo`, awaited async expectations, `toThrow` with a message, and
  `vi.mock` hoisting. Tests may use `!`, type assertions, `async` callbacks without `await`, mock
  classes and spreads of class instances, because a wrong one fails the test; the async and
  `no-unsafe-*` rules stay on.
- **`react: true`**, for every JS and TS file, since hooks live in `.ts` files too:
  - The Rules of React and React Compiler's diagnostics, except `immutability`, which flags the
    cancel flag in an effect's cleanup. `reactCompilerGuard()` covers what it would have caught.
  - `@eslint-react`'s leak checks (listeners, timers, observers, `fetch`), `<Context.Provider>` and
    `forwardRef`, and JSX typos.
  - Accessibility rules for JSX, and buttons need a literal `type` outside tests and stories.
- Installs, build output and generated files are ignored: `node_modules`, `dist`, `build`, `coverage`, `.react-router`,
  `playwright-report`, `test-results` and `storybook-static`. Pass more globs as `ignores`.
- **`forbidStyling: true`**: `src/` may not import a stylesheet, `@toolpath/ui`, Phosphor, Base UI,
  Tailwind, `clsx` or `tailwind-merge`, or render a `className` or `style`.

The typed rules need `strictNullChecks`; extend one of the tsconfig bases below. They also read the
built types of workspace dependencies, so a Turborepo `lint` task needs `"dependsOn": ["^build"]`;
without it, lint passes where dependencies happen to be built and fails on a clean CI checkout.

The `unicorn-js`, `regexp`, `eslint-react`, `import-x-js` and `toolpath` rules run through oxlint's
JS plugins, which get no type information. They roughly double lint time, and they are still alpha.

### Disable comments

`// oxlint-disable-next-line typescript/no-explicit-any` turns a rule off for a line. Say why next to
it. Use `oxlint-disable`, not `eslint-disable`, for hook rules: React Compiler skips a component with
an `eslint-disable` of `react-hooks/*`, and `reactCompilerGuard()` then fails the build.

### React Router

Run the type generator before lint, or the `no-unsafe-*` rules fail on route modules in a fresh
checkout:

```json
"lint": "react-router typegen && oxlint"
```

### TypeORM

Skip migrations, because one that has shipped must not change, and allow the cycles two-way
relations need:

```ts
const config = createOxlintConfig({ ignores: ['src/migrations/**'] })

export default {
  ...config,
  overrides: [
    ...(config.overrides ?? []),
    { files: ['src/entities/**'], rules: { 'import/no-cycle': 'off' } },
  ],
}
```

### Adopting it in an existing repository

Run `oxlint --fix`, fix what remains, then add it to CI. In a monorepo, move one package at a time.

### The packages' own config

The Toolpath packages lint themselves with a smaller, correctness-only config. It runs on ESLint
9.39 or 10, for packages that have not moved to oxlint. The config checks
duplicate keys and cases, unreachable code, `eqeqeq` (allowing `== null`), `no-var`,
`prefer-const`, unused names (a `_` prefix opts out), and, in `.tsx` files,
`react/no-unstable-nested-components` and `react-hooks/exhaustive-deps`. With `forbidStyling`,
`src/` may not import a stylesheet, `@toolpath/ui`, Phosphor, Base UI, Tailwind, `clsx` or
`tailwind-merge`, or render a `className` or `style`.

```js
// eslint.config.js
import { createPackageEslintConfig } from '@toolpath/dev-config/eslint-package'

export default createPackageEslintConfig({ forbidStyling: true, ignores: ['src/generated/**'] })
```

## Prettier

```js
// prettier.config.mjs
export { default } from '@toolpath/dev-config/prettier'
```

To format on commit, add Husky and lint-staged to the repository:

```sh
pnpm add -D husky lint-staged && pnpm exec husky init
echo 'pnpm exec lint-staged' > .husky/pre-commit
```

```json
// package.json
"lint-staged": { "*": "prettier --write --ignore-unknown" }
```

## TypeScript

```json
// tsconfig.json
{ "extends": "@toolpath/dev-config/tsconfig/browser.json", "include": ["src", "tests"] }
```

| Base           | For                                                                                 |
| -------------- | ----------------------------------------------------------------------------------- |
| `base.json`    | Strict checks shared by all the others (see below)                                  |
| `browser.json` | Bundled browser code: `Bundler` resolution, DOM, React JSX                          |
| `node.json`    | Node programs and scripts: `NodeNext`, Node types                                   |
| `library.json` | Published libraries for any renderer: `NodeNext`, React JSX, no DOM or Node globals |

`base.json` turns on `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`,
`noUncheckedSideEffectImports`, `erasableSyntaxOnly` (no enums, namespaces or parameter
properties) and `skipLibCheck: false`, and makes unreachable code and unused labels errors. The
bases set `noEmit`; the build tool (Vite, tsdown, esbuild) emits the JavaScript.

- Include tests, specs and tool configs in the tsconfig that type-checks the project; lint reads
  types from it. A tsconfig split into project references (`"files": []` and `"references"`, as
  create-vite writes it) is checked with `tsc -b`; `tsc --noEmit` on that root checks no file.
- `node.json` and `library.json` need `"type": "module"` in `package.json`; `node.json` also
  needs `@types/node`.
- Add ambient types the project uses: `"types": ["vite/client"]` for Vite apps, and
  `"vitest/globals"` for tests that use Vitest globals. React Router apps add
  `"rootDirs": [".", "./.react-router/types"]` and `".react-router/types/**/*"` to `include`;
  without the include, route types such as `href()` paths are not checked.
- `library.json` declares no DOM or Node globals, so `console`, timers, `URL` and `fetch` are
  unknown. A library that uses them adds `"types": ["node"]` or the `DOM` lib. Its tests usually
  need a tsconfig of their own with those types, because Vitest's types use them.
- Scripts run with Node's built-in TypeScript support (`node scripts/build.ts`) import each other by
  their `.ts` name, which needs `"allowImportingTsExtensions": true`; the bases' `noEmit` allows it.
- Never set `baseUrl` or `ignoreDeprecations`; TypeScript 6 stops type-checking at `baseUrl`, and
  `ignoreDeprecations` hides that. Write `paths` entries relative (`"./src/*"`), or use
  `package.json` `"imports"` (`#/…`).
- `skipLibCheck: false` reports broken published types instead of turning them into `any`. Fix the
  dependency's version, add its missing `@types` package, or `pnpm patch` it. React Native and Expo
  apps set `skipLibCheck: true`, and so does the tsconfig that checks `vite.config.ts` in a
  `@vitejs/plugin-react` 6 React Compiler setup: `@rolldown/plugin-babel`'s published types fail lib
  checking whichever Babel types are installed, and `babel-plugin-react-compiler`'s need the DOM lib.
- TypeScript checks every file a project includes or imports under that project's options. Generated
  code that uses enums needs `erasableSyntaxOnly: false` in each tsconfig whose files import it, not
  only in its own.

## React Compiler

Every React project compiles with [React Compiler](https://react.dev/learn/react-compiler):

```sh
pnpm add -D babel-plugin-react-compiler @babel/core
```

`reactCompilerOptions()` holds the shared options: `compilationMode: 'infer'`,
`panicThreshold: 'none'` (a function the compiler cannot handle is emitted unchanged), and
`target: '19'`. Code that must run on React 17 or 18 passes `reactCompilerOptions({ target: '18' })`
and installs `react-compiler-runtime`.

Wire the compiler the way your build tool documents it, with `reactCompilerOptions()`, then add
the check for that tool. The check fails the build when:

- the compiler compiled nothing, for example after an upgrade drops an option it was configured
  through;
- the compiler skipped a function, which then runs uncompiled. With `panicThreshold: 'none'` the
  compiler does this silently. The build lists each function with its reason, such as
  `src/reader.tsx:2  [Refs] Cannot access refs during render`. Fix what the reason names (lint
  reports most of them), or opt the function out with a `'use no memo'` directive and a comment
  saying why. Pass `{ onSkip: 'warn' }` to the check to report skips without failing, while a
  repository works through them.

### Vite with `@vitejs/plugin-react` 6

```ts
// vite.config.ts
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { reactCompilerGuard, reactCompilerOptions } from '@toolpath/dev-config/react-compiler'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset(reactCompilerOptions())] }),
    reactCompilerGuard(),
  ],
})
```

### Vite with `@vitejs/plugin-react` 5

```ts
export default defineConfig({
  plugins: [
    react({ babel: { plugins: [['babel-plugin-react-compiler', reactCompilerOptions()]] } }),
    reactCompilerGuard(),
  ],
})
```

### React Router

```ts
import { reactRouter } from '@react-router/dev/vite'
import babel from 'vite-plugin-babel'

// React Router builds route modules under ids with a query (`root.tsx?__react-router-build-client-route`,
// `route.tsx?route-chunk=main`), and `@babel/preset-typescript` enables TypeScript only for names
// ending in `.ts` or `.tsx`. These overrides test the id with its query.
const typescriptWithQueries = () => ({
  overrides: [
    {
      test: /\.tsx(?:$|\?)/,
      presets: [['@babel/preset-typescript', { allExtensions: true, isTSX: true }]],
    },
    { test: /\.[cm]?ts(?:$|\?)/, presets: [['@babel/preset-typescript', { allExtensions: true }]] },
  ],
})

export default defineConfig({
  plugins: [
    reactRouter(),
    babel({
      // vite-plugin-babel 1.7 and later include only `.js`/`.jsx` unless told otherwise. Without the
      // query, split route chunks ship uncompiled.
      include: /\.[jt]sx?(?:$|\?)/,
      exclude: /node_modules/,
      babelConfig: {
        presets: [typescriptWithQueries],
        plugins: [['babel-plugin-react-compiler', reactCompilerOptions()]],
        sourceMaps: true,
      },
    }),
    reactCompilerGuard(),
  ],
})
```

`reactCompilerGuard()` checks production client builds. It counts the project's `.jsx` and `.tsx`
modules and fails when the compiler ran on none of them: none imports the compiler runtime, and the
logger in `reactCompilerOptions()` saw none. It reports the functions that logger recorded as
skipped. Server builds and dependencies are not counted.

The compiler logs each function at its position in the code it received, and the guard finds the
function, and any `'use no memo'` in it, at that position in the file on disk. A plugin that
rewrites a module before the compiler, such as TanStack Router's `autoCodeSplitting`, moves its
functions: the guard then reports a skip in that module without a line, and cannot match a
function's `'use no memo'`. Opt such a module out with `'use no memo'` at its top, or pass
`{ onSkip: 'warn' }`.

### tsdown libraries

```js
// tsdown.config.js
import pluginBabel from '@rolldown/plugin-babel'
import {
  assertReactCompiled,
  reactCompilerGuard,
  reactCompilerOptions,
} from '@toolpath/dev-config/react-compiler'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
  plugins: [
    pluginBabel({ plugins: [['babel-plugin-react-compiler', reactCompilerOptions()]] }),
    reactCompilerGuard(),
  ],
  hooks: {
    'build:done': () => {
      assertReactCompiled('dist')
    },
  },
})
```

The config is JavaScript because `@rolldown/plugin-babel`'s published types fail
`skipLibCheck: false`. A package without React Compiler can use `tsdown.config.ts`, or flags alone:
`tsdown src/index.ts --format esm --dts --clean --platform neutral`. `platform: 'neutral'` emits
`.js` and `.d.ts`; the default, `node`, emits `.mjs` and `.d.mts`. Pass the Babel plugin directly
rather than through `reactCompilerPreset`, which needs `@vitejs/plugin-react` 6 and so Vite 8.

### tsup and esbuild libraries

tsup 9 or later is needed for declarations on TypeScript 6; tsup 8 passes `baseUrl`, which
TypeScript 6 rejects.

```ts
// tsup.config.ts
import {
  assertReactCompiled,
  reactCompilerEsbuildPlugin,
} from '@toolpath/dev-config/react-compiler'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['react'],
  esbuildPlugins: [reactCompilerEsbuildPlugin()],
  onSuccess: async () => {
    assertReactCompiled('dist')
  },
})
```

`reactCompilerEsbuildPlugin()` runs the compiler over each source file before esbuild lowers it,
and reports each skipped function at its location as a build error (`{ onSkip: 'warn' }` for
warnings; `{ target: '18' }` for React 17 or 18). `assertReactCompiled('dist')` throws unless the
output imports the compiler runtime, which is why `react` stays external; a bundled copy of react
does not count. It reads only the output, so it also throws when the compiler skipped or opted out
every function, and `clean: true` keeps an earlier build's files from passing it.

### Vitest

Use the same test suite and configuration in both modes. `test`, which CI runs, enables
React Compiler, so a local run catches what CI would; `test:source` runs untransformed source:

```ts
// vitest.config.ts
import { reactCompilerTestPlugin } from '@toolpath/dev-config/react-compiler'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins:
    process.env.REACT_COMPILER_TESTS === '1'
      ? [reactCompilerTestPlugin({ root: import.meta.dirname })]
      : [],
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
})
```

```json
"test": "REACT_COMPILER_TESTS=1 vitest run",
"test:source": "vitest run",
"test:ci": "pnpm run test"
```

The explicit flag keeps Vitest's normal mode and environment-file selection in both runs.
The plugin compiles loaded files under `src/` before Vite lowers TypeScript or JSX,
including hooks in `.ts` and modules imported through internal paths. It excludes tests,
setup/config files and dependencies. Apps with other source directories pass
`sourceDirectories: ['app', 'src']`. No separate test roster or import aliases are needed.
It shares the compiler invocation and default React 19 target with `reactCompilerEsbuildPlugin`,
and compiler skips fail the run. Pass the same `target` to both integrations for React 17 or 18.

This tests compiler-transformed source, not the bundled `dist` files. Keep the production
build guard and package-output checks too. Running the source suite locally and the compiled
suite in CI avoids doubling CI test execution; run both commands locally when investigating
compiler-specific behavior. Build `dev-config` before loading its exports in a fresh workspace.

### Expo

Expo runs the compiler itself when `app.json` sets `"experiments": { "reactCompiler": true }`.
Pass the same options through `babel-preset-expo` (written out, because Babel loads this
CommonJS file synchronously and this package is ESM):

```js
// babel.config.js
module.exports = {
  presets: [
    [
      'babel-preset-expo',
      { 'react-compiler': { compilationMode: 'infer', panicThreshold: 'none', target: '19' } },
    ],
  ],
}
```

There is no build check for Metro, so skipped functions are not reported there.

## CI

The checks hold only where CI runs them: the React Compiler checks only fail a build that runs.
Name the commands
as scripts, so CI and people run the same thing (a React Router app's `lint` also runs
`react-router typegen` first; a tsconfig split into references uses `tsc -b`; a monorepo's scripts
can call its task runner):

```json
// package.json
"scripts": {
  "format:check": "prettier --check .",
  "lint": "oxlint",
  "check-types": "tsc --noEmit",
  "build": "vite build"
}
```

```yaml
# .github/workflows/quality.yml
name: quality
on:
  pull_request:
  push:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .tool-versions
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run format:check
      - run: pnpm run lint
      - run: pnpm run check-types
      - run: pnpm run build
```

A failing run blocks nothing until the check is required: add a ruleset for the default branch
(Settings → Rules → Rulesets) that requires the `quality` check before merging.
