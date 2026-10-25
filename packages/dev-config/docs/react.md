# React

Every project with a `react` profile in `dev.config.mjs` compiles with [React Compiler](https://react.dev/learn/react-compiler). Installing `babel-plugin-react-compiler` or enabling its lint rules is not enough: the declared adapter wires the compiler into the project's real build, and `toolpath-dev react verify` proves that build emits compiled code.

```js
// dev.config.mjs (one project)
{
  name: 'app',
  root: 'apps/app',
  kind: 'application',
  runtime: 'dom',
  tsconfig: 'tsconfig.json',
  react: { adapter: 'vite-modern', minimumVersion: '19' },
  suites: { unit: { runner: 'vitest', config: 'vitest.config.ts' } },
}
```

## Compiler policy

All adapters pass the same options to the pinned `babel-plugin-react-compiler@1.0.0`:

| Option            | Value                  | Why                                                                                                                       |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `compilationMode` | `'infer'`              | Compiles what looks like a component or hook. `'all'` is not used.                                                        |
| `target`          | `react.minimumVersion` | The oldest React the shipped code supports (`'17'`, `'18'` or `'19'`; default `'19'`).                                    |
| `panicThreshold`  | `'none'`               | The compiler's production-safe fallback: a function it cannot compile is emitted as written instead of failing the build. |

The compiler never runs on `node_modules`. Its correctness diagnostics are lint rules (`react-hooks/*`, [policy](policy.md)), so code it skips is still reported where it breaks the Rules of React.

## Adapters

Declare the adapter; it is never guessed from the shape of a user's build config.

| `react.adapter`   | Build                                          | Factory                                                                   | Tested with                                                                   |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `vite-legacy`     | Vite with `@vitejs/plugin-react` 5             | `createReactPlugins` from `@toolpath/dev-config/react/vite`               | vite 7.3.6, @vitejs/plugin-react 5.2.0, @babel/core 7.29.7                    |
| `vite-modern`     | Vite with `@vitejs/plugin-react` 6             | `createReactPlugins` from `@toolpath/dev-config/react/vite`               | vite 8.3.5, @vitejs/plugin-react 6.1.2, @rolldown/plugin-babel 0.2.4          |
| `react-router`    | React Router 7 (`@react-router/dev`) on Vite   | `createReactRouterCompilerPlugin` from `.../react/babel`                  | react-router 7.18.4, vite-plugin-babel 1.7.3, @babel/preset-typescript 7.29.7 |
| `babel`           | Any Babel pipeline (`babel.config.*`)          | `createBabelConfig`, `createReactCompilerBabelPlugin` (`.../react/babel`) | @babel/core 7.29.7                                                            |
| `expo`            | Expo SDK 58 / Metro                            | `createExpoBabelConfig`, `withReactCompiler` (`.../react/expo`)           | expo 58.0.19, react-native 0.88.0, babel-preset-expo 58.0.20                  |
| `library-esbuild` | A published library built with esbuild or tsup | `reactCompilerEsbuildPlugin` (`.../react/library`)                        | esbuild 0.28.2, tsup 8.5.1                                                    |

`toolpath-dev init` installs the tools for the declared adapter as exact dev dependencies, with `babel-plugin-react-compiler@1.0.0`. A missing tool fails with the profile and the install command; no adapter falls back to an uncompiled build.

### Vite (`vite-legacy`, `vite-modern`)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import config from '../../dev.config.mjs'
import { createReactPlugins } from '@toolpath/dev-config/react/vite'

export default defineConfig({
  plugins: [...(await createReactPlugins(config, { project: 'app' }))],
})
```

- `vite-legacy` gives plugin-react 5 the compiler as the first entry of its Babel plugins, by package name, so plugin-react also removes it for SSR transforms and pre-bundles the compiler runtime.
- `vite-modern` uses plugin-react 6, which no longer runs Babel: the compiler runs through `@rolldown/plugin-babel` with plugin-react's own `reactCompilerPreset`, in the order its documentation gives. The removed inline `babel` option is never passed.
- Pass other plugin-react options as `react: { … }`. The adapter owns `babel` and `compiler` and rejects them there. Application Babel plugins go in `babelPlugins`; they run after the compiler.
- Both plugin-react versions apply the compiler to the client environment only, so a server render runs the uncompiled module; behaviour is the same.

### React Router (`react-router`)

React Router's Vite plugin runs no Babel of its own; React's guide adds `vite-plugin-babel` with the compiler and `@babel/preset-typescript`.

```ts
// vite.config.ts
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import config from './dev.config.mjs'
import { createReactRouterCompilerPlugin } from '@toolpath/dev-config/react/babel'

export default defineConfig({
  plugins: [reactRouter(), await createReactRouterCompilerPlugin(config, { project: 'app' })],
})
```

The factory sets `include` to `.js/.jsx/.ts/.tsx` explicitly. Since vite-plugin-babel 1.7 its default `include` is `.js/.jsx` only, and the guide's `filter` option would narrow that further: copying the guide verbatim compiles no TypeScript route. `node_modules` is excluded, including from dependency pre-bundling, where the plugin also runs.

### Babel (`babel`)

```js
// babel.config.mjs
import config from './dev.config.mjs'
import { createBabelConfig } from '@toolpath/dev-config/react/babel'

export default createBabelConfig(config, {
  project: 'web',
  presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
})
```

Babel runs plugins before presets, and plugins in order, so the compiler sees the source before any other transform. To place the compiler in an existing configuration yourself, put `createReactCompilerBabelPlugin(config, { project })` first in `plugins`.

### Expo (`expo`)

Expo ships the compiler inside `babel-preset-expo`; Metro enables it when the app config sets the experiment.

```json
// app.json
{ "expo": { "experiments": { "reactCompiler": true } } }
```

```js
// babel.config.js
const { createExpoBabelConfig } = require('@toolpath/dev-config/react/expo')
const { default: config } = require('./dev.config.mjs')

module.exports = (api) => {
  api.cache(true)
  return createExpoBabelConfig(config, { project: 'mobile' })
}
```

- The standard options travel through the preset's `react-compiler` option. Adding `babel-plugin-react-compiler` as a plugin as well would compile every component twice; the factory refuses it and `doctor` reports it.
- `app.config.(js|ts)` can wrap its config with `withReactCompiler(config)` instead of `app.json`.
- `babel-preset-expo` is resolved from the project, else from `expo`'s own dependency, which is the copy Metro uses by default; npm may leave that copy nested under `expo`.
- A CommonJS `babel.config.js` loads this ESM package through Node 24's `require(esm)`.

### Libraries (`library-esbuild`)

A published React library compiles its shipped JavaScript. The esbuild plugin runs the compiler in `onLoad`, before esbuild lowers TypeScript and JSX; declarations stay with `tsc`.

```ts
// tsup.config.ts
import { defineConfig } from 'tsup'
import config from './dev.config.mjs'
import {
  platformResolveExtensions,
  reactCompilerEsbuildPlugin,
} from '@toolpath/dev-config/react/library'

const compiler = reactCompilerEsbuildPlugin(config, { project: 'ui' })
const external = ['react', 'react/*', 'react-native', 'react-compiler-runtime']

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist/web',
    external,
    esbuildPlugins: [compiler],
    esbuildOptions: (options) => {
      options.resolveExtensions = platformResolveExtensions('web')
    },
  },
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist/native',
    external,
    esbuildPlugins: [compiler],
    esbuildOptions: (options) => {
      options.resolveExtensions = platformResolveExtensions('native')
    },
  },
])
```

- Babel's source map is inlined into what esbuild loads, and esbuild chains it, so the bundle's map points at the original `.tsx`.
- The plugin does not resolve anything: platform files (`Button.web.tsx`, `Button.native.tsx`, `Button.ios.tsx`) and `external` behave as the build options say. `platformResolveExtensions(platform)` orders a platform's files before the shared one. Import platform files without an extension, and type-check with `moduleResolution: "Bundler"`.
- Keep `react`, `react/*` and `react-compiler-runtime` external; the consumer's React provides the compiler runtime.
- Test the packed tarball, not the workspace: the compiled artifact is what consumers execute.

## Supporting older React

`minimumVersion: '17'` or `'18'` compiles for that React. Compiled code then imports `react-compiler-runtime` instead of `react/compiler-runtime`, so the library must list `react-compiler-runtime@1.0.0` in its **dependencies**. That is a reviewed runtime dependency change of the consumer package; this package never adds it for you.

`doctor` compares `minimumVersion` with the package's declared `react` range: a peer range that admits React 18 while `minimumVersion` is `'19'` fails, because the compiled output would not run on every React the package accepts. The standard never raises a consumer's React floor silently.

## Verification

`toolpath-dev react verify [--project <name>]` first runs the adapter checks `doctor` uses, then transforms a probe component through the project's real build configuration and fails unless the output allocates a compiler memo cache:

| Adapter                                      | What runs                                                                                                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite-legacy`, `vite-modern`, `react-router` | Vite starts in middleware mode with the project's own `vite.config.*` and transforms the probe through the client pipeline.                                                                                                             |
| `babel`                                      | Babel loads the project's `babel.config.*` / `.babelrc*` for the probe.                                                                                                                                                                 |
| `expo`                                       | The app config must enable the experiment; the Babel config is loaded with Metro's caller contract (`supportsReactCompiler`, which Expo derives from the experiment), checked for a second compiler, and the probe transformed for iOS. |
| `library-esbuild`                            | The project's Babel and compiler compile the probe. That the build config uses the plugin is the `doctor` wiring check.                                                                                                                 |

An installed compiler that the build never runs fails verification instead of passing quietly. The same checks are exported for a consumer's own tests: `verifyViteReactCompiler({ root })`, `verifyBabelReactCompiler({ root })`, `verifyExpoReactCompiler({ projectRoot })`.

`doctor` (`reactAdapterIssues`) reports, read-only:

- an adapter tool that is missing or not the tested version;
- a native config (`vite.config.*`, `babel.config.*`, `tsup.config.*`, `esbuild.config.*`, `build.config.*`, `scripts/build.*`) that does not import the adapter's entry point — the config file itself must import it;
- for Expo, a missing experiment or a compiler named directly in the Babel config;
- the React floor and `react-compiler-runtime` rules above.

## Opting out

A component or hook that must not be compiled starts with the `"use no memo"` directive, with a comment beside it naming the incompatibility or the deliberate boundary. `toolpath/require-compiler-optout-reason` rejects an unexplained directive; a string elsewhere is not a directive and is ignored.

```tsx
export const Chart = ({ points }: ChartProps) => {
  // The charting library mutates the array it is given, which the compiler cannot model.
  'use no memo'
  return <LegacyChart data={points} />
}
```

Opt out of the narrowest function that needs it. A module-wide directive at the top of a file opts the whole file out and needs the same explanation.

## External mutable integrations

Some libraries return values that change without React knowing (form libraries' `watch`, table and chart instances that mutate themselves). `react-hooks/incompatible-library` flags the known ones; the compiler skips memoizing around them. Keep such values out of memoized computations, read them where they are used, or opt the component out with its reason. A lint suppression for these rules is line-scoped and explained, like any other.

Existing `memo`, `useMemo` and `useCallback` stay valid; the compiler preserves them (`react-hooks/preserve-manual-memoization` reports when it cannot). The standard does not require manual memoization and does not remove it.

## Native projects

- Native projects test with `jest-expo` ([testing](testing.md)), never Vitest/jsdom. DOM and accessibility lint rules are scoped away from `runtime: 'native'`.
- jest-expo transforms tests without Metro's caller flag, so components run uncompiled under Jest. `react verify` proves the Metro path compiles; a library that ships compiled native code tests its built artifact.
- The tested line is Expo SDK 58, React Native 0.88 and React 19.3. React Native requires the exact React version its renderer was built with.

## Accessibility component mapping

DOM React projects lint JSX with `eslint-plugin-jsx-a11y-x`. Map design-system components to the element they render so its checks apply to them, through `createEslintConfig`'s extension slot:

```js
// eslint.config.mjs
import config from './dev.config.mjs'
import { createEslintConfig } from '@toolpath/dev-config/eslint'

export default await createEslintConfig(config, {
  extend: [
    {
      settings: {
        'jsx-a11y-x': { components: { Button: 'button', Link: 'a' }, polymorphicPropName: 'as' },
      },
    },
  ],
})
```

## Limits

- The compiler decides what to memoize; compiling does not prove every callback is optimized or that a performance problem is solved. Measure.
- With `panicThreshold: 'none'`, a function the compiler cannot compile ships uncompiled without failing the build. The Hooks lint rules report the patterns that cause it.
- Verification proves the build pipeline compiles a representative component, not that every file compiled. A file that bails out is reported by lint, not by `react verify`.
- In an application bundle the compiler runtime is bundled with React, so built output carries no import to inspect; `react verify` checks the transform instead. Library builds keep the runtime external, and their artifacts are inspected directly (`inspectBuiltArtifact`).
- Expo's compiler integration follows the SDK's experiment; a future SDK that changes its caller contract needs a new tested release of this package.
