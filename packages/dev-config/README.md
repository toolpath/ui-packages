# @toolpath/dev-config

Shared ESLint, Prettier and TypeScript configuration for Toolpath repositories, and helpers that
keep React Compiler switched on. It is configuration only: nothing is generated or synchronized,
and each repository adds a few small files once.

```sh
pnpm add -D @toolpath/dev-config eslint prettier typescript@~6.0.3
```

TypeScript 6.0 is required. TypeScript 7.0 (npm `latest`) ships no compiler API, and
typescript-eslint, which runs every type-aware rule here, refuses to load with it. TypeScript 6.0
has 7.0's defaults and rejects what 7.0 removed, so code that is clean on 6.0 is ready for 7.0 once
typescript-eslint supports it.

## ESLint

```js
// eslint.config.mjs
import { createEslintConfig } from '@toolpath/dev-config/eslint'

export default createEslintConfig({ tsconfigRootDir: import.meta.dirname, react: true })
```

Run it as `eslint . --max-warnings=0`. Every rule is an error or off; none warns.

- **All JS and TS files:** `@eslint/js` recommended, plus `curly`, `eqeqeq`, `prefer-const`,
  `no-var`, `no-eval`, `no-implied-eval`, `no-new-func`, `no-self-compare`,
  `no-template-curly-in-string`, `no-unreachable-loop`, and arrow callbacks
  (`prefer-arrow-callback`, which allows named function expressions, so `memo(function Row…)`
  keeps its name). Unused names may start with `_`, but a `_` name that is read is reported.
- **Defect-finding plugin rules**, none of their style presets:
  - `eslint-plugin-unicorn`: logic slips (`a | b` in a condition, `2 ^ 8`, `total += total + n`),
    async and event timing (`currentTarget` read after `await`, `resolve()` called twice),
    discarded results (a thrown-away `.map()`), HTML sinks and URL protocol comparisons.
  - `eslint-plugin-regexp`: invalid and misleading regular expressions and super-linear
    backtracking (ReDoS).
  - `eslint-plugin-import-x`: `no-extraneous-dependencies` (devDependencies only in tests and
    test setup files, stories, scripts and `*.config.*`), `no-relative-packages`, `no-duplicates`, `no-self-import`,
    `no-useless-path-segments` and `no-cycle`.
- **TypeScript files:** typescript-eslint's `strictTypeChecked` preset, plus:
  - `strict-boolean-expressions`: a condition is a boolean, a nullable boolean or a nullable
    object; numbers and strings are compared explicitly (`count > 0`, `name !== ''`).
  - Type assertions are `as` only, never on an object or array literal (use `satisfies` or an
    annotation), and never narrow a type without proof (`no-unsafe-type-assertion`: use a type
    guard or a parser). Non-null assertions (`!`) are banned by the preset.
  - `restrict-template-expressions` accepts only strings and numbers; `switch-exhaustiveness-check`
    lets no `default:` absorb a union member; `no-floating-promises` checks thenables;
    `only-throw-error` rejects throwing `unknown`.
  - `method-signature-style: property` (method syntax makes parameters bivariant),
    `prefer-readonly`, `prefer-nullish-coalescing`, `prefer-optional-chain`,
    `require-array-sort-compare`, `Array<T>`, separate type-only imports and
    `no-import-type-side-effects`.
  - `@ts-ignore` is banned. `@ts-expect-error` is allowed only in tests, with a 10-character
    reason; shipped code fixes the type.
- **Tests** (`*.test.*`, `*.spec.*`, `*.test-d.*`, `tests/` and similar): `@vitest/eslint-plugin` recommended,
  plus no `.only`, `.skip` or `.todo`, awaited async expectations, `toThrow` with a message, and
  `vi.mock` hoisting and `import()` paths. Tests may use `!`, type assertions and `async`
  callbacks without `await`, because a wrong one fails the test; the async and `no-unsafe-*`
  rules stay on.
- **`react: true`**, for every JS and TS file, since hooks live in `.ts` files too:
  - `eslint-plugin-react-hooks` `recommended-latest`, the Rules of React and React Compiler's
    diagnostics. `exhaustive-deps` is an error.
  - `@eslint-react` `recommended-type-checked` (`recommended` for JS), with its warnings made
    errors where they catch defects or deprecated APIs (`forwardRef`, `<Context.Provider>`,
    leaked listeners and timers) and its naming and duplicate-of-hooks rules off.
  - `eslint-plugin-jsx-a11y-x` `recommended` for JSX, and buttons need a `type` outside tests and
    stories.
- Build output and generated files are ignored: `dist`, `build`, `coverage`, `.react-router`,
  `playwright-report`, `test-results` and `storybook-static`. Pass more globs as `ignores`.

The typed rules need `strictNullChecks`; extend one of the tsconfig bases below.

### Suppressions

`@eslint-community/eslint-plugin-eslint-comments` keeps suppressions honest:

- Every `eslint-disable` comment gives a reason after `--`. None is unlimited
  (`/* eslint-disable */`) or left open to the end of the file. One that suppresses nothing is an
  error.
- Comments may only disable rules, never configure them: `/* eslint rule: "off" */` is an error.
- The rules in `UNSUPPRESSIBLE` cannot be disabled by a comment. Each has a fix that is not a
  suppression: the eslint-comments rules themselves, `ban-ts-comment`, `consistent-type-assertions`,
  `no-explicit-any`, `no-floating-promises` (write `void` for a deliberate one),
  `no-misused-promises`, the `no-unsafe-*` rules except `no-unsafe-type-assertion`,
  `strict-boolean-expressions`, `no-extraneous-dependencies`, the `eval` family,
  `rules-of-hooks`, `exhaustive-deps` and `vitest/no-focused-tests`.

A comment that configures rules can still switch off the rules that forbid it. Close that in CI by
running the comment rules alone with inline configuration disabled:

```js
// eslint.comments-audit.config.mjs
import { createCommentAuditConfig } from '@toolpath/dev-config/eslint'

export default createCommentAuditConfig()
```

```sh
echo '{}' > eslint.comments-audit-suppressions.json   # once; commit it
eslint --no-inline-config -c eslint.comments-audit.config.mjs \
  --suppressions-location eslint.comments-audit-suppressions.json . --max-warnings=0
```

The audit reads its own suppressions file, which stays empty. Without it, it reads the lint's
`eslint-suppressions.json` (see [Adopting it](#adopting-it-in-an-existing-repository)): it fails on
every entry for a rule it does not run, and it honours comment findings that `--suppress-all`
recorded.

An exception to a rule that cannot be disabled belongs in `eslint.config.mjs`, scoped to the files
that need it, where review sees it:

```js
export default [
  ...createEslintConfig({ tsconfigRootDir: import.meta.dirname }),
  { files: ['src/generated/**'], rules: { '@typescript-eslint/no-unsafe-assignment': 'off' } },
]
```

### `exhaustive-deps`

Suppressing `react-hooks/exhaustive-deps` also makes React Compiler skip the whole component, and
turning it off in configuration changes the dependencies the compiler derives. Rewrite the code
instead: read the latest value of a prop or state without re-running the effect with
`useEffectEvent` (React 19.2 or later).

### React Router

Run the type generator before lint, or the unsuppressible `no-unsafe-*` rules fail on route
modules in a fresh checkout:

```json
"lint": "react-router typegen && eslint . --max-warnings=0"
```

### Adopting it in an existing repository

Fix what fixes itself, then record the rest as a baseline, so new code is clean from the first
day and old findings are fixed when someone works on that file:

```sh
eslint . --fix
eslint . --suppress-all   # writes eslint-suppressions.json; commit it
```

Lint then fails on any new finding, and on a file with more findings of a rule than recorded. A
fixed finding makes lint fail (exit 2) until `eslint . --prune-suppressions` removes it from the
file, so the baseline only shrinks. Review changes to `eslint-suppressions.json` like changes to the
config: rerunning `--suppress-all` would absorb new findings. Suppressions apply to the ESLint CLI
only; editors still show suppressed findings.

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
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`noUncheckedSideEffectImports`, `erasableSyntaxOnly` (no enums, namespaces or parameter
properties) and `skipLibCheck: false`, and makes unreachable code and unused labels errors. The
bases set `noEmit`; the build tool (Vite, tsup, esbuild) emits the JavaScript.

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

The checks hold only where CI runs them: the comment audit closes the inline-configuration
loophole only in CI, and the React Compiler checks only fail a build that runs. Name the commands
as scripts, so CI and people run the same thing (a React Router app's `lint` also runs
`react-router typegen` first; a tsconfig split into references uses `tsc -b`; a monorepo's scripts
can call its task runner):

```json
// package.json
"scripts": {
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0",
  "lint:comments": "eslint --no-inline-config -c eslint.comments-audit.config.mjs --suppressions-location eslint.comments-audit-suppressions.json . --max-warnings=0",
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
      - run: pnpm run lint:comments
      - run: pnpm run check-types
      - run: pnpm run build
```

A failing run blocks nothing until the check is required: add a ruleset for the default branch
(Settings → Rules → Rulesets) that requires the `quality` check before merging.
