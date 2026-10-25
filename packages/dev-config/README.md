# @toolpath/dev-config

Shared ESLint, Prettier and TypeScript configuration for Toolpath repositories, and helpers that
keep React Compiler switched on. It is configuration only: nothing is generated or synchronized,
and each repository adds a few small files once.

```sh
pnpm add -D @toolpath/dev-config eslint prettier typescript
```

## ESLint

```js
// eslint.config.mjs
import { createEslintConfig } from '@toolpath/dev-config/eslint'

export default createEslintConfig({ tsconfigRootDir: import.meta.dirname, react: true })
```

- Every JS and TS file gets ESLint's correctness rules, plus `curly`, `eqeqeq`, `prefer-const` and
  `no-var`.
- TypeScript files get typescript-eslint's `strictTypeChecked` preset, `Array<T>` and separate
  type-only imports. Unused names may start with `_`.
- `react: true` adds, for `.jsx` and `.tsx` files, the Hooks and React Compiler rules
  (`eslint-plugin-react-hooks` `recommended-latest`), `@eslint-react` `recommended` and
  `eslint-plugin-jsx-a11y-x` `recommended`.
- Build output (`dist`, `build`, `coverage`) is ignored. Pass more globs as `ignores`.

Add repository rules after the shared ones:

```js
export default [
  ...createEslintConfig({ tsconfigRootDir: import.meta.dirname }),
  { files: ['scripts/**'], rules: { 'no-console': 'off' } },
]
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
{ "extends": "@toolpath/dev-config/tsconfig/browser.json", "include": ["src"] }
```

| Base           | For                                                         |
| -------------- | ----------------------------------------------------------- |
| `base.json`    | Strict checks shared by all the others                      |
| `browser.json` | Bundled browser code: `Bundler` resolution, DOM, React JSX  |
| `node.json`    | Node programs and scripts: `NodeNext`, Node types           |
| `library.json` | Published libraries for any renderer: `NodeNext`, React JSX |

The bases set `noEmit`; the build tool (Vite, tsup, esbuild) emits the JavaScript.

## React Compiler

Every React project compiles with [React Compiler](https://react.dev/learn/react-compiler):

```sh
pnpm add -D babel-plugin-react-compiler @babel/core
```

`reactCompilerOptions()` holds the shared options: `compilationMode: 'infer'`,
`panicThreshold: 'none'` (a function the compiler cannot handle is emitted unchanged), and
`target: '19'`. Code that must run on React 17 or 18 passes `reactCompilerOptions({ target: '18' })`
and installs `react-compiler-runtime`.

Wire the compiler the way your build tool documents it, then add the check for that tool. The
check fails the build when the compiler compiled nothing, for example after an upgrade drops an
option it was configured through.

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

export default defineConfig({
  plugins: [
    reactRouter(),
    babel({
      filter: /\.[jt]sx?$/,
      babelConfig: {
        presets: ['@babel/preset-typescript'],
        plugins: [['babel-plugin-react-compiler', reactCompilerOptions()]],
      },
    }),
    reactCompilerGuard(),
  ],
})
```

`reactCompilerGuard()` checks production client builds. It counts the project's `.jsx` and `.tsx`
modules and fails when none imports the compiler runtime. Server builds and dependencies are not
counted.

### tsup and esbuild libraries

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
  external: ['react'],
  esbuildPlugins: [reactCompilerEsbuildPlugin()],
  onSuccess: async () => {
    assertReactCompiled('dist')
  },
})
```

`reactCompilerEsbuildPlugin()` runs the compiler over each source file before esbuild lowers it.
`assertReactCompiled('dist')` throws unless the output imports the compiler runtime, which is why
`react` stays external.

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

There is no build check for Metro.
